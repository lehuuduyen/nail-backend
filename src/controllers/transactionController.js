const { Op, fn, col, QueryTypes } = require('sequelize');
const {
  Transaction: Txn,
  Appointment,
  Service,
  Employee,
  sequelize,
} = require('../models');

async function create(req, res, next) {
  try {
    let {
      appointmentId,
      employeeId,
      serviceId,
      amount,
      tips = 0,
      paymentMethod,
      date,
      notes,
      customerId,
      helcimTransactionId,
      helcimInvoiceNumber,
      helcimCardType,
      helcimCardLast4,
      helcimApprovalCode,
      helcimFeeSaverAmount,
      paymentStatus,
    } = req.body;

    const normalizedStatus =
      paymentStatus === 'completed' || paymentStatus === 'paid'
        ? 'approved'
        : paymentStatus;

    if (appointmentId) {
      const apt = await Appointment.findByPk(appointmentId, {
        include: [{ model: Service }],
      });
      if (!apt) {
        const e = new Error('Appointment not found');
        e.status = 404;
        throw e;
      }
      employeeId = employeeId ?? apt.employeeId;
      serviceId = serviceId ?? apt.serviceId;
      if (amount == null && apt.Service) {
        amount = apt.Service.price;
      }
    }

    if (!employeeId || !serviceId || amount == null || !paymentMethod || !date) {
      const e = new Error(
        'employeeId, serviceId, amount, paymentMethod, and date are required (or appointmentId to auto-fill)'
      );
      e.status = 400;
      throw e;
    }

    const row = await Txn.create({
      appointmentId: appointmentId || null,
      employeeId,
      serviceId,
      amount,
      tips,
      paymentMethod,
      date,
      notes,
      customerId: customerId ?? null,
      helcimTransactionId: helcimTransactionId ?? null,
      helcimInvoiceNumber: helcimInvoiceNumber ?? null,
      helcimCardType: helcimCardType ?? null,
      helcimCardLast4: helcimCardLast4 ?? null,
      helcimApprovalCode: helcimApprovalCode ?? null,
      helcimFeeSaverAmount: helcimFeeSaverAmount ?? 0,
      paymentStatus: normalizedStatus || 'approved',
    });

    const full = await Txn.findByPk(row.id, {
      include: [Employee, Service, Appointment],
    });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { date } = req.query;
    const where = {};
    if (date != null && String(date).trim() !== '') {
      const d = String(date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const e = new Error('Invalid date query param (use YYYY-MM-DD)');
        e.status = 400;
        throw e;
      }
      where.date = d;
    }

    const rows = await Txn.findAll({
      where,
      include: [Employee, Service, Appointment],
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit: req.query.limit ? Math.min(Number(req.query.limit), 500) : 200,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getDailyRevenue(req, res, next) {
  try {
    const { date } = req.query;
    if (!date) {
      const e = new Error('Query param date (YYYY-MM-DD) is required');
      e.status = 400;
      throw e;
    }
    const row = await Txn.findOne({
      where: { date },
      attributes: [
        [fn('SUM', col('amount')), 'totalAmount'],
        [fn('SUM', col('tips')), 'totalTips'],
        [fn('COUNT', col('id')), 'transactionCount'],
      ],
      raw: true,
    });
    res.json({
      date,
      totalAmount: parseFloat(row?.totalAmount || 0),
      totalTips: parseFloat(row?.totalTips || 0),
      transactionCount: parseInt(row?.transactionCount || 0, 10),
    });
  } catch (err) {
    next(err);
  }
}

async function getRevenueByPeriod(req, res, next) {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      const e = new Error('Query params start and end (YYYY-MM-DD) are required');
      e.status = 400;
      throw e;
    }
    const row = await Txn.findOne({
      where: { date: { [Op.between]: [start, end] } },
      attributes: [
        [fn('SUM', col('amount')), 'totalAmount'],
        [fn('SUM', col('tips')), 'totalTips'],
        [fn('COUNT', col('id')), 'transactionCount'],
      ],
      raw: true,
    });
    res.json({
      period: { start, end },
      totalAmount: parseFloat(row?.totalAmount || 0),
      totalTips: parseFloat(row?.totalTips || 0),
      transactionCount: parseInt(row?.transactionCount || 0, 10),
    });
  } catch (err) {
    next(err);
  }
}

async function getRevenueByEmployee(employeeId, start, end) {
  const row = await Txn.findOne({
    where: {
      employeeId,
      date: { [Op.between]: [start, end] },
    },
    attributes: [
      [fn('SUM', col('amount')), 'totalAmount'],
      [fn('SUM', col('tips')), 'totalTips'],
      [fn('COUNT', col('id')), 'transactionCount'],
    ],
    raw: true,
  });
  return {
    totalAmount: parseFloat(row?.totalAmount || 0),
    totalTips: parseFloat(row?.totalTips || 0),
    transactionCount: parseInt(row?.transactionCount || 0, 10),
  };
}

async function getSummaryStats(req, res, next) {
  try {
    const { start, end } = req.query;
    const where = {};
    if (start && end) {
      where.date = { [Op.between]: [start, end] };
    }

    const totals = await Txn.findOne({
      where,
      attributes: [
        [fn('SUM', col('amount')), 'totalRevenue'],
        [fn('COUNT', col('id')), 'totalTransactions'],
        [fn('AVG', col('amount')), 'avgTransaction'],
      ],
      raw: true,
    });

    const topRows = await sequelize.query(
      `
      SELECT e.id AS "employeeId", e."firstName", e."lastName",
             SUM(t.amount)::numeric AS revenue
      FROM transactions t
      INNER JOIN employees e ON e.id = t."employeeId"
      ${start && end ? 'WHERE t.date BETWEEN :start AND :end' : ''}
      GROUP BY e.id
      ORDER BY revenue DESC
      LIMIT 1
    `,
      {
        replacements: start && end ? { start, end } : {},
        type: QueryTypes.SELECT,
      }
    );

    const top = topRows[0]
      ? {
          ...topRows[0],
          revenue: parseFloat(topRows[0].revenue),
        }
      : null;

    res.json({
      totalRevenue: parseFloat(totals?.totalRevenue || 0),
      totalTransactions: parseInt(totals?.totalTransactions || 0, 10),
      avgTransaction: parseFloat(totals?.avgTransaction || 0),
      topEmployee: top,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getDailyRevenue,
  getRevenueByPeriod,
  getRevenueByEmployee,
  getSummaryStats,
};
