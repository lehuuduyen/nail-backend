const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LoginErrorLog = sequelize.define(
    'LoginErrorLog',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      source: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'nail-app' },
      username: { type: DataTypes.STRING(120), allowNull: true },
      status: { type: DataTypes.INTEGER, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      tableName: 'login_error_logs',
      timestamps: true,
    }
  );
  return LoginErrorLog;
};
