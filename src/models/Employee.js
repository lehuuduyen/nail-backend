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
      commissionRate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true,
        comment: 'e.g. 0.45 = 45%',
      },
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
