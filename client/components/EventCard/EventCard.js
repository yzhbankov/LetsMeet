import React, { Component } from 'react';
import cssModules from 'react-css-modules';
import autobind from 'autobind-decorator';
import { browserHistory } from 'react-router';
import { Card, CardActions, CardTitle, CardText } from 'material-ui/Card';
import FlatButton from 'material-ui/FlatButton';
import Divider from 'material-ui/Divider';
import { Notification } from 'react-notification';
import BestTimesDisplay from '../BestTimeDisplay/BestTimeDisplay';
import ParticipantsList from '../ParticipantsList/ParticipantsList';
import DeleteModal from '../DeleteModal/DeleteModal';
import styles from './event-card.css';

class EventCard extends Component {
  constructor(props) {
    super(props);

    const { event, curUser } = props;
    this.state = {
      participants: props.event.participants,
      event,
      curUser,
      notificationMessage: '',
      notificationIsActive: false,
      notificationTitle: '',
    };
  }

  @autobind
  redirectToEvent() {
    browserHistory.push(`/event/${this.state.event._id}`);
  }

  @autobind
  handleDelete(id) {
    this.props.cbDeleteEvent(id);
  }

  @autobind
  handleShowInviteGuestsDrawer() {
    const { event } = this.state;
    this.props.showInviteGuests(event);
  }

  render() {
    const { event, curUser, notificationIsActive, notificationMessage, notificationTitle } = this.state;
    let isOwner;

    if (curUser !== undefined) {
      isOwner = event.owner === curUser._id;
    }

    return (
      <Card styleName="card">
        {
          isOwner ? <DeleteModal event={event} cbEventDelete={this.handleDelete} /> : null
        }
        <CardTitle styleName="cardTitle">
          {event.name}
        </CardTitle>
        <CardText>
          <BestTimesDisplay event={event} disablePicker={false} />
          <ParticipantsList event={event} curUser={curUser} showInviteGuests={this.handleShowInviteGuestsDrawer} />
        </CardText>
        <Divider style={styles.card.divider} />
        <CardActions styleName="cardActions">
          <FlatButton styleName="viewDetailsButton" onClick={this.redirectToEvent}>View Details</FlatButton>
        </CardActions>
        <Notification
          isActive={notificationIsActive}
          message={notificationMessage}
          action="Dismiss"
          title={notificationTitle}
          onDismiss={() => this.setState({ notificationIsActive: false })}
          onClick={() => this.setState({ notificationIsActive: false })}
          activeClassName="notification-bar-is-active"
        />
      </Card>
    );
  }
}

EventCard.propTypes = {
  event: React.PropTypes.object,
  cbDeleteEvent: React.PropTypes.func,
  cb: React.PropTypes.func,
  showInviteGuests: React.PropTypes.func,
  curUser: React.PropTypes.object,
};

export default cssModules(EventCard, styles);
