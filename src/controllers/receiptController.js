const twilio = require('twilio');

async function sendSmsReceipt(req, res) {
  try {
    const { to, transactionId, body: textBody } = req.body || {};
    if (!to || String(to).trim() === '') {
      return res.status(400).json({ success: false, error: 'to (phone E.164) required' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !from) {
      return res.status(503).json({
        success: false,
        error: 'SMS not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)',
      });
    }

    const client = twilio(accountSid, authToken);
    const body =
      textBody ||
      `Thank you! Your payment was received${
        transactionId != null ? ` (ref #${transactionId})` : ''
      }.`;

    await client.messages.create({
      from,
      to: String(to).trim(),
      body,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[Receipt] SMS', err.message);
    return res.status(502).json({
      success: false,
      error: err.message || 'Failed to send SMS',
    });
  }
}

module.exports = { sendSmsReceipt };
