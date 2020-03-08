const Boom = require('boom');
const jsonwebtoken = require('jsonwebtoken');
const twitch_api = require('twitch-api-v5');

const ownerId = process.env.EXT_OWNER_ID;
const secret = Buffer.from(process.env.EXT_SECRET, 'base64');
const clientId = process.env.CLIENT_ID;

twitch_api.clientID = clientId;

const bearerPrefix = 'Bearer '; // HTTP authorization headers have this prefix
const serverTokenDurationSec = 30; // our tokens for pubsub expire after 30 seconds

const STRINGS = {
  serverStarted: 'Server running at %s',
  messageSendError: 'Error sending message to channel %s: %s',
  pubsubResponse: 'Message to c:%s returned %s',
  invalidAuthHeader: 'Invalid authorization header',
  invalidJwt: 'Invalid JWT',
};

// Verify the header and the enclosed JWT.
function verifyAndDecode(header) {
  if (header && header.startsWith(bearerPrefix)) {
    try {
      const token = header.substring(bearerPrefix.length);
      return jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] });
    } catch (ex) {
      console.log('unauthorized');
      throw Boom.unauthorized(STRINGS.invalidJwt);
    }
  }
  return { error: STRINGS.invalidAuthHeader };
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
    channel_id: channelId,
    user_id: ownerId, // extension owner ID for the call to Twitch PubSub
    role: 'external',
    pubsub_perms: {
      send: ['*'],
    },
  };
  return (
    bearerPrefix + jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' })
  );
}

function getChannel(channelId) {
  return new Promise((resolve, reject) => {
    twitch_api.channels.channelByID({ channelID: channelId }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

module.exports = {
  verifyAndDecode,
  makeServerToken,
  getChannel,
  clientId,
  ownerId,
  secret,
};
