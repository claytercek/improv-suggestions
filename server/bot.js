const tmi = require('tmi.js');

// Define configuration options
const opts = {
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.BOT_PASSWORD,
  },
};

class Bot {
  constructor(options) {
    this.onSuggestion = (username, content, channel) =>
      options.onSuggestion(username, content, channel);
    this.channels = [];

    // Create a client with our options
    this.client = new tmi.client(opts);

    // Register our event handlers (defined below)
    this.client.on('message', this.onMessageHandler.bind(this));
    this.client.on('connected', this.onConnectedHandler.bind(this));

    // Connect to Twitch:
    this.client.connect();
  }

  startListening(channelName) {
    if (this.channels.includes(channelName)) return;
    this.client
      .join(channelName)
      .then(() => {
        this.channels.push(channelName);
      })
      .catch(err => {
        console.error(err);
      });
  }

  stopListening(channelName) {
    if (!this.channels.includes(channelName)) return;
    this.client.part(channelName).catch(() => {
      console.error('error disconnecting from ' + channelName);
    });
    this.channels.splice(this.channels.indexOf(channelName));
  }

  // Called every time a message comes in
  onMessageHandler(target, context, msg, self) {
    if (self) return; // Ignore messages from the bot

    // // Remove whitespace from chat message
    const commandName = msg.trim().split(' ')[0];

    if (commandName === '!suggest') {
      this.onSuggestion(
        context['display-name'],
        msg.substr(msg.indexOf(' ') + 1),
        target.substring(1)
      );
    }
  }

  // Called every time the bot connects to Twitch chat
  onConnectedHandler(addr, port) {
    console.log(`bot connected to ${addr}:${port}`);
  }
}

module.exports = Bot;
