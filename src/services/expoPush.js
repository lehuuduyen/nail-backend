const https = require('https');

/**
 * Send push notifications via Expo Push API.
 * tokens: array of ExponentPushToken[...] strings
 */
async function sendExpoPush(tokens, title, body, data = {}) {
  const valid = (tokens || []).filter(
    (t) => typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  if (!valid.length) return;

  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));

  const payload = JSON.stringify(messages);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendExpoPush };
