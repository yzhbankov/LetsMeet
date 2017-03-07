import React from 'react';
import update from 'react-addons-update';
import autobind from 'autobind-decorator';
import { browserHistory } from 'react-router';
import cssModules from 'react-css-modules';
import fetch from 'isomorphic-fetch';
import nprogress from 'nprogress';
import jsonpatch from 'fast-json-patch';
import { Card, CardActions, CardTitle, CardText } from 'material-ui/Card';
import FlatButton from 'material-ui/FlatButton';
import Divider from 'material-ui/Divider';
import RaisedButton from 'material-ui/RaisedButton';

import DeleteModal from '../../components/DeleteModal';
import Notification from '../../components/vendor/react-notification';
import AvailabilityGrid from '../AvailabilityGrid';
import { checkStatus, parseJSON } from '../../util/fetch.util';
import { getCurrentUser } from '../../util/auth';
import styles from './event-details-component.css';
import ParticipantsList from '../../components/ParticipantsList';
import BestTimesDisplay from '../../components/BestTimeDisplay';

class EventDetailsComponent extends React.Component {
  constructor(props) {
    super(props);
    const eventParticipantsIds = props.event.participants.map(participant => participant.userId);
    const { event } = props;

    const ranges = event.dates.map(({ fromDate, toDate }) => ({
      from: new Date(fromDate),
      to: new Date(toDate),
    }));

    const dates = event.dates.map(({ fromDate, toDate }) => ({
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
    }));

    this.state = {
      event,
      ranges,
      dates,
      user: {},
      eventParticipantsIds,
      participants: event.participants,
      showHeatmap: false,
      myAvailability: [],
      notificationIsActive: false,
      notificationMessage: '',
      notificationTitle: '',
      showEmail: false,
    };
  }

  async componentWillMount() {
    const { event } = this.state;
    const user = await getCurrentUser();
    if (user) {
      let showHeatmap = false;
      let myAvailability = [];

      const me = this.state.participants.find(participant =>
        participant.userId === user._id,
      );

      if (me && me.availability) {
        showHeatmap = true;
        myAvailability = me.availability;
      }

      this.setState({ user, showHeatmap, myAvailability });
    }
  }

  componentDidMount() {
    setTimeout(() => {
      $('.alt').each((i, el) => {
        $(el).parents('.card').find('#best')
          .remove();
      });
    }, 100);

    $('.notification-bar-action').on('click', () => {
      this.setState({ notificationIsActive: false, showEmail: false });
    });
  }

  selectElementContents(el) {
    let range;
    if (window.getSelection && document.createRange) {
      range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (document.body && document.body.createTextRange) {
      range = document.body.createTextRange();
      range.moveToElementText(el);
      range.select();
    }
  }

  @autobind
  async joinEvent() {
    const { name, avatar, _id: userId } = this.state.user;

    const participant = { name, avatar, userId };

    const event = update(this.state.event, { $set: this.state.event });
    const observerEvent = jsonpatch.observe(event);

    event.participants.push(participant);

    const eventParticipantsIds = update(this.state.eventParticipantsIds, {
      $push: [this.state.user._id],
    });

    nprogress.configure({ showSpinner: false });
    nprogress.start();

    const patches = jsonpatch.generate(observerEvent);
    const response = await fetch(`/api/events/${event._id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      method: 'PATCH',
      body: JSON.stringify(patches),
    });

    try {
      checkStatus(response);
    } catch (err) {
      console.log(err);
      this.setState({
        notificationIsActive: true,
        notificationMessage: 'Failed to join event. Please try again later.',
        notificationTitle: 'Error!',
        showEmail: false,
      });
      return;
    } finally {
      nprogress.done();
      this.sendEmailOwner(event);
    }

    this.setState({ event, eventParticipantsIds });
  }

  async loadOwnerData(_id) {
    const response = await fetch(`/api/user/${_id}`, { credentials: 'same-origin' });
    try {
      checkStatus(response);
      return await parseJSON(response);
    } catch (err) {
      console.log('loadOwnerData', err);
      this.addNotification('Error!!', 'Failed to load owner Data. Please try again later.');
      return null;
    }
  }

  async sendEmailOwner(event) {
    const { name } = this.state.user;
    const fullUrl = `${location.protocol}//${location.hostname}${(location.port ? `:${location.port}` : '')}`;
    const ownerData = await this.loadOwnerData(event.owner);
    const msg = {
      guestName: name,
      eventName: event.name,
      eventId: event._id,
      eventOwner: event.owner,
      url: `${fullUrl}/event/${event._id}`,
      to: ownerData.emails[0],
      subject: 'Invite Accepted!!',
    };
    const response = await fetch('/api/email/ownerNotification', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      method: 'POST',
      body: JSON.stringify(msg),
    });

    try {
      checkStatus(response);
    } catch (err) {
      console.log('sendEmailOwner', err);
      this.setState({
        notificationIsActive: true,
        notificationMessage: 'Failed to send email for event Owner.',
        notificationTitle: 'Error!',
        showEmail: false,
      });
    }
  }

  @autobind
  showAvailability(ev) {
    document.getElementById('availability-grid').className = '';
    ev.target.className += ' hide';
  }

  @autobind
  editAvail() {
    this.setState({ showHeatmap: false }, () => {
      document.getElementById('enterAvailButton').click();
    });
  }

  @autobind
  async submitAvailability(myAvailability) {
    nprogress.configure({ showSpinner: false });
    nprogress.start();
    const response = await fetch(`/api/events/${this.state.event._id}`, {
      credentials: 'same-origin',
    });
    let event;

    try {
      checkStatus(response);
      event = await parseJSON(response);
    } catch (err) {
      console.log(err);
      this.setState({
        notificationIsActive: true,
        notificationMessage: 'Failed to update availability. Please try again later.',
        notificationTitle: 'Error!',
        showEmail: false,
      });
      return;
    } finally {
      nprogress.done();
    }

    this.setState({
      notificationIsActive: true,
      notificationMessage: 'Saved availability successfully.',
      notificationTitle: 'Success!',
      showEmail: false,
    });
    this.setState({ showHeatmap: true, myAvailability, event, participants: event.participants });
  }

  @autobind
  handleDelete(result) {
    if (result === true) {
      this.setState({
        notificationIsActive: true,
        notificationMessage: 'Event successfully deleted!',
        notificationTitle: 'Alert',
        showEmail: false,
      });
      browserHistory.push('/dashboard');
    } else {
      console.log('error at handleDelete EventDetailsComponent', result);
      this.setState({
        notificationIsActive: true,
        notificationMessage: 'Failed to delete event. Please try again later.',
        notificationTitle: 'Error!',
        showEmail: false,
      });
    }
  }

  @autobind
  shareEvent() {
    this.setState({
      notificationIsActive: true,
      notificationMessage: window.location.href,
      notificationTitle: 'Event URL:',
      showEmail: true,
    });
    setTimeout(() => {
      this.selectElementContents(document.getElementsByClassName('notification-bar-message')[0]);
    }, 100);
  }

  render() {
    const { event, user, showHeatmap, participants, myAvailability, eventParticipantsIds, showEmail, dates } = this.state;
    const availability = participants.map(participant => participant.availability);
    let isOwner;
    const styles = {
      card: {
        width: '510px',
        marginTop: '2%',
        cardTitle: {
          paddingBottom: 0,
          fontSize: '24px',
          paddingTop: 25,
          fontWeight: 300,
        },
        cardActions: {
          fontSize: '20px',
          paddingLeft: '5%',
          button: {
            marginLeft: '70%',
            color: '#F66036',

          },
        },
        divider: {
          width: '100%',
        },
      },
    };

    if (user !== undefined) {
      isOwner = event.owner === user._id;
    }

    const notifActions = [{
      text: 'Dismiss',
      handleClick: () => { this.setState({ notificationIsActive: false }); },
    }];

    if (showEmail) {
      notifActions.push({
        text: 'Email Event',
        handleClick: () => { window.location.href = `mailto:?subject=Schedule ${event.name}&body=Hey there,%0D%0A%0D%0AUsing the following tool, please block your availability for ${event.name}:%0D%0A%0D%0A${window.location.href} %0D%0A%0D%0A All times will automatically be converted to your local timezone.`; },
      });
    }

    return (
      <Card style={styles.card}>
        {isOwner ? <DeleteModal event={event} cb={this.handleDelete} /> : null}
        <CardTitle style={styles.card.cardTitle}>{event.name}</CardTitle>
        <CardText>
          <h6 id="best"><strong>All participants so far are available at:</strong></h6>
          <BestTimesDisplay event={event} disablePicker={true} />
          {(showHeatmap) ?
            <div id="heatmap">
              <AvailabilityGrid
                dates={dates}
                availability={availability}
                editAvail={this.editAvail}
                participants={participants}
                heatmap
              />
            </div> :
            <div id="grid" className="center">
              <div id="availability-grid" className="hide">
                <AvailabilityGrid
                  dates={dates}
                  user={user}
                  availability={availability}
                  myAvailability={myAvailability}
                  submitAvail={this.submitAvailability}
                  event={event}
                />
              </div>
              {(Object.keys(user).length > 0) ?
                (eventParticipantsIds.indexOf(user._id) > -1) ?
                  <RaisedButton
                    id="enterAvailButton"
                    backgroundColor="#28AEA1"
                    labelColor="#ffffff"
                    onClick={this.showAvailability}
                    label={'Enter my availability'}
                  />
                  :
                  <RaisedButton
                    onClick={this.joinEvent}
                    label={'Join Event'}
                    backgroundColor="#28AEA1"
                    labelColor="#ffffff"
                  />
                : null
              }
            </div>
          }
          <br />
          <ParticipantsList event={event} curUser={user} />
        </CardText>
        <Divider style={styles.card.divider} />
        <CardActions style={styles.card.cardActions}>
          <FlatButton style={styles.card.cardActions.button} onClick={this.shareEvent}>Share Event</FlatButton>
        </CardActions>
        <Notification
          isActive={this.state.notificationIsActive}
          message={this.state.notificationMessage}
          actions={notifActions}
          title={this.state.notificationTitle}
          onDismiss={() => this.setState({ notificationIsActive: false })}
          dismissAfter={10000}
          activeClassName="notification-bar-is-active"
        />
      </Card>
    );
  }
}

EventDetailsComponent.propTypes = {
  event: React.PropTypes.object,
};

export default cssModules(EventDetailsComponent, styles);