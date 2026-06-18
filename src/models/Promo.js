const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Promo = sequelize.define(
    'Promo',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: true, comment: 'fine print / conditions' },
      badge: { type: DataTypes.STRING(40), allowNull: true, comment: 'e.g. Limited Time' },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'YYYY-MM-DD — shows from this Phoenix day (inclusive)',
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'YYYY-MM-DD — hides after this Phoenix day (inclusive)',
      },
      ctaLabel: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Book Now' },
      ctaHref: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '/booking' },
      tiers: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'optional pricing tiers, e.g. gift cards: [{worth, pay, bestValue}]',
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      showCountdown: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'show live countdown to endDate on the /specials event hero',
      },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      tableName: 'promos',
      timestamps: true,
    }
  );
  return Promo;
};
