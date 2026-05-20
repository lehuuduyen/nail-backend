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

function runGenerator() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] Running daily blog post generator...`);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.join(__dirname, '../../'),
      env: process.env,
      timeout: 120_000,
    });
    console.log(output.toString());
    console.log(`[${ts}] Blog post generation complete.`);
  } catch (err) {
    console.error(`[${ts}] Blog post generation failed:`, err.message);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
  }
}

// 9:00 AM America/Phoenix (UTC-7, no DST) = 16:00 UTC
// cron format: second(optional) minute hour day month weekday
cron.schedule('0 16 * * *', runGenerator, {
  timezone: 'UTC',
});

console.log('Daily blog cron started. Scheduled for 9:00 AM Phoenix time (16:00 UTC) every day.');
console.log('Press Ctrl+C to stop.');

// Also expose a function for direct import (e.g., calling from server.js)
module.exports = { runGenerator };
