const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Employee = sequelize.define(
    'Employee',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(30), allowNull: true },
      email: { type: DataTypes.STRING(120), allowNull: true },
      payType: {
        type: DataTypes.ENUM('commission', 'hourly', 'salary'),
        allowNull: false,
      },
      /** Legacy; không dùng trong tính lương — pool = 100% doanh thu kỳ rồi chia thợ/chủ. */
      commissionRate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true,
      },
      /** Tech share of commission pool, 0–100 (e.g. 60 with owner 40 = “6-4”). */
      commissionTechPct: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      commissionOwnerPct: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      /** Cash share of net pay, 0–100; check = 100 - cash. */
      cashPortionPct: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      /** Bao lương — guaranteed minimum net pay per period. */
      minimumPay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      nickName: { type: DataTypes.STRING(80), allowNull: true },
      /** Display number in list: NAME-number (POS). */
      listOrder: { type: DataTypes.INTEGER, allowNull: true },
      hourlyRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      baseSalary: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      tipsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      hireDate: { type: DataTypes.DATEONLY, allowNull: true },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'employees',
      timestamps: true,
    }
  );
  return Employee;
};
