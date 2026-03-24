const { Op } = require('sequelize');
const { Appointment, Employee, Service } = require('../models');

async function list(req, res, next) {
  try {
    const rows = await Appointment.findAll({
      include: [
        { model: Employee, attributes: ['id', 'firstName', 'lastName'] },
        { model: Service, attributes: ['id', 'name', 'price', 'duration'] },
      ],
      order: [['scheduledAt', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const row = await Appointment.create(req.body);
    const full = await Appointment.findByPk(row.id, {
      include: [Employee, Service],
    });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const row = await Appointment.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Appointment not found');
      e.status = 404;
      throw e;
    }
    await row.update(req.body);
    const full = await Appointment.findByPk(row.id, {
      include: [Employee, Service],
    });
    res.json(full);
  } catch (err) {
    next(err);
  }
}

async function getToday(req, res, next) {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const rows = await Appointment.findAll({
      where: {
        scheduledAt: { [Op.between]: [start, end] },
      },
      include: [Employee, Service],
      order: [['scheduledAt', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Appointments for one calendar day (local server TZ), excludes cancelled */
async function getByDay(req, res, next) {
  try {
    const dateStr = req.query.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const e = new Error('Query param date (YYYY-MM-DD) is required');
      e.status = 400;
      throw e;
    }
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(`${dateStr}T23:59:59.999`);
    const rows = await Appointment.findAll({
      where: {
        scheduledAt: { [Op.between]: [start, end] },
        status: { [Op.ne]: 'cancelled' },
      },
      include: [
        { model: Employee, attributes: ['id', 'firstName', 'lastName'] },
        { model: Service, attributes: ['id', 'name', 'price', 'duration'] },
      ],
      order: [['scheduledAt', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, getToday, getByDay };
