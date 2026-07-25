const { LoginErrorLog } = require('../models');

async function create(req, res, next) {
  try {
    const { username, status, message, source } = req.body;
    if (!message) {
      const e = new Error('message is required');
      e.status = 400;
      throw e;
    }
    const row = await LoginErrorLog.create({
      source: source || 'nail-app',
      username: username || null,
      status: Number.isFinite(parseInt(status, 10)) ? parseInt(status, 10) : null,
      message: String(message).slice(0, 2000),
    });
    res.status(201).json({ id: row.id });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
    const rows = await LoginErrorLog.findAll({
      order: [['id', 'DESC']],
      limit,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list };
