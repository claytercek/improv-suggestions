require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const request = require('request');
const Bot = require("./bot");
const api = require("./api");
const express = require('express');
const logger = require('morgan');
const SuggestList = require('./suggestList');

var lists = {};
const myBot = new Bot({ onSuggestion: (username, content, channel) => onSuggestion(username, content, channel) });


const app = express();
const port = process.env.PORT || 8081;

app.post("/suggestion/start", suggestionStartHandler);
app.post("/suggestion/select", suggestionSelectHandler);

app.use((req, res, next) => {
  console.log("CORS")
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-twitch-jwt');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  // Note that the origin of an extension iframe will be null
  // so the Access-Control-Allow-Origin has to be wildcard.
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(logger('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {

  app.set('port', port);
  
  https.createServer({
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key'),
    requestCert: false
  }, app).listen(port, () => {console.log(`Certified server listening on port ${port}`)});

} else {
  app.listen(port, () => {console.log(`Server listening on port ${port}`)});
}

function suggestionStartHandler(req, res, next) {
  // Verify all requests.

  const token = api.verifyAndDecode(req.headers.authorization);

  if (token.error) {
    next(token.error);
  }

  api.getChannel(token.channel_id).then(dat => {

    console.log("starting suggestions on", dat.name);
    myBot.startListening(dat.name);
    lists[dat.name] = new SuggestList({id: token.channel_id});

    res.status(200).send("success");
    
  }).catch((err) => {
    console.log(err);
    next(err);
  })
  return 0;
}

function suggestionSelectHandler(req, res, next) {
  // Verify all requests.
  const payload = api.verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  console.dir(payload);
  attemptColorBroadcast(channelId);
  return 0;
}

function attemptColorBroadcast(channelId) {
  // Check the cool-down to determine if it's okay to send now.
  const now = Date.now();
  const cooldown = channelCooldowns[channelId];
  if (!cooldown || cooldown.time < now) {
    // It is.
    sendColorBroadcast(channelId);
    channelCooldowns[channelId] = { time: now + channelCooldownMs };
  } else if (!cooldown.trigger) {
    // It isn't; schedule a delayed broadcast if we haven't already done so.
    cooldown.trigger = setTimeout(sendColorBroadcast, now - cooldown.time, channelId);
  }
}

function onSuggestion(username, content, channel) {
  lists[channel].addSuggestion(username, content);
  sendListUpdate(channel);
}

function sendListUpdate(channel) {
  const headers = {
    'Client-ID': api.clientId,
    'Content-Type': 'application/json',
    'Authorization': api.makeServerToken(lists[channel].getId()),
  };
  // Create the POST body for the Twitch API request.
  const message = JSON.stringify({
    type: "updateList",
    suggestions: lists[channel].getSuggestions()
  })

  const body = JSON.stringify({
    content_type: 'application/json',
    message,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  request(
    `https://api.twitch.tv/extensions/message/${lists[channel].getId()}`,
    {
      method: 'POST',
      headers,
      body,
    }
    , (err, res) => {
      if (err) {
        console.log("error sending list update", channel, err);
      } else {
        console.log("success sending list update", channel, res.statusCode);
      }
    });
}

function sendColorBroadcast(channelId) {
  // Set the HTTP headers required by the Twitch API.
  const headers = {
    'Client-ID': api.clientId,
    'Content-Type': 'application/json',
    'Authorization': api.makeServerToken(channelId),
  };

  // Create the POST body for the Twitch API request.
  const body = JSON.stringify({
    content_type: 'application/json',
    message: "TEST !@#",
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  request(
    `https://api.twitch.tv/extensions/message/${channelId}`,
    {
      method: 'POST',
      headers,
      body,
    }
    , (err, res) => {
      if (err) {
        console.log("error sending pubsub", channelId, err);
      } else {
        console.log("success sending pubsub", channelId, res.statusCode);
      }
    });
}