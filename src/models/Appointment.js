const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Appointment = sequelize.define(
    'Appointment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customerName: { type: DataTypes.STRING(150), allowNull: false },
      customerPhone: { type: DataTypes.STRING(30), allowNull: true },
      customerEmail: { type: DataTypes.STRING(120), allowNull: true },
      source: {
        type: DataTypes.ENUM('pos', 'web'),
        allowNull: false,
        defaultValue: 'pos',
      },
      confirmationNumber: { type: DataTypes.STRING(32), allowNull: true, unique: true },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
      },
      serviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'services', key: 'id' },
      },
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'appointments',
      timestamps: true,
    }
  );
  return Appointment;
};
