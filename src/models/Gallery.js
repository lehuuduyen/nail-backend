const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Gallery = sequelize.define(
    'Gallery',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      imageUrl: { type: DataTypes.STRING(500), allowNull: false },
      thumbnailUrl: { type: DataTypes.STRING(500), allowNull: true },
      title: { type: DataTypes.STRING(200), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'other',
      },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      tableName: 'galleries',
      timestamps: true,
    }
  );
  return Gallery;
};
