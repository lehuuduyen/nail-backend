const { Op, fn, literal } = require('sequelize');
const { Service, Transaction: Txn, sequelize } = require('../models');

async function list(req, res, next) {
  try {
    const rows = await Service.findAll({
      order: [
        ['menuSort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const row = await Service.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Service not found');
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
    const row = await Service.create(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Service.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Service not found');
      e.status = 404;
      throw e;
    }
    await row.update(req.body);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const row = await Service.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Service not found');
      e.status = 404;
      throw e;
    }
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      err.status = 400;
      err.message = 'Cannot delete service with related records';
    }
    next(err);
  }
}

async function getPopularServices(req, res, next) {
  try {
    const { start, end } = req.query;
    const where = {};
    if (start && end) {
      where.date = { [Op.between]: [start, end] };
    }
    const agg = await Txn.findAll({
      where,
      attributes: [
        'serviceId',
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'transactionCount'],
        [fn('SUM', literal('(COALESCE(amount, 0) - COALESCE(tips, 0))')), 'totalRevenue'],
      ],
      group: ['serviceId'],
      raw: true,
    });
    const ids = [...new Set(agg.map((a) => a.serviceId))];
    const services = await Service.findAll({ where: { id: ids } });
    const byId = Object.fromEntries(services.map((s) => [s.id, s]));
    const mapped = agg
      .map((a) => ({
        serviceId: a.serviceId,
        transactionCount: parseInt(a.transactionCount, 10),
        totalRevenue: parseFloat(a.totalRevenue || 0),
        service: byId[a.serviceId] || null,
      }))
      .sort((x, y) => y.transactionCount - x.transactionCount);
    res.json(mapped);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getPopularServices,
};
