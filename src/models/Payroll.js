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
      /** Optional display rate (Bonus-Check column); not always same as commission. */
      bonusCheckRate: {
        type: DataTypes.DECIMAL(6, 4),
        allowNull: true,
      },
      tipCredit: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      cleanFee: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      checkDue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Amount due by check (POS override)',
      },
      ownerProfitAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Owner share from commission split for the period',
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
