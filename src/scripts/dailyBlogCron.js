/**
 * Schedules daily blog post generation at 9:00 AM Phoenix time (America/Phoenix = UTC-7, no DST).
 * Run as a long-lived process: node src/scripts/dailyBlogCron.js
 * Or add to PM2: pm2 start src/scripts/dailyBlogCron.js --name blog-cron
 */
require('dotenv').config();
const cron = require('node-cron');
const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'generateDailyBlogPost.js');
let isRunning = false;

function runGenerator() {
  if (isRunning) {
    console.log(`[${new Date().toISOString()}] Previous run still in progress, skipping.`);
    return;
  }
  isRunning = true;
  const ts = new Date().toISOString();
  console.log(`[${ts}] Running daily blog post generator...`);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '../../'),
      env: process.env,
      timeout: 300_000,
    });
    console.log(output.toString());
    console.log(`[${new Date().toISOString()}] Blog post generation complete.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Blog post generation failed:`, err.message);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
  } finally {
    isRunning = false;
  }
}

// 9:00 AM America/Phoenix (UTC-7, no DST) = 16:00 UTC
cron.schedule('0 16 * * *', runGenerator, { timezone: 'UTC' });

// Keep process alive
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

process.on('SIGINT', () => {
  console.log('\n[blog-cron] Shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[blog-cron] Received SIGTERM, shutting down...');
  clearInterval(keepAlive);
  process.exit(0);
});

console.log(`[${new Date().toISOString()}] Daily blog cron started. Scheduled for 9:00 AM Phoenix time (16:00 UTC) every day.`);
console.log('Running initial generation now...');

// Chạy ngay khi start
runGenerator();

// Also expose a function for direct import (e.g., calling from server.js)
module.exports = { runGenerator };
