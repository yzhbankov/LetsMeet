import _ from 'lodash';
import autobind from 'autobind-decorator';
import cssModules from 'react-css-modules';
import DayPicker, { DateUtils } from 'react-day-picker';
import moment from 'moment';
import noUiSlider from 'materialize-css/extras/noUiSlider/nouislider.min.js';
import React from 'react';
import fetch from 'isomorphic-fetch';
import { browserHistory } from 'react-router';

import { checkStatus } from '../util/fetch.util';
import { formatTime, getHours, getMinutes } from '../util/time-format';

import 'materialize-css/extras/noUiSlider/nouislider.css';
import 'react-day-picker/lib/style.css';
import styles from '../styles/new-event.css';

class NewEvent extends React.Component {
  constructor() {
    super();
    this.state = {
      ranges: [{ from: null, to: null }],
      eventName: '',
      weekDays: {
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false,
      },
      dateOrDay: false,
      selectedTimeRange: [0, 23],
      submitClass: 'waves-effect waves-light btn purple disabled',
    };
  }

  componentDidMount() {
    const slider = document.getElementById('timeSlider');
    noUiSlider.create(slider, {
      start: [0, 24],
      connect: true,
      step: 0.25,
      range: {
        min: 0,
        max: 24,
      },
      format: {
        to: val => formatTime(val),
        from: val => val,
      },
    });

    slider.noUiSlider.on('update', (value, handle) => {
      $(".range-label span").text("")
      const { selectedTimeRange } = this.state;
      selectedTimeRange[handle] = value[handle];
      this.setState({ selectedTimeRange });
    });
  }

  @autobind
  handleDayClick(e, day, { disabled }) {
    if (disabled) return;
    let ranges = Object.keys(this.state.ranges).map(i => this.state.ranges[i]);

    function removeRange(ranges, range) {
      const newRange = ranges.filter(r => !_.isEqual(r, range));
      if (newRange.length === 0) {
        return [{
          from: null,
          to: null,
        }];
      }
      return newRange;
    }
    // Check if day already exists in a range. If yes, remove it from all the
    // ranges that it exists in.
    for (const range of ranges) {
      if (DateUtils.isDayInRange(day, range)) {
        const { from, to } = range;
        const yesterday = moment(day).subtract(1, 'date')._d;
        const tomorrow = moment(day).add(1, 'date')._d;

        if (!DateUtils.isDayInRange(yesterday, range) && !DateUtils.isDayInRange(tomorrow, range)) {
          ranges = removeRange(ranges, range);
          continue;
        }

        if (!moment(day).isSame(from)) {
          ranges.push({
            from, to: yesterday,
          });
        }

        if (!moment(day).isSame(to)) {
          ranges.push({
            from: tomorrow, to,
          });
        }

        ranges = removeRange(ranges, range);
      }
    }

    // If the previous operation did not change the ranges array (i.e. the
    // clicked day wasn't already in a range), then either create a new range or
    // add it to the existing range.
    if (_.isEqual(ranges, this.state.ranges)) {
      if (!ranges[ranges.length - 1].from ||
          !ranges[ranges.length - 1].to) {
        ranges[ranges.length - 1] = DateUtils.addDayToRange(day, ranges[ranges.length - 1]);
        this.setState({ ranges });
      } else {
        ranges.push({ from: null, to: null });
        ranges[ranges.length - 1] = DateUtils.addDayToRange(day, ranges[ranges.length - 1]);
        this.setState({ ranges });
      }
    } else {
      this.setState({ ranges });
    }
  }

  @autobind
  handleResetClick(e) {
    e.preventDefault();
    this.setState({ ranges: [{
      from: null,
      to: null,
    }] });
  }

  @autobind
  async createEvent(ev) {
    function generateID() {
      let ID = '';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

      for (let i = 0; i < 6; i++) {
        ID += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      return ID;
    }

    const uid = generateID();

    if (ev.target.className.indexOf('disabled') > -1) {
      Materialize.toast('Please enter an event name!', 4000);
    } else {
      const {
        eventName: name,
        ranges,
        dateOrDay,
        weekDays,
        selectedTimeRange: [fromTime, toTime],
      } = this.state;
      let sentData;

      const fromHours = getHours(fromTime);
      const toHours = getHours(toTime);

      const fromMinutes = getMinutes(fromTime);
      const toMinutes = getMinutes(toTime);

      if (dateOrDay) {
        const dates = [];

        for (const key of Object.keys(weekDays)) {
          if (!weekDays[key]) continue;
          dates.push({
            fromDate: moment()
                        .day(key)
                        .set('h', fromHours)
                        .set('m', fromMinutes)._d,
            toDate: moment()
                        .day(key)
                        .set('h', toHours)
                        .set('m', toMinutes)._d,
          });
        }

        sentData = JSON.stringify({ uid, name, weekDays, dates });
      } else {
        const dates = [];
        ranges.map(({ from, to }) => {
          if (!to) to = from;

          if (from > to) {
            [from, to] = [to, from];
          }

          return {
            fromDate: moment(from).set('h', fromHours).set('m', fromMinutes)._d,
            toDate: moment(to).set('h', toHours).set('m', toMinutes)._d,
          };
        }).forEach(({ fromDate, toDate }, i, arr) => {
          if (arr[i + 1]) {
            const nextDayMomentFrom = moment(arr[i + 1].fromDate);

            if (moment(toDate).add(1, 'd').isSame(nextDayMomentFrom, 'd')) {
              toDate = arr[i + 1].toDate;
              dates.push({ fromDate, toDate });
            }
          }
        });

        sentData = JSON.stringify({ uid, name, dates });
      }

      // const response = await fetch('/api/events', {
      //   headers: {
      //     Accept: 'application/json',
      //     'Content-Type': 'application/json',
      //   },
      //   method: 'POST',
      //   body: sentData,
      //   credentials: 'same-origin',
      // });

      // try {
      //   checkStatus(response);
      // } catch (err) {
      //   console.log(err); return;
      // }

      // browserHistory.push(`/event/${uid}`);
    }
  }

  @autobind
  handleEventNameChange(ev) {
    this.setState({ eventName: ev.target.value });
    let { submitClass } = this.state;
    if (ev.target.value.length > 0) {
      this.setState({
        submitClass: submitClass.replace(' disabled', ''),
      });
    } else {
      if (submitClass.indexOf('disabled') === -1) {
        this.setState({
          submitClass: submitClass += ' disabled',
        });
      }
    }
  }

  @autobind
  handleWeekdaySelect(ev) {
    if (ev.target.className.indexOf('disabled') > -1) {
      ev.target.className = ev.target.className.replace('disabled', '');
    } else {
      ev.target.className += 'disabled';
    }

    const { weekDays } = this.state;
    const weekDay = ev.target.text.toLowerCase();
    weekDays[weekDay] = !weekDays[weekDay];
    this.setState({ weekDays });
  }

  @autobind
  handleDateOrDay() {
    this.setState({ dateOrDay: !this.state.dateOrDay });
  }

  render() {
    const modifiers = {
      selected: day =>
        DateUtils.isDayInRange(day, this.state) ||
        this.state.ranges.some(v => DateUtils.isDayInRange(day, v)),
    };

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const { from, to } = this.state.ranges[0];

    return (
      <div className="card" styleName="new-event-card">
        <div className="card-content">
          <span className="card-title">Create a new event</span>
          <form>
            <div className="row">
              <div className="input-field col s12">
                <input
                  id="event_name"
                  type="text"
                  value={this.state.eventName}
                  onChange={this.handleEventNameChange}
                  className="validate"
                />
                <label htmlFor="event_name">Event Name</label>
              </div>
            </div>
            <div className="switch center-align">
              <label>
                Specific Dates
                <input
                  type="checkbox"
                  onClick={this.handleDateOrDay}
                  checked={this.state.dateOrDay}
                />
                <span className="lever" />
                Weekdays
              </label>
            </div>
            {!this.state.dateOrDay ?
              <div>
                <h6 styleName="heading-dates">What dates might work for you?</h6>
                {from && to &&
                  <p className="center">
                    <a
                      className="btn-flat"
                      href="#"
                      onClick={this.handleResetClick}
                    >Reset</a>
                  </p>
                }
                <DayPicker
                  fromMonth={new Date()}
                  disabledDays={DateUtils.isPastDay}
                  modifiers={modifiers}
                  onDayClick={this.handleDayClick}
                  styleName="daypicker"
                />
              </div> :
              <div>
                <h6 styleName="heading">What days might work for you?</h6>
                <div styleName="weekdayList">
                  {
                    weekDays.map((day, index) => (
                      <a
                        key={index}
                        className="btn-flat disabled"
                        onClick={this.handleWeekdaySelect}
                        style={{ cursor: 'pointer' }}
                      >{day}</a>
                    ))
                  }
                </div>
              </div>
            }
            <h6 styleName="heading">What times might work?</h6>
            <div id="timeSlider" />
            <br />
            <p className="center">
              From {this.state.selectedTimeRange[0]} to {this.state.selectedTimeRange[1]}
            </p>
            <br />
            <p className="center">
              <a className={this.state.submitClass} onClick={this.createEvent}>
                Create Event
              </a>
            </p>
          </form>
        </div>
      </div>
    );
  }
}

export default cssModules(NewEvent, styles);