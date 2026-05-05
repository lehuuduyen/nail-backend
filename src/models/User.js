const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('admin', 'manager'),
        allowNull: false,
        defaultValue: 'manager',
      },
      pushToken: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      updatedAt: true,
    }
  );
  return User;
};
