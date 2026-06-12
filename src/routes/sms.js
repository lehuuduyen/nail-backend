const express = require('express');
const router = express.Router();
const { SmsTemplate, SmsSettings } = require('../models');
const { sendSms, normalizeE164 } = require('../services/smsService');

// GET /api/sms/templates
router.get('/templates', async (req, res, next) => {
  try {
    const types = ['booking_confirm', 'eod_thankyou', 'birthday'];
    const rows = await SmsTemplate.findAll();
    const map = {};
    rows.forEach((r) => { map[r.type] = r; });

    const templates = types.map((type) => ({
      type,
      body: map[type]?.body ?? SmsTemplate.DEFAULTS[type] ?? '',
      enabled: map[type]?.enabled ?? true,
    }));
    res.json({ templates });
  } catch (err) { next(err); }
});

// PUT /api/sms/templates/:type
router.put('/templates/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const validTypes = ['booking_confirm', 'eod_thankyou', 'birthday'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const { body, enabled } = req.body;
    const [row, created] = await SmsTemplate.findOrCreate({
      where: { type },
      defaults: { body: body ?? SmsTemplate.DEFAULTS[type], enabled: enabled ?? true },
    });
    if (!created) {
      const updates = {};
      if (body !== undefined) updates.body = body;
      if (enabled !== undefined) updates.enabled = enabled;
      await row.update(updates);
      await row.reload();
    }
    res.json({ template: { type: row.type, body: row.body, enabled: row.enabled } });
  } catch (err) { next(err); }
});

// GET /api/sms/settings
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await SmsSettings.findOne({ where: { id: 1 } });
    if (!settings) settings = await SmsSettings.create({ id: 1 });
    res.json({
      eodTime: settings.eodTime,
      birthdayTime: settings.birthdayTime,
      eodEnabled: settings.eodEnabled,
      birthdayEnabled: settings.birthdayEnabled,
      managerPhone: settings.managerPhone || null,
    });
  } catch (err) { next(err); }
});

// PUT /api/sms/settings
router.put('/settings', async (req, res, next) => {
  try {
    const { eodTime, birthdayTime, eodEnabled, birthdayEnabled, managerPhone } = req.body;
    let settings = await SmsSettings.findOne({ where: { id: 1 } });
    if (!settings) settings = await SmsSettings.create({ id: 1 });
    const updates = {};
    if (eodTime !== undefined) updates.eodTime = eodTime;
    if (birthdayTime !== undefined) updates.birthdayTime = birthdayTime;
    if (eodEnabled !== undefined) updates.eodEnabled = eodEnabled;
    if (birthdayEnabled !== undefined) updates.birthdayEnabled = birthdayEnabled;
    if (managerPhone !== undefined) updates.managerPhone = managerPhone;
    await settings.update(updates);
    await settings.reload();
    res.json({
      eodTime: settings.eodTime,
      birthdayTime: settings.birthdayTime,
      eodEnabled: settings.eodEnabled,
      birthdayEnabled: settings.birthdayEnabled,
      managerPhone: settings.managerPhone || null,
    });
  } catch (err) { next(err); }
});

// POST /api/sms/test  { to, type }
router.post('/test', async (req, res, next) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) return res.status(400).json({ error: 'to and body required' });
    const normalized = normalizeE164(to);
    if (!normalized) return res.status(400).json({ error: 'Invalid phone number' });
    await sendSms(normalized, body);
    res.json({ success: true, to: normalized });
  } catch (err) { next(err); }
});

module.exports = router;
