const { Promo } = require('../models');

const ORDER = [
  ['displayOrder', 'ASC'],
  ['id', 'DESC'],
];

/** Public — active promos only. Website applies the Phoenix date-range filter. */
async function listPublic(req, res, next) {
  try {
    const rows = await Promo.findAll({ where: { active: true }, order: ORDER });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Admin — all promos including inactive. */
async function listAdmin(req, res, next) {
  try {
    const rows = await Promo.findAll({ order: ORDER });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

function buildPayload(body) {
  return {
    title: body.title != null ? String(body.title).trim() : undefined,
    description: body.description != null ? String(body.description).trim() : undefined,
    details: body.details ? String(body.details).trim() : null,
    badge: body.badge ? String(body.badge).trim() : null,
    startDate: body.startDate || undefined,
    endDate: body.endDate || undefined,
    ctaLabel: body.ctaLabel ? String(body.ctaLabel).trim() : undefined,
    ctaHref: body.ctaHref ? String(body.ctaHref).trim() : undefined,
    active: body.active !== undefined ? Boolean(body.active) : undefined,
    displayOrder:
      body.displayOrder !== undefined ? parseInt(body.displayOrder, 10) || 0 : undefined,
  };
}

async function create(req, res, next) {
  try {
    const { title, description, startDate, endDate } = req.body;
    if (!title || !description || !startDate || !endDate) {
      const e = new Error('title, description, startDate, endDate are required');
      e.status = 400;
      throw e;
    }
    const p = buildPayload(req.body);
    const row = await Promo.create({
      title: p.title,
      description: p.description,
      details: p.details,
      badge: p.badge,
      startDate: p.startDate,
      endDate: p.endDate,
      ctaLabel: p.ctaLabel || 'Book Now',
      ctaHref: p.ctaHref || '/booking',
      active: p.active !== undefined ? p.active : true,
      displayOrder: p.displayOrder || 0,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Promo.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Promo not found');
      e.status = 404;
      throw e;
    }
    const p = buildPayload(req.body);
    const patch = {};
    Object.keys(p).forEach((k) => {
      if (p[k] !== undefined) patch[k] = p[k];
    });
    await row.update(patch);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const row = await Promo.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Promo not found');
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
