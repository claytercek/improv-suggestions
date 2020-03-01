require('dotenv').config();
const fs = require('fs');
const Hapi = require('hapi');
const path = require('path');
const request = require('request');
const Bot = require("./bot");
const api = require("./api");

const myBot = new Bot({ onSuggestion: () => { } });

// Use verbose logging during development.  Set this to false for production.
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => { };

// Service state variables
const serverTokenDurationSec = 30;          // our tokens for pubsub expire after 30 seconds
const userCooldownMs = 1000;                // maximum input rate per user to prevent bot abuse
const userCooldownClearIntervalMs = 60000;  // interval to reset our tracking object
const channelCooldownMs = 1000;             // maximum broadcast rate per channel
const channelCooldowns = {};                // rate limit compliance
let userCooldowns = {};                     // spam prevention


const serverOptions = {
  host: 'localhost',
  port: 8081,
  routes: {
    cors: {
      origin: ['*'],
    },
  },
};

const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {
  serverOptions.tls = {
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key'),
  };
}
const server = new Hapi.Server(serverOptions);

(async () => {

  // Handle broadcaster request to pick specific suggestion.
  server.route({
    method: 'POST',
    path: '/suggestion/select',
    handler: suggestionSelectHandler,
  });


  server.route({
    method: 'POST',
    path: '/suggestion/start',
    handler: suggestionStartHandler,
  });

  // Start the server.
  await server.start();
  console.log("Server started on", server.info.uri);

  // Periodically clear cool-down tracking to prevent unbounded growth due to
  // per-session logged-out user tokens.
  setInterval(() => { userCooldowns = {}; }, userCooldownClearIntervalMs);
})();

function suggestionStartHandler(req) {
  // Verify all requests.
  const token = api.verifyAndDecode(req.headers.authorization);
  api.getChannel(token.channel_id).then(res => {
    console.log(res);
  }).catch((err) => {
    console.log(err);
  })
  return 0;
}

function suggestionSelectHandler(req) {
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

function sendColorBroadcast(channelId) {
  // Set the HTTP headers required by the Twitch API.
  const headers = {
    'Client-ID': clientId,
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
        verboseLog("success sending pubsub", channelId, res.statusCode);
      }
    });
}