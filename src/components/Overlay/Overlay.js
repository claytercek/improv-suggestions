import React from 'react';
import Authentication from '../../util/Authentication/Authentication';

import './Overlay.css';

export default class Overlay extends React.Component {
  constructor(props) {
    super(props);
    this.Authentication = new Authentication();

    //if the extension is running on twitch or dev rig, set the shorthand here. otherwise, set to null.
    this.twitch = window.Twitch ? window.Twitch.ext : null;
    this.state = {
      finishedLoading: false,
      theme: 'light',
      isVisible: true,
      suggestion: {
        username: 'username',
        content: 'this is my suggestion',
      },
      colors: {
        primary: '#FFFAAA',
        secondary: '#000FFF',
      },
    };
  }

  contextUpdate(context, delta) {
    if (delta.includes('theme')) {
      this.setState(() => {
        return { theme: context.theme };
      });
    }
  }

  visibilityChanged(isVisible) {
    this.setState(() => {
      return {
        isVisible,
      };
    });
  }

  componentDidMount() {
    if (this.twitch) {
      this.twitch.onAuthorized(auth => {
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
        body = JSON.parse(body);
        switch (body.type) {
          case 'selectSuggestion':
            this.twitch.rig.log('updating list');
            this.setState({ suggestion: body.suggestion });
        }
      });

      this.twitch.onVisibilityChanged((isVisible, _c) => {
        this.visibilityChanged(isVisible);
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

  render() {

    const usernameStyle = {
      backgroundColor: this.state.colors.primary
    }

    const suggestionStyle = {
      backgroundColor: this.state.colors.secondary
    }

    if (this.state.finishedLoading && this.state.isVisible) {
      return (
        <div className="App">
          <div
            className={
              this.state.theme === 'light' ? 'App-light main' : 'App-dark main'
            }
          >
            <h3 id="username" style={usernameStyle}>
              {this.state.suggestion.username}
            </h3>
            <p id="suggestion" style={suggestionStyle}>
              {this.state.suggestion.content}
            </p>
          </div>
        </div>
      );
    } else {
      return <div className="App"></div>;
    }
  }
}
