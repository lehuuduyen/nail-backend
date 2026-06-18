/**
 * Seed the "Gift Card Promotion" event (4 pricing tiers) into the promos table.
 * Idempotent — creates it only if a promo with the same title doesn't already exist,
 * so re-running won't duplicate or clobber edits made in the admin.
 *
 * Run after the promos table exists (npm run db:alter):
 *   cd nail-backend && node src/scripts/seedGiftCardPromo.js
 */
require('dotenv').config();
const { sequelize, Promo } = require('../models');

const GIFT_CARD_PROMO = {
  title: 'Gift Card Promotion',
  description:
    'Give the gift of beauty & relaxation to someone special — or yourself! For a limited time, pay less for gift cards worth more.',
  details: 'Gift cards cannot be combined with other offers or promotions.',
  badge: 'Limited Time',
  startDate: '2026-06-01',
  endDate: '2026-12-31', // adjust in the admin as needed
  ctaLabel: 'Get a Gift Card',
  ctaHref: '/booking',
  active: true,
  showCountdown: false,
  displayOrder: 0,
  tiers: [
    { worth: 50, pay: 45, bestValue: false },
    { worth: 100, pay: 85, bestValue: false },
    { worth: 150, pay: 130, bestValue: false },
    { worth: 200, pay: 170, bestValue: true },
  ],
};

async function run() {
  await sequelize.authenticate();
  const [row, created] = await Promo.findOrCreate({
    where: { title: GIFT_CARD_PROMO.title },
    defaults: GIFT_CARD_PROMO,
  });
  if (created) {
    console.log(`✅ Created "${row.title}" (id ${row.id}) with ${GIFT_CARD_PROMO.tiers.length} tiers.`);
  } else {
    console.log(
      `ℹ️  "${row.title}" already exists (id ${row.id}) — left unchanged. Edit it in the admin.`
    );
  }
}

run()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
