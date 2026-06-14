const { SmsTemplate, SmsSettings } = require('../models');
const { formatNaiveUtcDisplay } = require('../utils/salonAppointmentDay');

const SALON = process.env.SALON_DISPLAY_NAME || 'Nice Nails & Spa';

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return require('twilio')(sid, token);
}

function normalizeE164(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (String(raw).startsWith('+')) return raw;
  return null;
}

function renderBody(body, vars) {
  return body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

async function getTemplate(type) {
  const row = await SmsTemplate.findOne({ where: { type } });
  if (row) return row;
  // Return default body if not seeded yet
  const body = SmsTemplate.DEFAULTS[type] || '';
  return { body, enabled: true };
}

async function sendSms(to, body) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from) throw new Error('Twilio not configured');
  const normalized = normalizeE164(to);
  if (!normalized) throw new Error(`Invalid phone: ${to}`);
  return client.messages.create({ from, to: normalized, body });
}

async function sendBookingConfirm({ name, phone, time, confirmation }) {
  const tpl = await getTemplate('booking_confirm');
  if (!tpl.enabled) return;
  const when = formatNaiveUtcDisplay(time);
  const body = renderBody(tpl.body, { name, time: when, salon: SALON, confirmation });
  await sendSms(phone, body);
}

async function sendEodThankYou({ name, phone }) {
  const tpl = await getTemplate('eod_thankyou');
  if (!tpl.enabled) return;
  const body = renderBody(tpl.body, { name, salon: SALON });
  await sendSms(phone, body);
}

async function sendBirthdaySms({ name, phone }) {
  const tpl = await getTemplate('birthday');
  if (!tpl.enabled) return;
  const body = renderBody(tpl.body, { name, salon: SALON });
  await sendSms(phone, body);
}

async function sendCheckinConfirm({ name, phone }) {
  const tpl = await getTemplate('checkin_confirm');
  if (!tpl.enabled) return;
  const body = renderBody(tpl.body, { name, salon: SALON });
  await sendSms(phone, body);
}

async function sendManagerBookingAlert({ customerName, customerPhone, serviceName, time, confirmation }) {
  const settings = await SmsSettings.findOne({ where: { id: 1 } });
  if (!settings?.managerPhone) return;
  const phones = settings.managerPhone.split(',').map((s) => s.trim()).filter(Boolean);
  if (!phones.length) return;
  const when = formatNaiveUtcDisplay(time);
  const body = `New booking: ${customerName} (${customerPhone}) — ${serviceName} at ${when}. Ref: ${confirmation}`;
  await Promise.all(phones.map((p) => sendSms(p, body)));
}

module.exports = { sendSms, sendBookingConfirm, sendCheckinConfirm, sendEodThankYou, sendBirthdaySms, sendManagerBookingAlert, normalizeE164 };
