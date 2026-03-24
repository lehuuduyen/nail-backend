/**
 * Sets password for user "admin" to "admin123" (bcrypt).
 * Does not truncate other data. Run: npm run reset-admin
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

async function main() {
  await sequelize.authenticate();
  const hash = await bcrypt.hash('admin123', 10);
  const [updated] = await User.update({ password: hash }, { where: { username: 'admin' } });
  if (updated === 0) {
    await User.create({ username: 'admin', password: hash, role: 'admin' });
    console.log('Created user: admin / admin123');
  } else {
    console.log('Updated admin password to: admin123');
  }
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
