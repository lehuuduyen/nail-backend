const { Op, fn, col, QueryTypes, literal } = require('sequelize');
const {
  Transaction: Txn,
  Appointment,
  Service,
  Employee,
  sequelize,
} = require('../models');

const VALID_TURN_TYPES = new Set([
  'walk_in',
  'customer_pick',
  'owner_assign',
  'appointment',
]);

function normalizeTurnMeta({ appointmentId, turnType: rawTurn }) {
  if (appointmentId) {
    return { turnType: 'appointment', isCountedInRotation: false };
  }
  const turnType = VALID_TURN_TYPES.has(rawTurn) ? rawTurn : 'walk_in';
  const isCountedInRotation = turnType === 'walk_in';
  return { turnType, isCountedInRotation };
}

async function nextTurnNumberForDate(dateStr) {
  const row = await Txn.findOne({
    where: {
      date: dateStr,
      paymentStatus: { [Op.ne]: 'refunded' },
    },
    order: [['turnNumber', 'DESC']],
    attributes: ['turnNumber'],
  });
  const n = row?.turnNumber;
  return Number.isFinite(Number(n)) ? Number(n) + 1 : 1;
}

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
      customerPhone,
      helcimTransactionId,
      helcimInvoiceNumber,
      helcimCardType,
      helcimCardLast4,
      helcimApprovalCode,
      helcimFeeSaverAmount,
      paymentStatus,
      turnType: bodyTurnType,
      ticketId,
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

    const dateStr = String(date).slice(0, 10);
    const { turnType, isCountedInRotation } = normalizeTurnMeta({
      appointmentId,
      turnType: bodyTurnType,
    });

    const turnNumber = await nextTurnNumberForDate(dateStr);

    const row = await Txn.create({
      appointmentId: appointmentId || null,
      employeeId,
      serviceId,
      amount,
      tips,
      paymentMethod,
      date: dateStr,
      notes,
      customerId: customerId ?? null,
      customerPhone: customerPhone ?? null,
      helcimTransactionId: helcimTransactionId ?? null,
      helcimInvoiceNumber: helcimInvoiceNumber ?? null,
      helcimCardType: helcimCardType ?? null,
      helcimCardLast4: helcimCardLast4 ?? null,
      helcimApprovalCode: helcimApprovalCode ?? null,
      helcimFeeSaverAmount: helcimFeeSaverAmount ?? 0,
      paymentStatus: normalizedStatus || 'approved',
      turnType,
      isCountedInRotation,
      turnNumber,
      ticketId: ticketId ?? null,
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

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      const e = new Error('Invalid id');
      e.status = 400;
      throw e;
    }
    const row = await Txn.findByPk(id);
    if (!row) {
      const e = new Error('Transaction not found');
      e.status = 404;
      throw e;
    }

    const {
      employeeId,
      serviceId,
      amount,
      tips,
      paymentMethod,
      date,
      notes,
    } = req.body;

    const patch = {};
    if (employeeId != null) {
      const eid = Number(employeeId);
      if (!Number.isFinite(eid) || eid < 1) {
        const e = new Error('Invalid employeeId');
        e.status = 400;
        throw e;
      }
      patch.employeeId = eid;
    }
    if (serviceId != null) {
      const sid = Number(serviceId);
      if (!Number.isFinite(sid) || sid < 1) {
        const e = new Error('Invalid serviceId');
        e.status = 400;
        throw e;
      }
      patch.serviceId = sid;
    }
    if (amount != null) {
      const a = Number(amount);
      if (!Number.isFinite(a) || a < 0) {
        const e = new Error('Invalid amount');
        e.status = 400;
        throw e;
      }
      patch.amount = a;
    }
    if (tips != null) {
      const t = Number(tips);
      if (!Number.isFinite(t) || t < 0) {
        const e = new Error('Invalid tips');
        e.status = 400;
        throw e;
      }
      patch.tips = t;
    }
    if (paymentMethod != null) patch.paymentMethod = paymentMethod;
    if (date != null) {
      const d = String(date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const e = new Error('Invalid date (use YYYY-MM-DD)');
        e.status = 400;
        throw e;
      }
      patch.date = d;
    }
    if (notes !== undefined) {
      patch.notes = notes == null || notes === '' ? null : String(notes).slice(0, 5000);
    }

    await row.update(patch);
    const full = await Txn.findByPk(id, {
      include: [Employee, Service, Appointment],
    });
    res.json(full);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      const e = new Error('Invalid id');
      e.status = 400;
      throw e;
    }
    const row = await Txn.findByPk(id);
    if (!row) {
      const e = new Error('Transaction not found');
      e.status = 404;
      throw e;
    }
    await row.destroy();
    res.status(204).send();
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
        [fn('SUM', literal('(COALESCE(amount, 0) - COALESCE(tips, 0))')), 'totalAmount'],
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
      [fn('SUM', literal('(COALESCE(amount, 0) - COALESCE(tips, 0))')), 'totalAmount'],
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
        [fn('SUM', literal('(COALESCE(amount, 0) - COALESCE(tips, 0))')), 'totalRevenue'],
        [fn('COUNT', col('id')), 'totalTransactions'],
        [fn('AVG', literal('(COALESCE(amount, 0) - COALESCE(tips, 0))')), 'avgTransaction'],
      ],
      raw: true,
    });

    const topRows = await sequelize.query(
      `
      SELECT e.id AS "employeeId", e."firstName", e."lastName",
             SUM((t.amount::numeric - COALESCE(t.tips, 0))) AS revenue
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
  update,
  destroy,
  getDailyRevenue,
  getRevenueByPeriod,
  getRevenueByEmployee,
  getSummaryStats,
};
