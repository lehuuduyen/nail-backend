require('dotenv').config();
const { Sequelize } = require('sequelize');

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set');
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: false,
  },
});

/** Load models (associations) then sync schema. */
function sync(options) {
  require('../models');
  return sequelize.sync(options);
}

module.exports = { sequelize, sync };
