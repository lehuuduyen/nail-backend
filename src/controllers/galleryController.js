const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
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
    const limitRaw = parseInt(req.query.limit, 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 120) : null;

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
      ...(limit ? { limit } : {}),
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

async function createFromUrl(req, res, next) {
  try {
    const { url, category = 'other', displayOrder = 0 } = req.body;
    if (!url) {
      const e = new Error('url is required');
      e.status = 400;
      throw e;
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.instagram.com/',
      },
      timeout: 20000,
      maxRedirects: 10,
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png')
      ? '.png'
      : contentType.includes('gif')
        ? '.gif'
        : contentType.includes('webp')
          ? '.webp'
          : '.jpg';

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const uploadDir = path.join(__dirname, '../../public/uploads/gallery');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), response.data);

    const rel = `/uploads/gallery/${filename}`;
    const imageUrl = `${PUBLIC_BASE}${rel}`;

    const row = await Gallery.create({
      imageUrl,
      thumbnailUrl: imageUrl,
      category,
      isActive: true,
      displayOrder: parseInt(displayOrder, 10) || 0,
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ERR_BAD_REQUEST' || err.response?.status) {
      const e = new Error(`Failed to fetch image: HTTP ${err.response?.status || err.code}`);
      e.status = 422;
      return next(e);
    }
    next(err);
  }
}

module.exports = { list, listAdmin, create, createFromUrl, update, remove };
