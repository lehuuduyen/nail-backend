/**
 * Sync Instagram profile images → Gallery table.
 *
 * Usage:
 *   node src/scripts/syncInstagramGallery.js [instagramUrl] [category] [limit]
 *
 * Examples:
 *   node src/scripts/syncInstagramGallery.js https://www.instagram.com/nailssxatzi/ nails 20
 *   node src/scripts/syncInstagramGallery.js nailssxatzi
 *
 * Or configure via .env:
 *   INSTAGRAM_ACCOUNTS=nailssxatzi,otheraccount
 *   INSTAGRAM_CATEGORY=nails
 *   INSTAGRAM_SESSION_ID=<sessionid cookie value>
 */
require('dotenv').config();

const { fetchProfilePosts, downloadImage } = require('../services/instagramService');

async function syncInstagram(username, category = 'nails', limit = 30) {
  // Lazy-load DB models so script can also be imported by cron
  const { Gallery } = require('../models');

  const sessionId = process.env.INSTAGRAM_SESSION_ID || null;
  console.log(`[Instagram] Fetching posts for @${username} (limit ${limit})...`);

  const posts = await fetchProfilePosts(username, sessionId, limit);
  console.log(`[Instagram] Found ${posts.length} image posts`);

  let added = 0;
  let skipped = 0;
  const errors = [];

  for (const post of posts) {
    try {
      // Skip if already imported (dedup by sourceUrl)
      const existing = await Gallery.findOne({ where: { sourceUrl: post.postUrl } });
      if (existing) {
        skipped++;
        continue;
      }

      const filename = await downloadImage(post.imageUrl);
      const publicBase = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
      const imageUrl = `${publicBase}/uploads/gallery/${filename}`;

      await Gallery.create({
        imageUrl,
        thumbnailUrl: imageUrl,
        title: post.caption ? post.caption.slice(0, 100) : null,
        description: post.caption || null,
        category,
        isActive: true,
        displayOrder: 0,
        sourceUrl: post.postUrl,
      });

      added++;
      console.log(`[Instagram] ✓ Saved: ${filename}`);

      // Polite delay between downloads
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[Instagram] ✗ Error on ${post.postUrl}: ${err.message}`);
      errors.push({ url: post.postUrl, error: err.message });
    }
  }

  console.log(`[Instagram] Done — added: ${added}, skipped: ${skipped}, errors: ${errors.length}`);
  return { added, skipped, errors };
}

function parseUsername(input) {
  if (!input) return null;
  // Accept full URL or bare username
  const match = input.match(/instagram\.com\/([^/?#]+)/);
  return match ? match[1] : input.replace(/^@/, '');
}

// Run directly
if (require.main === module) {
  const [,, rawInput, category, rawLimit] = process.argv;
  const limit = parseInt(rawLimit, 10) || 30;

  const targets = rawInput
    ? [parseUsername(rawInput)]
    : (process.env.INSTAGRAM_ACCOUNTS || '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!targets.length) {
    console.error('Usage: node syncInstagramGallery.js <instagramUrl|username> [category] [limit]');
    console.error('  Or set INSTAGRAM_ACCOUNTS=username1,username2 in .env');
    process.exit(1);
  }

  (async () => {
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    for (const username of targets) {
      await syncInstagram(username, category || process.env.INSTAGRAM_CATEGORY || 'nails', limit);
    }
    await sequelize.close();
    process.exit(0);
  })().catch((err) => {
    console.error('[Instagram] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { syncInstagram, parseUsername };
