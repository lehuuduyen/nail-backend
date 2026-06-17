/**
 * One-off fix: set Manicure card prices to exact cash × 1.03 (no rounding).
 * Idempotent — only updates the 5 affected rows by name; safe to re-run.
 *
 * Run on the server (where DATABASE_URL points to production):
 *   cd nail-backend && node src/scripts/fixManicureCardPrice.js
 */
require('dotenv').config();
const { sequelize, Service } = require('../models');

const FIXES = {
  'Manicure 1 Regular': 30.9,
  'Manicure 1 Gel': 36.05,
  'Manicure 2 Gel': 56.65,
  'Manicure 3 Regular': 61.8,
  'Manicure 3 Gel': 66.95,
};

async function run() {
  await sequelize.authenticate();
  for (const [name, priceCard] of Object.entries(FIXES)) {
    const [n] = await Service.update({ priceCard }, { where: { name } });
    console.log(`${name.padEnd(20)} -> priceCard ${priceCard} (rows updated: ${n})`);
  }
  const rows = await Service.findAll({
    where: { category: 'manicure' },
    attributes: ['name', 'price', 'priceCard'],
    order: [['menuSort', 'ASC']],
  });
  console.log('\nManicure card prices now:');
  rows.forEach((r) => console.log(`  ${r.name.padEnd(20)} price ${r.price}  card ${r.priceCard}`));
}

run()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
