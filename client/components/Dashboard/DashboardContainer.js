import React from 'react';
import { browserHistory } from 'react-router';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../../actions';
import Dashboard from './DashboardPresentation';
import { isAuthenticated } from '../../util/auth';

class DashboardContainer extends React.PureComponent {
  constructor() {
    super();
    this.state = {
      showNoScheduledMessage: false,
      notificationIsActive: false,
      notificationMessage: '',
    };
  }

  async componentWillMount() {
    if (sessionStorage.getItem('redirectTo')) {
      browserHistory.push(sessionStorage.getItem('redirectTo'));
      sessionStorage.removeItem('redirectTo');
    }

    if (!await isAuthenticated()) browserHistory.push('/');

    this.props.actions.requestEvents();
  }

  render() {
    const { showNoScheduledMessage } = this.state;
    const { events } = this.props;
    const childProps = { showNoScheduledMessage, events };

    return (
      <Dashboard
        removeEventFromDashboard={this.removeEventFromDashboard}
        {...childProps}
      />
    );
  }
}

DashboardContainer.propTypes = {
  events: React.PropTypes.arrayOf(React.PropTypes.object),
  actions: React.PropTypes.shape({
    requestEvents: React.PropTypes.func,
  }),
};

const mapStateToProps = state => ({
  events: state.events,
});

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(Actions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(DashboardContainer);