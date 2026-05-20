/**
 * Thêm hoặc cập nhật 5 bài blog nail-service — KHÔNG truncate DB.
 * Chạy: npm run seed:blog-services  (từ thư mục nail-backend)
 */
require('dotenv').config();
const { sequelize, BlogPost } = require('../models');
const posts = require('../seeders/blogPostsNailServices');

async function main() {
  await sequelize.authenticate();
  await BlogPost.sync({ alter: true });

  let n = 0;
  for (const p of posts) {
    const payload = {
      title: p.title,
      metaTitle: p.metaTitle ?? null,
      excerpt: p.excerpt,
      content: p.content,
      metaDescription: p.metaDescription,
      keywords: p.keywords ?? null,
      faqs: p.faqs ?? null,
      readingMinutes: p.readingMinutes,
      publishedAt: p.publishedAt,
      published: true,
    };

    const [row, created] = await BlogPost.findOrCreate({
      where: { slug: p.slug },
      defaults: { slug: p.slug, ...payload },
    });

    if (!created) {
      await row.update(payload);
    }
    n += 1;
    console.log(created ? `+ created  /blog/${p.slug}` : `↻ updated /blog/${p.slug}`);
  }

  console.log(`\nDone: ${n} nail-service blog post(s) in database.`);
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
