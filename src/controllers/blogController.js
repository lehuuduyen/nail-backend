const { BlogPost } = require('../models');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function listPublished(req, res, next) {
  try {
    const rows = await BlogPost.findAll({
      where: { published: true },
      attributes: [
        'id',
        'slug',
        'title',
        'excerpt',
        'publishedAt',
        'updatedAt',
        'metaDescription',
        'keywords',
        'readingMinutes',
      ],
      order: [['publishedAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!slug || !SLUG_RE.test(slug) || slug.length > 120) {
      const e = new Error('Invalid slug');
      e.status = 400;
      throw e;
    }
    const row = await BlogPost.findOne({
      where: { slug, published: true },
    });
    if (!row) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublished,
  getBySlug,
};
