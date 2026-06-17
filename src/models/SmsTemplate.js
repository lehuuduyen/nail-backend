const { DataTypes } = require('sequelize');

// Available types and their default bodies
const DEFAULTS = {
  booking_confirm: 'Hi {name}! Your appointment at {salon} is confirmed for {time}{technician}. Ref: {confirmation}.{notes} Reply STOP to unsubscribe.',
  checkin_confirm: 'Hi {name}! You\'ve checked in at {salon}. We\'ll be with you shortly! Reply STOP to unsubscribe.',
  eod_thankyou: 'Hi {name}! Thank you for visiting {salon} today. We hope to see you again soon! Reply STOP to unsubscribe.',
  birthday: 'Happy Birthday {name}! 🎂 {salon} wishes you a wonderful day. Come celebrate with us — enjoy a special treat on your next visit! Reply STOP to unsubscribe.',
  manager_booking_alert: 'New booking: {name} ({phone}) — {service}{technician} at {time}. Ref: {confirmation}.{notes}',
};

module.exports = (sequelize) => {
  const SmsTemplate = sequelize.define(
    'SmsTemplate',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      type: {
        type: DataTypes.ENUM('booking_confirm', 'checkin_confirm', 'eod_thankyou', 'birthday', 'manager_booking_alert'),
        allowNull: false,
      },
      body: { type: DataTypes.TEXT, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { tableName: 'sms_templates', timestamps: true }
  );

  SmsTemplate.DEFAULTS = DEFAULTS;
  return SmsTemplate;
};
