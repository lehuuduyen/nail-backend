/**
 * Thêm hoặc cập nhật 4 bài blog SEO (blogPostsSeo2026) — KHÔNG truncate DB.
 * Chạy: npm run seed:blog-seo  (từ thư mục nail-backend)
 */
require('dotenv').config();
const { sequelize, BlogPost } = require('../models');
const seoPosts = require('../seeders/blogPostsSeo2026');

async function main() {
  await sequelize.authenticate();
  /** Chỉ cập nhật schema bảng blog — tránh alter toàn DB */
  await BlogPost.sync({ alter: true });

  let n = 0;
  for (const p of seoPosts) {
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

  console.log(`\nDone: ${n} SEO blog post(s) in database.`);
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
