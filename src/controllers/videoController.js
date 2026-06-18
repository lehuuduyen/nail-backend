const { Video } = require('../models');

/** Extract a YouTube video ID from a raw ID or any common YouTube URL. */
function normalizeYoutubeId(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Already a bare ID (11 chars typical, allow 10–20 to be safe)
  if (/^[\w-]{10,20}$/.test(s) && !s.includes('/')) return s;
  const m =
    s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{10,20})/) ||
    s.match(/[?&]v=([\w-]{10,20})/);
  return m ? m[1] : null;
}

const ORDER = [
  ['displayOrder', 'ASC'],
  ['id', 'DESC'],
];

/** Public — active videos only, for the marketing website. */
async function listPublic(req, res, next) {
  try {
    const rows = await Video.findAll({ where: { isActive: true }, order: ORDER });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Admin — all videos including inactive. */
async function listAdmin(req, res, next) {
  try {
    const rows = await Video.findAll({ order: ORDER });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const youtubeId = normalizeYoutubeId(req.body.youtubeId);
    if (!youtubeId) {
      const e = new Error('Valid youtubeId (or YouTube URL) is required');
      e.status = 400;
      throw e;
    }
    if (!req.body.title || !String(req.body.title).trim()) {
      const e = new Error('title is required');
      e.status = 400;
      throw e;
    }
    const row = await Video.create({
      youtubeId,
      title: String(req.body.title).trim(),
      description: req.body.description ? String(req.body.description).trim() : null,
      uploadDate: req.body.uploadDate || null,
      durationSeconds:
        req.body.durationSeconds != null && req.body.durationSeconds !== ''
          ? parseInt(req.body.durationSeconds, 10)
          : null,
      featured: Boolean(req.body.featured),
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      displayOrder: parseInt(req.body.displayOrder, 10) || 0,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Video.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Video not found');
      e.status = 404;
      throw e;
    }
    const patch = {};
    if (req.body.youtubeId !== undefined) {
      const yid = normalizeYoutubeId(req.body.youtubeId);
      if (!yid) {
        const e = new Error('Invalid youtubeId');
        e.status = 400;
        throw e;
      }
      patch.youtubeId = yid;
    }
    if (req.body.title !== undefined) patch.title = String(req.body.title).trim();
    if (req.body.description !== undefined)
      patch.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body.uploadDate !== undefined) patch.uploadDate = req.body.uploadDate || null;
    if (req.body.durationSeconds !== undefined)
      patch.durationSeconds =
        req.body.durationSeconds === '' || req.body.durationSeconds == null
          ? null
          : parseInt(req.body.durationSeconds, 10);
    if (req.body.featured !== undefined) patch.featured = Boolean(req.body.featured);
    if (req.body.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    if (req.body.displayOrder !== undefined)
      patch.displayOrder = parseInt(req.body.displayOrder, 10) || 0;
    await row.update(patch);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const row = await Video.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Video not found');
      e.status = 404;
      throw e;
    }
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublic, listAdmin, create, update, remove };
