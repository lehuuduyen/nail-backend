const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payroll = sequelize.define(
    'Payroll',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
      },
      periodStart: { type: DataTypes.DATEONLY, allowNull: false },
      periodEnd: { type: DataTypes.DATEONLY, allowNull: false },
      totalServices: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalRevenue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      commissionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      hoursWorked: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      hourlyEarnings: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      baseSalary: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      totalTips: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      bonusAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      totalPay: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'approved', 'paid'),
        allowNull: false,
        defaultValue: 'draft',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: 'payrolls',
      timestamps: true,
    }
  );
  return Payroll;
};
