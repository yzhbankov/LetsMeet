import React, { Component } from 'react';
import moment from 'moment';
import { List, ListItem } from 'material-ui/List';
import _ from 'lodash';
import Subheader from 'material-ui/Subheader';
import Divider from 'material-ui/Divider';
import DateRangeIcon from 'material-ui/svg-icons/action/date-range';
import DayPicker, { DateUtils } from 'react-day-picker';
import cssModules from 'react-css-modules';
import 'react-day-picker/lib/style.css';

import styles from './best-times-display.css';

class BestTimeDisplay extends Component {
  constructor(props) {
    super(props);
    this.state = {
      event: this.props.event,
      disablePicker: false,
    };
  }

  componentWillMount() {
    const { event, disablePicker } = this.props;
    const displayTimes = this.buildBestTimes();
    this.setState({ event, displayTimes, disablePicker });
  }

  componentWillReceiveProps(nextProps) {
    const { event, disablePicker } = nextProps;
    const displayTimes = this.buildBestTimes();
    this.setState({ event, displayTimes, disablePicker });
  }

  buildBestTimes() {
    const { event } = this.state;
    const availability = [];
    const overlaps = [];
    const displayTimes = {};

    event.participants.forEach((participant) => {
      if (participant.availability !== undefined) availability.push(participant.availability);
    });

    if (availability.length > 1) {
      for (let i = 0; i < availability[0].length; i += 1) {
        const current = availability[0][i];
        let count = 0;
        for (let j = 0; j < availability.length; j += 1) {
          for (let k = 0; k < availability[j].length; k += 1) {
            if (availability[j][k][0] === current[0]) {
              count += 1;
            }
          }
        }
        if (count === availability.length) overlaps.push(current);
      }

      if (overlaps.length !== 0) {
        let index = 0;
        for (let i = 0; i < overlaps.length; i += 1) {
          if (overlaps[i + 1] !== undefined && overlaps[i][1] !== overlaps[i + 1][0]) {
            if (displayTimes[moment(overlaps[index][0]).format('DD MMM')] !== undefined) {
              displayTimes[moment(overlaps[index][0]).format('DD MMM')]
                .hours.push(`${moment(overlaps[index][0]).format('h:mm a')} to ${moment(overlaps[i][1]).format('h:mm a')}`);
            } else {
              displayTimes[moment(overlaps[index][0]).format('DD MMM')] = {};
              displayTimes[moment(overlaps[index][0]).format('DD MMM')].hours = [];
              displayTimes[moment(overlaps[index][0]).format('DD MMM')]
                .hours.push(`${moment(overlaps[index][0]).format('h:mm a')} to ${moment(overlaps[i][1]).format('h:mm a')}`);
            }
            index = i + 1;
          } else if (overlaps[i + 1] === undefined) {
            if (displayTimes[moment(overlaps[index][0]).format('DD MMM')] !== undefined) {
              displayTimes[moment(overlaps[index][0]).format('DD MMM')]
                .hours.push(`${moment(overlaps[index][0]).format('h:mm a')} to ${moment(overlaps[i][1]).format('h:mm a')}`);
            } else {
              displayTimes[moment(overlaps[index][0]).format('DD MMM')] = {};
              displayTimes[moment(overlaps[index][0]).format('DD MMM')].hours = [];
              displayTimes[moment(overlaps[index][0]).format('DD MMM')]
                .hours.push(`${moment(overlaps[index][0]).format('h:mm a')} to ${moment(overlaps[i][1]).format('h:mm a')}`);
            }
          }
        }
      }
    }

    return displayTimes;
  }

  isBestTime() {
    const bestTimes = this.state.displayTimes;
    let isBestTime;
    if (bestTimes !== undefined) {
      if (Object.keys(bestTimes).length > 0) isBestTime = true;
      else isBestTime = false;
    } else isBestTime = false;

    return isBestTime;
  }

  renderRows(hours) {
    const rows = [];
    hours.forEach((hour) => {
      const row = (
        <ListItem key={hour} styleName="RowListItem" disabled>
          {hour}
        </ListItem>
      );
      rows.push(row);
    });
    return rows;
  }

  renderBestTime() {
    const { displayTimes } = this.state;
    return Object.keys(displayTimes).map(date => (
      <List key={date} disabled styleName="BstTimeList">
        <Subheader styleName="SubHeader"><DateRangeIcon styleName="DateRangeIcon" />{date}</Subheader>
        <ListItem key={date} disabled styleName="BstTimeListItem">
          <List>
            {this.renderRows(displayTimes[date].hours)}
          </List>
          <Divider styleName="Divider" />
        </ListItem>
      </List>
    ));
  }

  renderDayPicker() {
    const { event } = this.state;
    let maxDate;
    let minDate;
    let modifiers;

    const ranges = event.dates.map(({ fromDate, toDate }) => ({
      from: new Date(fromDate),
      to: new Date(toDate),
    }));

    const dates = event.dates.map(({ fromDate, toDate }) => ({
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
    }));

    if (ranges) {
      modifiers = {
        selected: day =>
          DateUtils.isDayInRange(day, dates) ||
          ranges.some(v => DateUtils.isDayInRange(day, v)),
      };

      const dateInRanges = _.flatten(ranges.map(range => [range.from, range.to]));
      maxDate = new Date(Math.max.apply(null, dateInRanges));
      minDate = new Date(Math.min.apply(null, dateInRanges));
    }
    return (
      <DayPicker
        styleName="DayPicker"
        initialMonth={minDate}
        fromMonth={minDate}
        toMonth={maxDate}
        modifiers={modifiers}
      />
    );
  }

  render() {
    const { displayTimes, disablePicker } = this.state;
    return (
      <div styleName="bestTimeDisplay">
        {this.isBestTime(displayTimes) ?
          <div>
            <h6 styleName="bestTimeTitle">All participants so far are available at:</h6>
            {this.renderBestTime()}
          </div>
         :
         (disablePicker === false) ? this.renderDayPicker() : null
        }
      </div>
    );
  }
}

BestTimeDisplay.propTypes = {
  event: React.PropTypes.object,
  disablePicker: React.PropTypes.bool,
};

export default cssModules(BestTimeDisplay, styles);
