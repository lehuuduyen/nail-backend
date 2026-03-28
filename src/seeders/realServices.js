/**
 * Nice Nails & Spa — full menu from shared/niceNailsServices.json
 *
 * Run from repo root or nail-backend:
 *   node src/seeders/realServices.js
 *
 * If DELETE fails (FK from appointments/transactions), seeder falls back to upsert by name+category.
 */
const path = require('path');
const fs = require('fs');
const { sequelize, Service } = require('../models');

const jsonPath = path.join(__dirname, '../../../shared/niceNailsServices.json');
const rawServices = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function buildRows() {
  return rawServices.map((s, i) => ({
    name: s.name,
    nameVi: s.nameVi || null,
    category: s.category,
    price: s.price,
    priceCard: s.priceCard == null ? null : s.priceCard,
    duration: s.duration,
    description: s.description || null,
    isActive: s.isActive !== false,
    menuSort: i + 1,
  }));
}

async function seedRealServices() {
  console.log('🌸 Seeding real Nice Nails & Spa services...');
  const rows = buildRows();

  await sequelize.authenticate();

  let cleared = false;
  try {
    await Service.destroy({ where: {} });
    cleared = true;
    console.log('Cleared existing services.');
  } catch (err) {
    console.warn(
      '⚠️  Could not delete all services (likely FK from appointments/transactions). Using upsert.',
      err.message
    );
  }

  if (cleared) {
    await Service.bulkCreate(rows);
  } else {
    for (const row of rows) {
      const [instance] = await Service.findOrCreate({
        where: { name: row.name, category: row.category },
        defaults: row,
      });
      await instance.update(row);
    }
  }

  console.log(`✅ ${cleared ? 'Created' : 'Upserted'} ${rows.length} services`);
  console.log('\nCategories:');
  const cats = [...new Set(rows.map((s) => s.category))];
  cats.forEach((cat) => {
    const count = rows.filter((s) => s.category === cat).length;
    console.log(`  ${cat}: ${count}`);
  });

  await sequelize.close();
}

if (require.main === module) {
  seedRealServices()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedRealServices, services: rawServices };
