const path = require('path');
const axios = require('axios');
const { Gallery } = require('../models');
const { syncInstagram, parseUsername } = require('../scripts/syncInstagramGallery');
const { storeUpload, storeBuffer, deleteByUrl, isR2Configured, listObjects } = require('../services/r2Storage');

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const GALLERY_PREFIX = 'uploads/gallery/';
// Ảnh upload thẳng lên R2 (không qua API) nên không có sự kiện để bust cache
// → cache theo thời gian. Đổi bằng env GALLERY_CACHE_TTL (giây), mặc định 300s.
const CACHE_TTL_MS = (parseInt(process.env.GALLERY_CACHE_TTL, 10) || 300) * 1000;
let _galleryCache = { at: 0, items: [] };

/**
 * Quét toàn bộ ảnh trong folder gallery trên R2.
 * Category lấy theo đường dẫn: uploads/gallery/<category>/<file> → <category>.
 * File nằm thẳng trong uploads/gallery/ → 'other'. Sắp xếp mới nhất trước.
 */
async function loadGalleryItems() {
  const objects = await listObjects(GALLERY_PREFIX);
  return objects
    .filter((o) => IMAGE_EXT.test(o.key))
    .map((o) => {
      const rel = o.key.slice(GALLERY_PREFIX.length);
      const slash = rel.indexOf('/');
      const category = slash > 0 ? rel.slice(0, slash) : 'other';
      return {
        id: o.key,
        imageUrl: o.url,
        thumbnailUrl: o.url,
        title: null,
        description: null,
        category,
        isActive: true,
        displayOrder: 0,
        createdAt: o.lastModified,
        updatedAt: o.lastModified,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Trả danh sách ảnh gallery, dùng cache TTL. fresh=true để nạp lại ngay. */
async function getGalleryItems({ fresh = false } = {}) {
  if (!fresh && Date.now() - _galleryCache.at < CACHE_TTL_MS) {
    return _galleryCache.items;
  }
  _galleryCache = { at: Date.now(), items: await loadGalleryItems() };
  return _galleryCache.items;
}

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

    // Hiển thị gallery: quét thẳng folder gallery trên R2 (có cache TTL).
    // Category lấy theo folder trên R2, không phụ thuộc DB. ?fresh=1 để nạp lại.
    if (isR2Configured()) {
      let items = await getGalleryItems({ fresh: req.query.fresh === '1' });
      if (category && category !== 'all') {
        items = items.filter((it) => it.category === category);
      }
      if (limit) items = items.slice(0, limit);
      return res.json(items);
    }

    // R2 chưa config: giữ nguyên hành vi cũ (đọc từ DB).
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
    const imageUrl = await storeUpload(req.file, 'gallery', { maxWidth: 1600 });
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
    await deleteByUrl(row.imageUrl);
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}


async function syncFromInstagram(req, res, next) {
  try {
    const { instagramUrl, category, limit } = req.body;
    if (!instagramUrl) {
      const e = new Error('instagramUrl is required');
      e.status = 400;
      throw e;
    }
    const username = parseUsername(instagramUrl);
    if (!username) {
      const e = new Error('Could not parse Instagram username from URL');
      e.status = 400;
      throw e;
    }
    const result = await syncInstagram(
      username,
      category || process.env.INSTAGRAM_CATEGORY || 'nails',
      Math.min(parseInt(limit, 10) || 30, 50)
    );
    res.json({ username, ...result });
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

    const imageUrl = await storeBuffer(Buffer.from(response.data), 'gallery', {
      ext,
      maxWidth: 1600,
    });

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




module.exports = { list, listAdmin, create, createFromUrl, update, remove,syncFromInstagram  };
