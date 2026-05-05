const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define(
    'Customer',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      phone: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      faceEnrolled: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { tableName: 'customers', timestamps: true }
  );
};
