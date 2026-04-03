const { sequelize } = require('../models');

/**
 * Múi giờ salon — phải khớp EXPO_PUBLIC_SALON_TIMEZONE trên POS (vd America/Phoenix).
 * Dùng để so khớp ngày lịch với `scheduledAt` (timestamptz) trong Postgres.
 */
function salonTimezone() {
  return process.env.SALON_TIMEZONE || 'America/Phoenix';
}

/**
 * `dateStr` đã validate YYYY-MM-DD.
 * Điều kiện: ngày theo lịch salon (timezone) của scheduledAt = dateStr.
 * Phải dùng alias Sequelize: FROM "appointments" AS "Appointment" — không dùng tên bảng "appointments" trong literal.
 */
function scheduledAtOnSalonDateLiteral(dateStr) {
  const tz = salonTimezone().replace(/'/g, "''");
  const d = dateStr.replace(/'/g, "''");
  return sequelize.literal(
    `(timezone('${tz}', "Appointment"."scheduledAt"))::date = '${d}'::date`
  );
}

module.exports = {
  salonTimezone,
  scheduledAtOnSalonDateLiteral,
};
