const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Service = sequelize.define(
    'Service',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: DataTypes.STRING(150), allowNull: false },
      nameVi: { type: DataTypes.STRING(150), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      priceCard: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Card price when different from cash (price)',
      },
      duration: { type: DataTypes.INTEGER, allowNull: false, comment: 'minutes' },
      category: {
        type: DataTypes.STRING(32),
        allowNull: false,
        comment:
          'manicure|pedicure|nails|addon|kids|lash|waxing|head_spa|facial|gel|dip|acrylic|other',
      },
      menuSort: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display order on menu / website',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'services',
      timestamps: true,
    }
  );
  return Service;
};
