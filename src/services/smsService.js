const { SmsTemplate, SmsSettings } = require('../models');
const { formatNaiveUtcDisplay } = require('../utils/salonAppointmentDay');

const SALON = process.env.SALON_DISPLAY_NAME || 'Nice Nails & Spa';

/**
 * Extra line appended to the booking confirmation when the customer is booking
 * for the first time (phone never seen in the Appointment table). The SMS is the
 * "proof" the customer shows staff at checkout — staff apply the $5 off by hand.
 * Kept accent-free so each locale stays within a single GSM-7 SMS segment (A2P).
 * Selected by booking locale; falls back to English. To make this editable from
 * the admin later, swap this map for an SmsSettings/SmsTemplate lookup.
 */
const NEW_CUSTOMER_OFFER = {
  en: 'As a new customer you get $5 OFF your first visit. Show this text to our staff at checkout.',
  es: 'Como cliente nuevo obtienes $5 de descuento en tu primera visita. Muestra este mensaje a nuestro personal al pagar.',
  vi: 'La khach moi, ban duoc giam $5 cho lan dau. Vui long dua tin nhan nay cho nhan vien khi thanh toan.',
};

/**
 * Effective offer line for a locale, honoring the admin override stored in
 * SmsSettings (newCustomerOfferEn/Es/Vi). Empty/whitespace override → built-in
 * default. `settings` may be null (table not seeded) → always defaults.
 */
function newCustomerOfferLine(locale, settings = null) {
  const lang = NEW_CUSTOMER_OFFER[locale] ? locale : 'en';
  const overrideKey = `newCustomerOffer${lang.charAt(0).toUpperCase()}${lang.slice(1)}`;
  const override = settings?.[overrideKey];
  return (override && override.trim()) || NEW_CUSTOMER_OFFER[lang];
}

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

async function sendBookingConfirm({ name, phone, time, confirmation, technicianName = '', notes = '', isNewCustomer = false, locale = 'en' }) {
  const tpl = await getTemplate('booking_confirm');
  if (!tpl.enabled) return;
  const when = formatNaiveUtcDisplay(time);
  // {technician} = " with [Name]" when specific tech was chosen, "" when anyone
  const technician = technicianName ? ` with ${technicianName}` : '';
  // {notes} = "\nSpecial requests: ..." when non-empty, "" otherwise
  const notesVar = notes ? `\nSpecial requests: ${notes}` : '';
  let body = renderBody(tpl.body, { name, time: when, salon: SALON, confirmation, technician, notes: notesVar });
  // First-time customer → append the $5-off offer line (their "proof" at checkout),
  // unless an admin turned the offer off in SMS Settings.
  if (isNewCustomer) {
    const settings = await SmsSettings.findOne({ where: { id: 1 } });
    if (settings?.newCustomerOfferEnabled !== false) {
      body += `\n${newCustomerOfferLine(locale, settings)}`;
    }
  }
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

async function sendManagerBookingAlert({ customerName, customerPhone, serviceName, time, confirmation, technicianName = '', notes = '', isNewCustomer = false }) {
  const tpl = await getTemplate('manager_booking_alert');
  if (!tpl.enabled) return;
  const settings = await SmsSettings.findOne({ where: { id: 1 } });
  if (!settings?.managerPhone) return;
  const phones = settings.managerPhone.split(',').map((s) => s.trim()).filter(Boolean);
  if (!phones.length) return;
  const when = formatNaiveUtcDisplay(time);
  // {technician} = " with [Name]" when specific tech was chosen, "" when anyone
  const technician = technicianName ? ` with ${technicianName}` : '';
  // {notes} = "\nSpecial requests: ..." when non-empty, "" otherwise
  const notesVar = notes ? `\nSpecial requests: ${notes}` : '';
  let body = renderBody(tpl.body, {
    name: customerName,
    phone: customerPhone,
    service: serviceName,
    time: when,
    confirmation,
    technician,
    notes: notesVar,
  });
  // Flag first-time customers so staff know to apply the $5 first-visit discount.
  if (isNewCustomer) {
    body += '\n** NEW CUSTOMER ** (first visit - apply $5 off)';
  }
  await Promise.all(phones.map((p) => sendSms(p, body)));
}

module.exports = { sendSms, sendBookingConfirm, sendCheckinConfirm, sendEodThankYou, sendBirthdaySms, sendManagerBookingAlert, normalizeE164, NEW_CUSTOMER_OFFER };
