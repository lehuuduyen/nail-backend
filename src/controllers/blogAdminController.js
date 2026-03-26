const { Op } = require('sequelize');
const { BlogPost } = require('../models');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function readingMinutesFromContent(content, fallback = 5) {
  const words = String(content || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (!words) return fallback;
  return Math.max(1, Math.min(120, Math.ceil(words / 200)));
}

function parsePublishedAt(raw) {
  if (raw == null || raw === '') return new Date();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

async function listAll(req, res, next) {
  try {
    const rows = await BlogPost.findAll({
      order: [
        ['publishedAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      const e = new Error('Invalid id');
      e.status = 400;
      throw e;
    }
    const row = await BlogPost.findByPk(id);
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

async function create(req, res, next) {
  try {
    const b = req.body || {};
    let slug = normalizeSlug(b.slug) || normalizeSlug(b.title);
    if (!slug || !SLUG_RE.test(slug) || slug.length > 120) {
      const e = new Error(
        'Valid slug required (lowercase letters, numbers, hyphens only), or use a title to auto-generate'
      );
      e.status = 400;
      throw e;
    }
    const dup = await BlogPost.findOne({ where: { slug } });
    if (dup) {
      const e = new Error('Slug already exists');
      e.status = 409;
      throw e;
    }
    if (!b.title || !String(b.title).trim()) {
      const e = new Error('Title required');
      e.status = 400;
      throw e;
    }
    if (!b.excerpt || !String(b.excerpt).trim()) {
      const e = new Error('Excerpt required');
      e.status = 400;
      throw e;
    }
    if (!b.content || !String(b.content).trim()) {
      const e = new Error('Content required');
      e.status = 400;
      throw e;
    }
    if (!b.metaDescription || !String(b.metaDescription).trim()) {
      const e = new Error('Meta description required');
      e.status = 400;
      throw e;
    }

    const content = String(b.content).trim();
    let rm;
    if (b.readingMinutes != null && b.readingMinutes !== '') {
      const n = parseInt(b.readingMinutes, 10);
      rm = Number.isNaN(n)
        ? readingMinutesFromContent(content)
        : Math.max(1, Math.min(120, n));
    } else {
      rm = readingMinutesFromContent(content);
    }

    const metaTitle =
      b.metaTitle != null && String(b.metaTitle).trim()
        ? String(b.metaTitle).trim().slice(0, 220)
        : null;
    let faqs = null;
    if (b.faqs != null && b.faqs !== '') {
      if (Array.isArray(b.faqs)) {
        faqs = b.faqs;
      } else if (typeof b.faqs === 'string') {
        try {
          faqs = JSON.parse(b.faqs);
        } catch {
          faqs = null;
        }
      }
    }

    const row = await BlogPost.create({
      slug,
      title: String(b.title).trim(),
      metaTitle,
      excerpt: String(b.excerpt).trim(),
      content,
      metaDescription: String(b.metaDescription).trim().slice(0, 320),
      faqs,
      keywords: b.keywords != null ? String(b.keywords).trim().slice(0, 500) : null,
      published: b.published !== false && b.published !== 'false',
      publishedAt: parsePublishedAt(b.publishedAt),
      readingMinutes: rm,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      const e = new Error('Invalid id');
      e.status = 400;
      throw e;
    }
    const row = await BlogPost.findByPk(id);
    if (!row) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }

    const b = req.body || {};

    if (b.slug != null) {
      const slug = normalizeSlug(b.slug);
      if (!slug || !SLUG_RE.test(slug) || slug.length > 120) {
        const e = new Error('Invalid slug');
        e.status = 400;
        throw e;
      }
      const dup = await BlogPost.findOne({
        where: { slug, id: { [Op.ne]: id } },
      });
      if (dup) {
        const e = new Error('Slug already in use');
        e.status = 409;
        throw e;
      }
      row.slug = slug;
    }

    if (b.title != null) row.title = String(b.title).trim();
    if (b.metaTitle !== undefined) {
      row.metaTitle =
        b.metaTitle == null || String(b.metaTitle).trim() === ''
          ? null
          : String(b.metaTitle).trim().slice(0, 220);
    }
    if (b.excerpt != null) row.excerpt = String(b.excerpt).trim();
    if (b.content != null) row.content = String(b.content).trim();
    if (b.metaDescription != null) row.metaDescription = String(b.metaDescription).trim().slice(0, 320);
    if (b.faqs !== undefined) {
      if (b.faqs == null || b.faqs === '') {
        row.faqs = null;
      } else if (Array.isArray(b.faqs)) {
        row.faqs = b.faqs;
      } else if (typeof b.faqs === 'string') {
        try {
          row.faqs = JSON.parse(b.faqs);
        } catch {
          row.faqs = null;
        }
      }
    }
    if (b.keywords !== undefined) {
      row.keywords = b.keywords == null || b.keywords === '' ? null : String(b.keywords).trim().slice(0, 500);
    }
    if (b.published !== undefined) {
      row.published = b.published !== false && b.published !== 'false';
    }
    if (b.publishedAt != null) {
      row.publishedAt = parsePublishedAt(b.publishedAt);
    }
    if (b.readingMinutes != null && b.readingMinutes !== '') {
      const n = parseInt(b.readingMinutes, 10);
      if (!Number.isNaN(n)) row.readingMinutes = Math.max(1, Math.min(120, n));
    } else if (b.content != null) {
      row.readingMinutes = readingMinutesFromContent(row.content, row.readingMinutes);
    }

    if (!row.title || !row.excerpt || !row.content || !row.metaDescription) {
      const e = new Error('Title, excerpt, content, and meta description cannot be empty');
      e.status = 400;
      throw e;
    }

    await row.save();
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      const e = new Error('Invalid id');
      e.status = 400;
      throw e;
    }
    const row = await BlogPost.findByPk(id);
    if (!row) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAll,
  getById,
  create,
  update,
  remove,
};
