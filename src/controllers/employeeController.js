const { Op } = require('sequelize');
const { Employee, Transaction: Txn, sequelize } = require('../models');

async function list(req, res, next) {
  try {
    const rows = await Employee.findAll({ order: [['lastName', 'ASC']] });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const row = await Employee.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Employee not found');
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
    const row = await Employee.create(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Employee.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Employee not found');
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
    const row = await Employee.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Employee not found');
      e.status = 404;
      throw e;
    }
    await row.destroy();
    res.status(204).send();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      err.status = 400;
      err.message = 'Cannot delete employee with related appointments or transactions';
    }
    next(err);
  }
}

async function getEmployeeStats(req, res, next) {
  try {
    const { id } = req.params;
    const { start, end } = req.query;
    if (!start || !end) {
      const e = new Error('Query params start and end (YYYY-MM-DD) are required');
      e.status = 400;
      throw e;
    }
    const employee = await Employee.findByPk(id);
    if (!employee) {
      const e = new Error('Employee not found');
      e.status = 404;
      throw e;
    }
    const row = await Txn.findOne({
      where: {
        employeeId: id,
        date: { [Op.between]: [start, end] },
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'serviceCount'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'revenue'],
      ],
      raw: true,
    });
    const serviceCount = parseInt(row?.serviceCount || 0, 10);
    const revenue = parseFloat(row?.revenue || 0);
    res.json({
      employeeId: Number(id),
      period: { start, end },
      serviceCount,
      revenue,
    });
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
  getEmployeeStats,
};
