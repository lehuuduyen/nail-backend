/**
 * One-shot: login Instagram → download images → save to Gallery DB.
 *
 * Usage:
 *   node src/scripts/importInstagramToGallery.js [username] [category] [limit]
 *
 * Requires in .env:
 *   INSTAGRAM_LOGIN=your_instagram_username
 *   INSTAGRAM_PASSWORD=your_instagram_password
 *   INSTAGRAM_ACCOUNTS=nailssxatzi   (profile to scrape)
 */
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

async function main() {
  const [,, usernameArg, categoryArg, limitArg] = process.argv;
  const category = categoryArg || process.env.INSTAGRAM_CATEGORY || 'nails';
  const limit = parseInt(limitArg, 10) || 30;

  const login = process.env.INSTAGRAM_LOGIN;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!login || !password) {
    console.error('ERROR: INSTAGRAM_LOGIN and INSTAGRAM_PASSWORD must be set in .env');
    process.exit(1);
  }

  // Step 1: install python-dotenv if needed
  try {
    execSync('python3 -c "import dotenv"', { stdio: 'ignore' });
  } catch {
    console.log('[setup] Installing python-dotenv...');
    execSync('pip3 install python-dotenv --break-system-packages -q', { stdio: 'inherit' });
  }

  // Step 2: run Python downloader
  const scriptPath = path.join(__dirname, 'instagram_download.py');
  const target = usernameArg || (process.env.INSTAGRAM_ACCOUNTS || '').split(',')[0].trim();
  if (!target) {
    console.error('ERROR: No Instagram target. Pass username as argument or set INSTAGRAM_ACCOUNTS in .env');
    process.exit(1);
  }

  console.log(`[import] Downloading from @${target}...`);
  let downloaded;
  try {
    const output = execSync(
      `python3 "${scriptPath}" "${target}" "${limit}"`,
      {
        cwd: path.join(__dirname, '../../'),
        env: process.env,
        timeout: 300_000,
        encoding: 'utf8',
      }
    );
    // Last line is the JSON array
    const lines = output.trim().split('\n');
    downloaded = JSON.parse(lines[lines.length - 1]);
  } catch (err) {
    console.error('[import] Download failed:', err.message);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }

  if (downloaded.error) {
    console.error('[import] Error:', downloaded.error);
    process.exit(1);
  }

  console.log(`[import] ${downloaded.length} images downloaded. Saving to Gallery...`);

  // Step 3: save to DB
  const { Gallery, sequelize } = require('../models');
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
  let added = 0;
  let skipped = 0;

  for (const item of downloaded) {
    const existing = await Gallery.findOne({ where: { sourceUrl: item.postUrl } });
    if (existing) {
      skipped++;
      continue;
    }
    const imageUrl = `${publicBase}/uploads/gallery/${item.filename}`;
    await Gallery.create({
      imageUrl,
      thumbnailUrl: imageUrl,
      title: item.caption ? item.caption.slice(0, 100) : null,
      description: item.caption || null,
      category,
      isActive: true,
      displayOrder: 0,
      sourceUrl: item.postUrl,
    });
    console.log(`[import] ✓ ${item.filename}`);
    added++;
  }

  console.log(`\n[import] Done — added: ${added}, skipped (duplicate): ${skipped}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('[import] Fatal:', err.message);
  process.exit(1);
});
