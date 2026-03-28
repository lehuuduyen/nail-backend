const { Transaction, Employee, Service } = require('../models');
const { Op } = require('sequelize');
const { salesExcludingTips, paymentTotal } = require('../utils/transactionAmounts');

function pad(n) {
  return String(n).padStart(2, '0');
}

function toYMD(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function addDaysYMD(ymd, days) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const dt = new Date(+m[1], +m[2] - 1, +m[3]);
  dt.setDate(dt.getDate() + days);
  return toYMD(dt);
}

/** Phần thợ trên mỗi đồng doanh thu (0–1), theo commissionTechPct / commissionOwnerPct. */
function employeeTechShare(emp) {
  let t = parseInt(emp.commissionTechPct, 10);
  let o = parseInt(emp.commissionOwnerPct, 10);
  if (!Number.isFinite(t)) t = 100;
  if (!Number.isFinite(o)) o = 0;
  if (t < 0) t = 0;
  if (o < 0) o = 0;
  const sum = t + o;
  if (sum <= 0) return 1;
  return t / sum;
}

/** Inclusive number of calendar days from startStr to endStr (YYYY-MM-DD). */
function inclusiveDayCount(startStr, endStr) {
  const m1 = String(startStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = String(endStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m1 || !m2) return 9999;
  const a = new Date(+m1[1], +m1[2] - 1, +m1[3]);
  const b = new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return Math.round((b - a) / 864e5) + 1;
}

/** Fill missing YYYY-MM-DD keys so weekly charts show all days (zeros). */
function fillByDateGaps(startStr, endStr, byDate) {
  const m1 = String(startStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = String(endStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m1 || !m2) return byDate;
  const empty = { total: 0, card: 0, cash: 0, tips: 0, tickets: 0 };
  const out = { ...byDate };
  let d = new Date(+m1[1], +m1[2] - 1, +m1[3]);
  const end = new Date(+m2[1], +m2[2] - 1, +m2[3]);
  while (d <= end) {
    const key = toYMD(d);
    if (!out[key]) out[key] = { ...empty };
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function labelForChartDay(ymd) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** One entry per day in [startStr, endStr], same labels as transaction grouping. */
function buildByDayFullRange(startStr, endStr, rawByDay) {
  const m1 = String(startStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = String(endStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m1 || !m2) return rawByDay;
  const out = {};
  let d = new Date(+m1[1], +m1[2] - 1, +m1[3]);
  const end = new Date(+m2[1], +m2[2] - 1, +m2[3]);
  while (d <= end) {
    const ymd = toYMD(d);
    const label = labelForChartDay(ymd);
    out[label] = rawByDay[label] || { amount: 0, tips: 0, tickets: 0 };
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function getDateRange(type, param) {
  const today = toYMD(new Date());
  if (type === 'date') {
    const dateStr =
      typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;
    return { startStr: dateStr, endStr: dateStr };
  }
  if (type === 'week') {
    // Giống POS: dùng đúng ngày bắt đầu client gửi, +6 ngày = 7 ngày liên tiếp (không ép Thứ Hai thêm).
    const ref =
      typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;
    const startStr = ref;
    const endStr = addDaysYMD(startStr, 6);
    return { startStr, endStr };
  }
  if (type === 'month') {
    const year = Number(param?.year);
    const month = Number(param?.month);
    const now = new Date();
    const y = year && year > 1900 ? year : now.getFullYear();
    const mo = month >= 1 && month <= 12 ? month : now.getMonth() + 1;
    const startStr = `${y}-${pad(mo)}-01`;
    const endStr = toYMD(new Date(y, mo, 0));
    return { startStr, endStr };
  }
  if (type === 'year') {
    const year = Number(param) && Number(param) > 1900 ? Number(param) : new Date().getFullYear();
    return { startStr: `${year}-01-01`, endStr: `${year}-12-31` };
  }
  if (type === 'range') {
    // Never use new Date('YYYY-MM-DD') — it is UTC and shifts the calendar day in many timezones.
    const parseBound = (v, fallback) => {
      if (v == null || String(v).trim() === '') return fallback;
      const s = String(v).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const parsed = toYMD(new Date(s));
      return parsed || fallback;
    };
    const startStr = parseBound(param?.startDate, today);
    const endStr = parseBound(param?.endDate, today);
    if (startStr > endStr) return { startStr: endStr, endStr: startStr };
    return { startStr, endStr };
  }
  return { startStr: today, endStr: today };
}

const notRefundedWhere = { paymentStatus: { [Op.ne]: 'refunded' } };

async function buildTechnicianReport(startStr, endStr) {
  const transactions = await Transaction.findAll({
    where: {
      date: { [Op.between]: [startStr, endStr] },
      ...notRefundedWhere,
    },
    include: [{ model: Employee, attributes: ['id', 'firstName', 'lastName'] }],
    order: [
      ['date', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const byEmployee = {};
  transactions.forEach((t) => {
    const emp = t.Employee;
    const key = emp ? String(emp.id) : 'unknown';
    const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown' : 'Unknown';
    if (!byEmployee[key]) {
      byEmployee[key] = {
        id: emp?.id,
        name,
        tickets: 0,
        amount: 0,
        tips: 0,
        card: 0,
        cash: 0,
        rows: [],
      };
    }
    const row = byEmployee[key];
    row.tickets += 1;
    row.amount += salesExcludingTips(t);
    row.tips += parseFloat(t.tips || 0);
    const charged = paymentTotal(t);
    if (t.paymentMethod === 'card') {
      row.card += charged;
    } else {
      row.cash += charged;
    }
    row.rows.push({
      id: t.id,
      date: t.date,
      amount: t.amount,
      tips: t.tips,
      paymentMethod: t.paymentMethod,
      cardLast4: t.helcimCardLast4,
      notes: t.notes,
    });
  });

  const employees = Object.values(byEmployee);
  const totals = employees.reduce(
    (acc, e) => ({
      tickets: acc.tickets + e.tickets,
      amount: acc.amount + e.amount,
      tips: acc.tips + e.tips,
      card: acc.card + e.card,
      cash: acc.cash + e.cash,
    }),
    { tickets: 0, amount: 0, tips: 0, card: 0, cash: 0 }
  );

  return { employees, totals, transactions };
}

exports.byDate = async (req, res) => {
  try {
    const { date } = req.query;
    const { startStr, endStr } = getDateRange('date', date);
    const data = await buildTechnicianReport(startStr, endStr);
    res.json({ success: true, date: startStr, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.byWeek = async (req, res) => {
  try {
    const { startDate } = req.query;
    const { startStr, endStr } = getDateRange('week', startDate);
    const data = await buildTechnicianReport(startStr, endStr);

    const byDay = {};
    data.transactions.forEach((t) => {
      const ymd = typeof t.date === 'string' ? t.date : toYMD(t.date);
      const day = labelForChartDay(ymd);
      if (!byDay[day]) byDay[day] = { amount: 0, tips: 0, tickets: 0 };
      byDay[day].amount += salesExcludingTips(t);
      byDay[day].tips += parseFloat(t.tips || 0);
      byDay[day].tickets += 1;
    });

    const byDayOrdered = buildByDayFullRange(startStr, endStr, byDay);

    res.json({ success: true, ...data, byDay: byDayOrdered, startDate: startStr, endDate: endStr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.byMonth = async (req, res) => {
  try {
    const { year, month } = req.query;
    const { startStr, endStr } = getDateRange('month', {
      year: parseInt(year, 10),
      month: parseInt(month, 10),
    });
    const data = await buildTechnicianReport(startStr, endStr);

    const byWeek = {};
    data.transactions.forEach((t) => {
      const d = new Date(t.date + 'T12:00:00');
      const weekNum = Math.min(5, Math.ceil(d.getDate() / 7));
      const key = `Week ${weekNum}`;
      if (!byWeek[key]) byWeek[key] = { amount: 0, tips: 0, tickets: 0 };
      byWeek[key].amount += salesExcludingTips(t);
      byWeek[key].tips += parseFloat(t.tips || 0);
      byWeek[key].tickets += 1;
    });

    res.json({
      success: true,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      ...data,
      byWeek,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.byRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { startStr, endStr } = getDateRange('range', { startDate, endDate });
    const data = await buildTechnicianReport(startStr, endStr);
    res.json({ success: true, ...data, startDate: startStr, endDate: endStr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.byYear = async (req, res) => {
  try {
    const { year } = req.query;
    const { startStr, endStr } = getDateRange('year', parseInt(year, 10));
    const data = await buildTechnicianReport(startStr, endStr);

    const byMonth = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((m) => {
      byMonth[m] = { amount: 0, tips: 0, tickets: 0 };
    });
    data.transactions.forEach((t) => {
      const m = months[new Date(t.date + 'T12:00:00').getMonth()];
      byMonth[m].amount += salesExcludingTips(t);
      byMonth[m].tips += parseFloat(t.tips || 0);
      byMonth[m].tickets += 1;
    });

    res.json({ success: true, year: parseInt(year, 10) || new Date().getFullYear(), ...data, byMonth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.storeIncomeByDate = async (req, res) => {
  try {
    const { date } = req.query;
    const { startStr, endStr } = getDateRange('date', date);
    const transactions = await Transaction.findAll({
      where: {
        date: { [Op.between]: [startStr, endStr] },
        ...notRefundedWhere,
      },
      include: [{ model: Employee, attributes: ['firstName', 'lastName'] }],
      order: [
        ['date', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const totals = transactions.reduce(
      (acc, t) => {
        const charged = paymentTotal(t);
        const tips = parseFloat(t.tips || 0);
        const service = salesExcludingTips(t);
        if (t.paymentMethod === 'card') acc.card += charged;
        else acc.cash += charged;
        acc.total += service;
        acc.tips += tips;
        acc.tickets += 1;
        return acc;
      },
      { total: 0, card: 0, cash: 0, tips: 0, tickets: 0 }
    );

    res.json({ success: true, date: startStr, totals, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.storeIncomeByRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { startStr, endStr } = getDateRange('range', { startDate, endDate });

    const transactions = await Transaction.findAll({
      where: {
        date: { [Op.between]: [startStr, endStr] },
        ...notRefundedWhere,
      },
      include: [{ model: Employee, attributes: ['firstName', 'lastName'] }],
      order: [
        ['date', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const byDate = {};
    const totals = { total: 0, card: 0, cash: 0, tips: 0, tickets: 0 };

    transactions.forEach((t) => {
      const day = t.date;
      if (!byDate[day]) byDate[day] = { total: 0, card: 0, cash: 0, tips: 0, tickets: 0 };
      const charged = paymentTotal(t);
      const tips = parseFloat(t.tips || 0);
      const service = salesExcludingTips(t);
      byDate[day].total += service;
      byDate[day].tips += tips;
      byDate[day].tickets += 1;
      totals.total += service;
      totals.tips += tips;
      totals.tickets += 1;
      if (t.paymentMethod === 'card') {
        byDate[day].card += charged;
        totals.card += charged;
      } else {
        byDate[day].cash += charged;
        totals.cash += charged;
      }
    });

    const span = inclusiveDayCount(startStr, endStr);
    const byDateOut = span <= 14 ? fillByDateGaps(startStr, endStr, byDate) : byDate;

    res.json({
      success: true,
      byDate: byDateOut,
      totals,
      transactions,
      startDate: startStr,
      endDate: endStr,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.ownerAdvanced = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { startStr, endStr } = getDateRange('range', { startDate, endDate });

    const transactions = await Transaction.findAll({
      where: {
        date: { [Op.between]: [startStr, endStr] },
        ...notRefundedWhere,
      },
      include: [
        {
          model: Employee,
          attributes: ['id', 'firstName', 'lastName', 'payType', 'commissionTechPct', 'commissionOwnerPct'],
        },
      ],
      order: [
        ['date', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const byEmployee = {};
    transactions.forEach((t) => {
      const emp = t.Employee;
      if (!emp) return;
      const key = emp.id;
      if (!byEmployee[key]) {
        byEmployee[key] = {
          id: emp.id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
          payType: emp.payType,
          commissionTechPct: emp.commissionTechPct,
          commissionOwnerPct: emp.commissionOwnerPct,
          revenue: 0,
          commission: 0,
          tips: 0,
          tickets: 0,
        };
      }
      const tips = parseFloat(t.tips || 0);
      const service = salesExcludingTips(t);
      const row = byEmployee[key];
      row.revenue += service;
      row.tips += tips;
      row.tickets += 1;
      if (emp.payType === 'commission') {
        row.commission += service * employeeTechShare(emp);
      }
    });

    const employees = Object.values(byEmployee);
    const totalCommission = employees.reduce((s, e) => s + e.commission, 0);
    const totalRevenue = employees.reduce((s, e) => s + e.revenue, 0);
    const totalTips = employees.reduce((s, e) => s + e.tips, 0);

    res.json({
      success: true,
      employees,
      totals: { revenue: totalRevenue, commission: totalCommission, tips: totalTips },
      startDate: startStr,
      endDate: endStr,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.pedicureLog = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { startStr, endStr } = getDateRange('range', { startDate, endDate });

    const transactions = await Transaction.findAll({
      where: {
        date: { [Op.between]: [startStr, endStr] },
        ...notRefundedWhere,
      },
      include: [
        { model: Employee, attributes: ['firstName', 'lastName'] },
        {
          model: Service,
          attributes: ['name', 'category', 'price'],
          where: { category: 'pedicure' },
          required: true,
        },
      ],
      order: [
        ['date', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    res.json({ success: true, transactions, startDate: startStr, endDate: endStr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
