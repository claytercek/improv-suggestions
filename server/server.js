require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const request = require('request');
const Bot = require('./bot');
const api = require('./api');
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const SuggestList = require('./suggestList');

var lists = {};
const myBot = new Bot({
  onSuggestion: (username, content, channel) =>
    onSuggestion(username, content, channel),
});

const app = express();
const port = process.env.PORT || 8081;

app.use(bodyParser.json());
app.use('/frontend', express.static(path.join(__dirname, '..', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-twitch-jwt'
  );
  // Note that the origin of an extension iframe will be null
  // so the Access-Control-Allow-Origin has to be wildcard.
  next();
});

app.use(logger('dev'));

app.post('/suggestion/start', suggestionStartHandler);
app.post('/suggestion/select', suggestionSelectHandler);
app.post('/suggestion/cancel', suggestionCancelHandler);

const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
if (
  fs.existsSync(serverPathRoot + '.crt') &&
  fs.existsSync(serverPathRoot + '.key')
) {
  app.set('port', port);

  https
    .createServer(
      {
        // If you need a certificate, execute "npm run cert".
        cert: fs.readFileSync(serverPathRoot + '.crt'),
        key: fs.readFileSync(serverPathRoot + '.key'),
        requestCert: false,
      },
      app
    )
    .listen(port, () => {
      console.log(`Certified server listening on port ${port}`);
    });
} else {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

function suggestionStartHandler(req, res, next) {
  // Verify all requests.

  const token = api.verifyAndDecode(req.headers.authorization);

  if (token.error) {
    next(token.error);
  }

  api
    .getChannel(token.channel_id)
    .then(dat => {
      console.log('starting suggestions on', dat.name);
      myBot.startListening(dat.name);
      lists[dat.name] = new SuggestList({ id: token.channel_id });

      res.status(200).send('success');
    })
    .catch(err => {
      console.log(err);
      next(err);
    });
}

function suggestionSelectHandler(req, res, next) {
  // Verify all requests.

  const token = api.verifyAndDecode(req.headers.authorization);
  if (token.error) {
    next(token.error);
  }

  let index = req.body.index;
  if (index == null) {
    return next('no index given');
  }

  const payload = api.verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;

  api
    .getChannel(token.channel_id)
    .then(dat => {
      console.log('selecting suggestion for', dat.name);

      if (!lists[dat.name]) {
        return next('not tracking channel ' + dat.name);
      }
      if (index >= lists[dat.name].getSuggestions()) {
        return next('index out of range');
      }

      sendSelectedSuggestion(lists[dat.name].getSuggestion(index), dat.name);

      myBot.stopListening(dat.name);
      delete lists[dat.name];

      res.status(200).send('success');
    })
    .catch(err => {
      console.log(err);
      next(err);
    });
}

function suggestionCancelHandler(req, res, next) {
  // Verify all requests.

  const token = api.verifyAndDecode(req.headers.authorization);

  if (token.error) {
    next(token.error);
  }

  api
    .getChannel(token.channel_id)
    .then(dat => {
      console.log('canceling suggestions on', dat.name);
      myBot.stopListening(dat.name);
      delete lists[dat.name];
      res.status(200).send('success');
    })
    .catch(err => {
      console.log(err);
      next(err);
    });
}

function onSuggestion(username, content, channel) {
  lists[channel].addSuggestion(username, content);
  sendListUpdate(channel);
}

function sendListUpdate(channel) {
  const headers = {
    'Client-ID': api.clientId,
    'Content-Type': 'application/json',
    Authorization: api.makeServerToken(lists[channel].getId()),
  };
  // Create the POST body for the Twitch API request.
  const message = JSON.stringify({
    type: 'updateList',
    suggestions: lists[channel].getSuggestions(),
  });

  const body = JSON.stringify({
    content_type: 'application/json',
    message,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  return new Promise((resolve, reject) => {
    request(
      `https://api.twitch.tv/extensions/message/${lists[channel].getId()}`,
      {
        method: 'POST',
        headers,
        body,
      },
      (err, res) => {
        if (err) {
          console.log('error sending list update', channel, err);
          reject(err);
        } else {
          console.log('success sending list update', channel, res.statusCode);
          resolve();
        }
      }
    );
  });
}

function sendSelectedSuggestion(suggestion, channel) {
  const headers = {
    'Client-ID': api.clientId,
    'Content-Type': 'application/json',
    Authorization: api.makeServerToken(lists[channel].getId()),
  };
  // Create the POST body for the Twitch API request.
  const message = JSON.stringify({
    type: 'selectSuggestion',
    suggestion,
  });

  const body = JSON.stringify({
    content_type: 'application/json',
    message,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  return new Promise((resolve, reject) => {
    request(
      `https://api.twitch.tv/extensions/message/${lists[channel].getId()}`,
      {
        method: 'POST',
        headers,
        body,
      },
      (err, res) => {
        if (err) {
          console.log('error sending selected suggestion', channel, err);
          reject(err);
        } else {
          console.log(
            'success sending selected suggestion',
            channel,
            res.statusCode
          );
          resolve();
        }
      }
    );
  });
}
