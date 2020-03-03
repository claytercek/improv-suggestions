import React from 'react'
import Authentication from '../../util/Authentication/Authentication'
import axios from 'axios'

import './LiveConfigPage.css'

export default class LiveConfigPage extends React.Component {
  constructor(props) {
    super(props)
    this.Authentication = new Authentication()

    //if the extension is running on twitch or dev rig, set the shorthand here. otherwise, set to null. 
    this.twitch = window.Twitch ? window.Twitch.ext : null
    this.state = {
      finishedLoading: false,
      theme: 'light'
    }

    this.startSuggestion = this.startSuggestion.bind(this);
  }

  contextUpdate(context, delta) {
    if (delta.includes('theme')) {
      this.setState(() => {
        return { theme: context.theme }
      })
    }
  }

  componentDidMount() {
    if (this.twitch) {
      this.twitch.onAuthorized((auth) => {
        this.twitch.rig.log(auth.token)
        this.Authentication.setToken(auth.token, auth.userId)
        if (!this.state.finishedLoading) {
          // if the component hasn't finished loading (as in we've not set up after getting a token), let's set it up now.

          // now we've done the setup for the component, let's set the state to true to force a rerender with the correct data.
          this.setState(() => {
            return { finishedLoading: true }
          })
        }
      })

      this.twitch.listen('broadcast', (target, contentType, body) => {
        this.twitch.rig.log(`New PubSub message!\n${target}\n${contentType}\n${body}`)
        // now that you've got a listener, do something with the result... 

        // do something...

      })

      this.twitch.onContext((context, delta) => {
        this.contextUpdate(context, delta)
      })
    }
  }

  componentWillUnmount() {
    if (this.twitch) {
      this.twitch.unlisten('broadcast', () => console.log('successfully unlistened'))
    }
  }

  startSuggestion() {
    this.twitch.rig.log(`Initiating suggestions`);
    this.Authentication.makeCall("https://localhost:8081/suggestion/start", "POST", "").then(res => {
      this.twitch.rig.log(res);
      this.twitch.rig.log("hello world?");
    }).catch(err => {
      this.twitch.rig.log(err);
      this.twitch.rig.log("hello world? 123");
    });
  }

  render() {
    if (this.state.finishedLoading) {
      return (
        <div className="LiveConfigPage">
          <div className={this.state.theme === 'light' ? 'LiveConfigPage-light' : 'LiveConfigPage-dark'} >
            <p>Hello world!</p>
            <p>This is the live config page! </p>
          </div>
          <button onClick={this.startSuggestion}>start suggestion</button>
        </div>
      )
    } else {
      return (
        <div className="LiveConfigPage">
        </div>
      )
    }

  }
}