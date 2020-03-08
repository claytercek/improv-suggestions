import React from 'react';
import Authentication from '../../util/Authentication/Authentication';

import './LiveConfigPage.css';

export default class LiveConfigPage extends React.Component {
  constructor(props) {
    super(props);
    this.Authentication = new Authentication();

    //if the extension is running on twitch or dev rig, set the shorthand here. otherwise, set to null.
    this.twitch = window.Twitch ? window.Twitch.ext : null;
    this.state = {
      finishedLoading: false,
      theme: 'light',
      help: 'test 123',
      inProgress: false,
      suggestions: [],
    };

    this.startSuggestion = this.startSuggestion.bind(this);
    this.cancelSuggestion = this.cancelSuggestion.bind(this);
    this.pickSuggestion = this.pickSuggestion.bind(this);
  }

  contextUpdate(context, delta) {
    if (delta.includes('theme')) {
      this.setState(() => {
        return { theme: context.theme };
      });
    }
  }

  componentDidMount() {
    if (this.twitch) {
      this.twitch.onAuthorized(auth => {
        this.twitch.rig.log(auth.token);
        this.Authentication.setToken(auth.token, auth.userId);
        if (!this.state.finishedLoading) {
          // if the component hasn't finished loading (as in we've not set up after getting a token), let's set it up now.

          // now we've done the setup for the component, let's set the state to true to force a rerender with the correct data.
          this.setState(() => {
            return { finishedLoading: true };
          });
        }
      });

      this.twitch.listen('broadcast', (target, contentType, body) => {
        this.twitch.rig.log(
          `New PubSub message!\n${target}\n${contentType}\n${body}`
        );
        body = JSON.parse(body);
        switch (body.type) {
          case 'updateList':
            this.twitch.rig.log('updating list');
            this.setState({ suggestions: body.suggestions, inProgress: true });
            console.log(this.state.suggestions);
        }
      });

      this.twitch.onContext((context, delta) => {
        this.contextUpdate(context, delta);
      });
    }
  }

  componentWillUnmount() {
    if (this.twitch) {
      this.twitch.unlisten('broadcast', () =>
        console.log('successfully unlistened')
      );
    }
  }

  startSuggestion() {
    this.twitch.rig.log(`Initiating suggestions`);
    this.Authentication.makeCall('/suggestion/start', 'POST')
      .then(res => {
        if (res.data == 'success') {
          this.twitch.rig.log('listening for suggestions');
          this.setState({ inProgress: true });
        }
      })
      .catch(err => {
        this.twitch.rig.log('err');
      });
  }

  pickSuggestion(index) {
    this.twitch.rig.log(`Initiating suggestions`);
    this.Authentication.makeCall('/suggestion/select', 'POST', { index })
      .then(res => {
        if (res.data == 'success') {
          this.twitch.rig.log('successfully picked');
          this.setState({ inProgress: false, suggestions: [] });
        }
      })
      .catch(err => {
        this.twitch.rig.log('err');
      });
  }

  cancelSuggestion() {
    this.twitch.rig.log(`Canceling suggestions`);
    this.Authentication.makeCall('/suggestion/cancel', 'POST')
      .then(res => {
        this.twitch.rig.log('successfully canceled');
        this.setState({ inProgress: false, suggestions: [] });
      })
      .catch(err => {
        this.twitch.rig.log('err');
      });
  }

  render() {
    if (this.state.finishedLoading) {
      return (
        <div className="LiveConfigPage">
          <div
            className={
              this.state.theme === 'light'
                ? 'LiveConfigPage-light'
                : 'LiveConfigPage-dark'
            }
          >
            <p>Hello world!</p>
            <p>This is the live config page! {this.state.help}</p>
            {(this.state.inProgress && (
              <div>
                <button onClick={this.cancelSuggestion}>cancel</button>
                <ul>
                  {this.state.suggestions.map((item, index) => (
                    <li key={item.index}>
                      <button onClick={() => this.pickSuggestion(index)}>
                        <h3>{item.username}</h3>
                        <p>{item.content}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )) || (
              <div>
                <button onClick={this.startSuggestion}>start suggestion</button>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return <div className="LiveConfigPage"></div>;
    }
  }
}
