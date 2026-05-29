/**
 * Cron job: sync Instagram → Gallery daily.
 * Run: pm2 start src/scripts/instagramCron.js --name instagram-cron
 *
 * .env required:
 *   INSTAGRAM_ACCOUNTS=nailssxatzi          (comma-separated usernames or URLs)
 *   INSTAGRAM_CATEGORY=nails                (default: nails)
 *   INSTAGRAM_SYNC_HOUR=10                  (0-23, Phoenix time, default: 10 AM)
 *   INSTAGRAM_SESSION_ID=                   (optional, needed for private/rate-limited)
 */
require('dotenv').config();
const cron = require('node-cron');
const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'syncInstagramGallery.js');
let isRunning = false;

function runSync() {
  if (isRunning) {
    console.log(`[${new Date().toISOString()}] Instagram sync already running, skipping.`);
    return;
  }
  const accounts = (process.env.INSTAGRAM_ACCOUNTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!accounts.length) {
    console.log('[instagram-cron] No INSTAGRAM_ACCOUNTS configured, skipping.');
    return;
  }

  isRunning = true;
  console.log(`[${new Date().toISOString()}] Starting Instagram sync for: ${accounts.join(', ')}`);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '../../'),
      env: process.env,
      timeout: 300_000,
    });
    console.log(output.toString());
    console.log(`[${new Date().toISOString()}] Instagram sync complete.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Instagram sync failed:`, err.message);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
  } finally {
    isRunning = false;
  }
}

// Default: 10 AM Phoenix time (America/Phoenix = UTC-7, no DST) = 17:00 UTC
const syncHour = parseInt(process.env.INSTAGRAM_SYNC_HOUR || '10', 10);
const utcHour = (syncHour + 7) % 24;

cron.schedule(`0 ${utcHour} * * *`, runSync, { timezone: 'UTC' });

const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

process.on('SIGINT', () => { clearInterval(keepAlive); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(keepAlive); process.exit(0); });

console.log(`[${new Date().toISOString()}] Instagram cron started. Scheduled at ${syncHour}:00 Phoenix time (${utcHour}:00 UTC) daily.`);

// Run immediately on first start
runSync();

module.exports = { runSync };
