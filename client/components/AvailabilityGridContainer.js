import React from 'react';
import cssModules from 'react-css-modules';
import _ from 'lodash';
import moment from 'moment';
import autobind from 'autobind-decorator';
import fetch from 'isomorphic-fetch';
import { checkStatus } from '../util/fetch.util';
import { getHours, getMinutes } from '../util/time-format';
import colorsys from 'colorsys';
import nprogress from 'nprogress';
import styles from '../styles/availability-grid.css';
import AvailabilityGrid from './AvailabilityGrid';

export default class AvailabilityGridContainer extends React.Component {
  constructor(props) {
    super(props);

    let dateFormatStr = 'Do MMM';

    this.state = {
      availability: [],
      allTimes: [],
      allTimesRender: [],
      allDates: [],
      allDatesRender: [],
      dateFormatStr,
      availableOnDate: [],
      notAvailableOnDate: [],
      hourTime: [],
      startCell: null,
      endCell: null,
    };
  }

  componentWillMount() {
    const allDates = _.flatten(this.props.dates.map(({ fromDate, toDate }) =>
      this.getDaysBetween(fromDate, toDate),
    ));

    const allTimes = _.flatten([this.props.dates[0]].map(({ fromDate, toDate }) =>
      this.getTimesBetween(fromDate, toDate),
    ));

    const allDatesRender = allDates.map(date => moment(date).format(this.state.dateFormatStr));
    const allTimesRender = allTimes.map(time => moment(time).format('hh:mm a'));

    allTimesRender.pop();

    const hourTime = allTimesRender
      .filter(time => String(time).split(':')[1].split(' ')[0] === '00');

    const lastHourTimeEl = hourTime.slice(-1)[0];
    const lastAllTimesRenderEl = allTimesRender.slice(-1)[0];

    if (getHours(lastHourTimeEl) !== getHours(lastAllTimesRenderEl) || getMinutes(lastAllTimesRenderEl) === 45) {
      hourTime.push(
        moment(new Date())
        .set('h', getHours(lastHourTimeEl))
        .set('m', getMinutes(lastHourTimeEl))
        .add(1, 'h')
        .format('hh:mm a'),
      );
    }

    this.setState({ allDates, allTimes, allDatesRender, allTimesRender, hourTime });
  }

  componentDidMount() {
    if (this.props.heatmap) this.renderHeatmap();
    if (this.props.myAvailability && this.props.myAvailability.length > 0) this.renderAvail();

    $('.cell').on('click', (e) => {
      if (!this.props.heatmap) this.addCellToAvail(e);
    });

    // Offset the grid-hour row if the event starts with a date that's offset by
    // 15/30/45 minutes.
    const gridHour = document.querySelector('.grid-hour');
    const { allTimesRender } = this.state;

    if (getMinutes(allTimesRender[0]) === 15) {
      gridHour.setAttribute('style', 'margin-left: 50.6px !important');
    } else if (getMinutes(allTimesRender[0]) === 30) {
      gridHour.setAttribute('style', 'margin-left: 38px !important');
    } else if (getMinutes(allTimesRender[0]) === 45) {
      gridHour.setAttribute('style', 'margin-left: 25.2px !important');
    }

    // Change the border of the cell if it's minutes = 0 or 30 to help visually
    // separate 15 minute blocks from 30 minute and 1 hour blocks.
    const cells = document.querySelectorAll('.cell');

    cells.forEach((cell) => {
      if (getMinutes(cell.getAttribute('data-time')) === 0) {
        cell.style.borderLeft = '1px solid rgb(120, 120, 120)';
      } else if (getMinutes(cell.getAttribute('data-time')) === 30) {
        cell.style.borderLeft = '1px solid #c3bebe';
      }
    });

    // Check if two adjacent grid hours labels are consecutive or not. If not, then split the grid
    // at this point.
    const hourTime = this.state.hourTime.slice(0);

    for (let i = 0; i < hourTime.length; i += 1) {
      if (hourTime[i + 1]) {
        const date = moment(new Date());
        const nextDate = moment(new Date());

        date.set('h', getHours(hourTime[i]));
        date.set('m', getMinutes(hourTime[i]));

        nextDate.set('h', getHours(hourTime[i + 1]));
        nextDate.set('m', getMinutes(hourTime[i + 1]));

        // date.add (unfortunately) mutates the original moment object. Hence we don't add an hour
        // to the object again when it's inserted into this.state.hourTime.
        if (date.add(1, 'h').format('hh:mm') !== nextDate.format('hh:mm')) {
          $(`.cell[data-time='${nextDate.format('hh:mm a')}']`).css('margin-left', '50px');

          // 'hack' (the modifyHourTime function) to use setState in componentDidMount and bypass
          // eslint. Using setState in componentDidMount couldn't be avoided in this case.
          this.modifyHourTime(hourTime, date, i);
        }
      }
    }
  }

  getTimesBetween(start, end) {
    let times = [start];
    let currentTime = start;

    if (moment(end).hour() === 0) {
      end = moment(end)
        .subtract(1, 'd')
        .hour(23)
        .minute(59)._d;
    }

    if (moment(end).hour() < moment(start).hour()) {
      // days are split
      currentTime = moment(start)
        .set('hour', 0)
        .set('minute', 0)._d;
      times = [currentTime];

      if (moment(end).hour() === 0) times = [];

      while (moment(end).hour() > moment(times.slice(-1)[0]).hour()) {
        currentTime = moment(currentTime).add(15, 'm')._d;
        times.push(currentTime);
      }

      currentTime = moment(currentTime)
        .set('hour', moment(start).get('hour'))
        .set('minute', moment(start).get('minute'))._d;

      times.pop();
      times.push(currentTime);

      while (moment(times.slice(-1)[0]).hour() > 0) {
        currentTime = moment(currentTime).add(15, 'm')._d;
        times.push(currentTime);
      }
    } else {
      end = moment(end).set('date', moment(start).get('date'));

      while (moment(end).isAfter(moment(times.slice(-1)[0]))) {
        currentTime = moment(currentTime).add(15, 'm')._d;
        times.push(currentTime);
      }
    }

    return times;
  }

  // Get all days between start and end.
  // eg. getDaysBetween(25th June 2016, 30th June 2016) => [25th, 26th, 27th, 28th, 29th, 30th]
  // (all input and output is in javascript Date objects)
  getDaysBetween(start, end) {
    const dates = [start];
    let currentDay = start;

    // If the end variable's hour is 12am, then we don't want it in the allDates array, or it will
    // create an extra row in the grid made up only of disabled cells.
    if (moment(end).hour() === 0) end = moment(end).subtract(1, 'd')._d;

    while (moment(end).isAfter(dates[dates.length - 1], 'day')) {
      currentDay = moment(currentDay).add(1, 'd')._d;
      dates.push(currentDay);
    }

    return dates;
  }

  modifyHourTime(hourTime, date, i) {
    // inserts the formatted date object at the 'i+1'th index in this.state.hourTime.
    this.setState({
      hourTime: [
        ...hourTime.slice(0, i + 1),
        date.format('hh:mm a'),
        ...hourTime.slice(i + 1),
      ],
    });
  }

  @autobind
  async submitAvailability() {
    const { allDates, allTimes, allDatesRender, allTimesRender } = this.state;
    const availability = [];

    $('.cell').each((i, el) => {
      if ($(el).css('background-color') === 'rgb(128, 0, 128)') {
        const timeIndex = allTimesRender.indexOf($(el).attr('data-time'));
        const dateIndex = allDatesRender.indexOf($(el).attr('data-date'));

        const date = moment(allDates[dateIndex]).get('date');

        const from = moment(allTimes[timeIndex]).set('date', date)._d;
        const to = moment(allTimes[timeIndex + 1]).set('date', date)._d;

        availability.push([from, to]);
      }
    });

    const { _id } = this.props.user;
    const event = JSON.parse(JSON.stringify(this.props.event));

    event.participants = event.participants.map((user) => {
      if (user._id === _id) user.availability = availability;
      return user;
    });

    nprogress.configure({ showSpinner: false });
    nprogress.start();
    const response = await fetch(
      `/api/events/${event._id}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(event),
        credentials: 'same-origin',
      },
    );

    try {
      checkStatus(response);
    } catch (err) {
      console.log(err);
      return;
    } finally {
      nprogress.done();
    }

    this.props.submitAvail(availability);
  }

  @autobind
  editAvailability() {
    this.props.editAvail();
  }

  renderHeatmap() {
    const availabilityLength = this.props.availability.filter(av => av).length;
    const saturationDivisions = 100 / availabilityLength;
    const saturations = [];

    for (let i = 0; i <= 100; i += saturationDivisions) {
      saturations.push(i);
    }

    const colors = saturations.map(saturation => colorsys.hsvToHex({
      h: 271,
      s: saturation,
      v: 100,
    }));

    const formatStr = 'Do MMMM YYYY hh:mm a';
    const { allTimesRender, allDatesRender, allDates, allTimes } = this.state;
    const availabilityNum = {};
    const cells = document.querySelectorAll('.cell');

    let flattenedAvailability = _.flatten(this.props.availability);

    flattenedAvailability = flattenedAvailability.filter(avail => avail).map(avail =>
      new Date(avail[0]),
    ).map(avail =>
      moment(avail).format(formatStr),
    );

    flattenedAvailability.forEach((avail) => {
      if (availabilityNum[avail]) availabilityNum[avail] += 1;
      else availabilityNum[avail] = 1;
    });

    cells.forEach((cell) => {
      const timeIndex = allTimesRender.indexOf(cell.getAttribute('data-time'));
      const dateIndex = allDatesRender.indexOf(cell.getAttribute('data-date'));

      const date = moment(allDates[dateIndex]).get('date');
      const cellFormatted = moment(allTimes[timeIndex]).set('date', date).format(formatStr);

      cell.style.background = colors[availabilityNum[cellFormatted]];
    });
  }

  renderAvail() {
    const cells = document.querySelectorAll('.cell');
    const { allTimesRender, allDatesRender, allDates, allTimes } = this.state;
    const formatStr = 'Do MMMM YYYY hh:mm a';
    const myAvailabilityFrom = this.props.myAvailability
                                    .map(avail => new Date(avail[0]))
                                    .map(avail => moment(avail).format(formatStr));

    cells.forEach((cell) => {
      const timeIndex = allTimesRender.indexOf(cell.getAttribute('data-time'));
      const dateIndex = allDatesRender.indexOf(cell.getAttribute('data-date'));

      const date = moment(allDates[dateIndex]).get('date');
      const cellFormatted = moment(allTimes[timeIndex]).set('date', date).format(formatStr);

      if (myAvailabilityFrom.indexOf(cellFormatted) > -1) {
        cell.style.background = 'purple';
      }
    });
  }

  render() {
    const { allDatesRender, allTimesRender, hourTime } = this.state;
    const { dates } = this.props;
    return (
      <AvailabilityGrid
        allDatesRender={allDatesRender}
        allTimeRender={allTimeRender}
        hourTime={hourTime}
        dates={dates}
      />
    );
  }
}

AvailabilityGrid.propTypes = {
  dates: React.PropTypes.array.isRequired,
  heatmap: React.PropTypes.bool,
  weekDays: React.PropTypes.bool,
  user: React.PropTypes.object,
  availability: React.PropTypes.array,
  submitAvail: React.PropTypes.func,
  editAvail: React.PropTypes.func,
  myAvailability: React.PropTypes.array,
  participants: React.PropTypes.array,
  event: React.PropTypes.object,
};
