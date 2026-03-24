/**
 * For AI phone / voice integrations — match SERVICE_API_KEY in .env
 * Accepts: X-Nail-Service-Key: <key> OR Authorization: Bearer <key>
 */
function readProvidedKey(req) {
  const raw = req.headers['x-nail-service-key'];
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim();
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function voiceServiceAuth(req, res, next) {
  const expected = (process.env.SERVICE_API_KEY || '').trim();
  if (!expected) {
    return res.status(503).json({ error: 'SERVICE_API_KEY is not configured on server' });
  }
  const provided = readProvidedKey(req);
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing X-Nail-Service-Key' });
  }
  next();
}

module.exports = voiceServiceAuth;
