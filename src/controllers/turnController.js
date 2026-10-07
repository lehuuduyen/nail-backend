const { Op } = require('sequelize');
const { Transaction, Employee, Appointment, Service } = require('../models');
const { scheduledAtOnSalonDateLiteral } = require('../utils/salonAppointmentDay');

function parseYmd(q) {
  const s = q != null ? String(q).trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

const { grossServiceAmount } = require('../utils/serviceAmount');

const notRefunded = { [Op.ne]: 'refunded' };

/**
 * GET /api/turns/today?date=YYYY-MM-DD
 * rotation `turns` = chỉ isCountedInRotation (walk-in); appointments = lịch hẹn trong ngày.
 */
async function getTodayTurns(req, res, next) {
  try {
    const dateStr = parseYmd(req.query.date);
    if (!dateStr) {
      const e = new Error('Query param date (YYYY-MM-DD) is required');
      e.status = 400;
      throw e;
    }

    const employees = await Employee.findAll({
      where: { isActive: true },
      order: [
        ['listOrder', 'ASC'],
        ['firstName', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const turnData = await Promise.all(
      employees.map(async (emp) => {
        const rotationWhere = {
          employeeId: emp.id,
          date: dateStr,
          isCountedInRotation: true,
          paymentStatus: notRefunded,
        };

        const turns = await Transaction.count({ where: rotationWhere });

        /* Cùng nghĩa với /appointments/day: mọi lịch không hủy trong ngày lịch salon */
        const appointments = await Appointment.count({
          where: {
            [Op.and]: [
              scheduledAtOnSalonDateLiteral(dateStr),
              { employeeId: emp.id },
              { status: { [Op.ne]: 'cancelled' } },
            ],
          },
        });

        const lastTicket = await Transaction.findOne({
          where: {
            employeeId: emp.id,
            date: dateStr,
            paymentStatus: notRefunded,
          },
          order: [['createdAt', 'DESC']],
        });

        return {
          employeeId: emp.id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—',
          firstName: emp.firstName,
          lastName: emp.lastName,
          nickname: emp.nickName || null,
          photo: null,
          turns,
          appointments,
          lastServed: lastTicket?.createdAt || null,
          isAvailable: true,
        };
      })
    );

    const sorted = [...turnData].sort((a, b) => {
      if (a.turns !== b.turns) return a.turns - b.turns;
      if (!a.lastServed) return -1;
      if (!b.lastServed) return 1;
      return new Date(a.lastServed) - new Date(b.lastServed);
    });

    const suggested = sorted.length ? sorted[0].employeeId : null;

    res.json({
      success: true,
      date: dateStr,
      employees: turnData,
      suggested,
      total: turnData.reduce((s, e) => s + e.turns, 0),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/turns/by-date?date=YYYY-MM-DD
 */
async function getTurnsByDate(req, res, next) {
  try {
    const dateStr = parseYmd(req.query.date);
    if (!dateStr) {
      const e = new Error('Query param date (YYYY-MM-DD) is required');
      e.status = 400;
      throw e;
    }

    const transactions = await Transaction.findAll({
      where: {
        date: dateStr,
        paymentStatus: notRefunded,
      },
      include: [{ model: Employee, attributes: ['id', 'firstName', 'lastName'] }],
      order: [['turnNumber', 'ASC'], ['createdAt', 'ASC']],
    });

    const byEmployee = {};
    for (const t of transactions) {
      const emp = t.Employee;
      const key = emp ? emp.id : 'unknown';
      const label = emp
        ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim()
        : 'Unknown';
      if (!byEmployee[key]) {
        byEmployee[key] = {
          employeeId: key === 'unknown' ? null : key,
          name: label,
          turns: 0,
          tickets: [],
        };
      }
      byEmployee[key].turns += 1;
      byEmployee[key].tickets.push({
        id: t.id,
        turnNumber: t.turnNumber,
        time: t.createdAt,
        amount: t.amount,
        turnType: t.turnType,
        isCountedInRotation: t.isCountedInRotation,
      });
    }

    res.json({
      success: true,
      date: dateStr,
      byEmployee,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/turns/check-turn?date=YYYY-MM-DD — listed service totals, all turn types. */
async function getCheckTurnColumns(req, res, next) {
  try {
    const dateStr = parseYmd(req.query.date);
    const parsedDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : null;
    if (!dateStr || !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== dateStr) {
      const e = new Error('Query param date (YYYY-MM-DD) is required and must be valid');
      e.status = 400;
      throw e;
    }

    const employees = await Employee.findAll({
      where: { isActive: true },
      order: [['listOrder', 'ASC'], ['firstName', 'ASC'], ['id', 'ASC']],
    });
    const transactions = await Transaction.findAll({
      where: { date: dateStr, paymentStatus: notRefunded },
      include: [Employee, Service],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });
    const groups = new Map(employees.map((emp) => [emp.id, new Map()]));
    for (const txn of transactions) {
      const employeeGroups = groups.get(txn.employeeId);
      if (!employeeGroups) continue;
      const key = txn.ticketId == null ? `transaction:${txn.id}` : `ticket:${txn.ticketId}`;
      if (!employeeGroups.has(key)) {
        employeeGroups.set(key, {
          serviceTotal: 0,
          turns: 0,
          time: txn.createdAt,
          ticketId: txn.ticketId ?? null,
          turnNumber: txn.turnNumber ?? null,
          turnType: txn.turnType,
          services: [],
          customer: { id: txn.customerId ?? null, phone: txn.customerPhone ?? null },
        });
      }
      const row = employeeGroups.get(key);
      const price = grossServiceAmount(txn);
      row.serviceTotal += price;
      if (price >= 25) row.turns += 1;
      const notes = typeof txn.notes === 'string' ? txn.notes : '';
      const separator = notes.lastIndexOf(':');
      const name = separator >= 0 ? notes.slice(0, separator).trim() : '';
      row.services.push({ name: name || txn.Service?.name || '—', price });
    }

    const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    const columns = employees.map((emp) => {
      const rows = [...groups.get(emp.id).values()];
      const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.serviceTotal, 0));
      for (const row of rows) {
        row.serviceTotal = roundMoney(row.serviceTotal);
        row.services = row.services.map((service) => ({ ...service, price: roundMoney(service.price) }));
      }
      return {
        employeeId: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—',
        firstName: emp.firstName,
        lastName: emp.lastName,
        nickname: emp.nickName || null,
        turns: rows.reduce((sum, row) => sum + row.turns, 0),
        totalAmount,
        rows,
      };
    });
    res.json({ success: true, date: dateStr, columns, total: columns.reduce((sum, col) => sum + col.turns, 0) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCheckTurnColumns,
  getTodayTurns,
  getTurnsByDate,
};
