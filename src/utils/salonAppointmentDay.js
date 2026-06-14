const { sequelize } = require('../models');

function salonTimezone() {
  return process.env.SALON_TIMEZONE || 'America/Phoenix';
}

async function getSalonTimezone() {
  try {
    const { SmsSettings } = require('../models');
    const s = await SmsSettings.findOne({ where: { id: 1 } });
    return s?.timezone || process.env.SALON_TIMEZONE || 'America/Phoenix';
  } catch {
    return process.env.SALON_TIMEZONE || 'America/Phoenix';
  }
}

/**
 * `dateStr` đã validate YYYY-MM-DD.
 * Điều kiện: ngày theo lịch salon (timezone) của scheduledAt = dateStr.
 */
function scheduledAtOnSalonDateLiteral(dateStr) {
  const tz = salonTimezone().replace(/'/g, "''");
  const d = dateStr.replace(/'/g, "''");
  return sequelize.literal(
    `(timezone('${tz}', "Appointment"."scheduledAt"))::date = '${d}'::date`
  );
}

/**
 * Format một naive-UTC timestamp thành giờ địa phương hiển thị
 * (dùng UTC components vì appointments lưu theo convention naive-UTC).
 */
function formatNaiveUtcDisplay(isoStr, tz) {
  const d = new Date(isoStr);
  // Appointments stored as naive UTC (local clock time = UTC digits)
  // Extract UTC components directly — they represent the intended local time
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  const minStr = String(mm).padStart(2, '0');

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();

  return `${month} ${day}, ${year}, ${h12}:${minStr} ${ampm}`;
}

module.exports = {
  salonTimezone,
  getSalonTimezone,
  scheduledAtOnSalonDateLiteral,
  formatNaiveUtcDisplay,
};
