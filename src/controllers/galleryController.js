const path = require('path');
const fs = require('fs').promises;
const { Gallery } = require('../models');

const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

async function listAdmin(req, res, next) {
  try {
    const rows = await Gallery.findAll({
      order: [
        ['displayOrder', 'ASC'],
        ['id', 'DESC'],
      ],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { category } = req.query;
    const where = { isActive: true };
    if (category && category !== 'all') {
      where.category = category;
    }
    const rows = await Gallery.findAll({
      where,
      order: [
        ['displayOrder', 'ASC'],
        ['id', 'DESC'],
      ],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    if (!req.file) {
      const e = new Error('Image file required (field name: image)');
      e.status = 400;
      throw e;
    }
    const rel = `/uploads/gallery/${req.file.filename}`;
    const imageUrl = `${PUBLIC_BASE}${rel}`;
    const {
      title,
      description,
      category = 'other',
      displayOrder = 0,
    } = req.body;

    const row = await Gallery.create({
      imageUrl,
      thumbnailUrl: imageUrl,
      title: title || null,
      description: description || null,
      category,
      isActive: true,
      displayOrder: parseInt(displayOrder, 10) || 0,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Gallery.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    const {
      title,
      description,
      category,
      isActive,
      displayOrder,
    } = req.body;
    const patch = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (category !== undefined) patch.category = category;
    if (isActive !== undefined) patch.isActive = Boolean(isActive);
    if (displayOrder !== undefined) patch.displayOrder = parseInt(displayOrder, 10) || 0;
    await row.update(patch);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const row = await Gallery.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    const urlPath = row.imageUrl.replace(/^https?:\/\/[^/]+/, '');
    const localPath = path.join(
      __dirname,
      '../../public',
      urlPath.replace(/^\//, '')
    );
    try {
      await fs.unlink(localPath);
    } catch {
      /* ignore */
    }
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listAdmin, create, update, remove };
