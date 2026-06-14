const { DataTypes } = require('sequelize');

// Single-row settings table (id always = 1)
module.exports = (sequelize) => {
  return sequelize.define(
    'SmsSettings',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      eodTime: { type: DataTypes.STRING(5), defaultValue: '20:00' },
      birthdayTime: { type: DataTypes.STRING(5), defaultValue: '09:00' },
      eodEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      birthdayEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      managerPhone: { type: DataTypes.TEXT, allowNull: true },
      timezone: { type: DataTypes.STRING(100), defaultValue: 'America/Phoenix' },
    },
    { tableName: 'sms_settings', timestamps: true }
  );
};
