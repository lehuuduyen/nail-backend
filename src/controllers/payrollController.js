const { Op, fn, col } = require('sequelize');
const { Payroll, Employee, Transaction: Txn, sequelize } = require('../models');
const { salesExcludingTips } = require('../utils/transactionAmounts');

function num(v) {
  return parseFloat(v == null ? 0 : v);
}

function techShareNormalized(emp) {
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

async function generatePayroll(req, res, next) {
  try {
    const {
      employeeId,
      periodStart,
      periodEnd,
      hoursWorked,
      bonusAmount = 0,
      notes,
    } = req.body;

    if (!employeeId || !periodStart || !periodEnd) {
      const e = new Error('employeeId, periodStart, periodEnd are required');
      e.status = 400;
      throw e;
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      const e = new Error('Employee not found');
      e.status = 404;
      throw e;
    }

    const txs = await Txn.findAll({
      where: {
        employeeId,
        date: { [Op.between]: [periodStart, periodEnd] },
      },
    });

    const totalServices = txs.length;
    const totalRevenue = txs.reduce((s, t) => s + salesExcludingTips(t), 0);
    const totalTipsRaw = txs.reduce((s, t) => s + num(t.tips), 0);
    const totalTips = employee.tipsEnabled ? totalTipsRaw : 0;
    const bonus = num(bonusAmount);

    let commissionAmount = null;
    let hourlyEarnings = null;
    let baseSalaryStored = null;
    let totalPay = 0;
    const hours = num(hoursWorked);

    if (employee.payType === 'commission') {
      commissionAmount = totalRevenue * techShareNormalized(employee);
      totalPay = commissionAmount + totalTips + bonus;
    } else if (employee.payType === 'hourly') {
      const hr = num(employee.hourlyRate);
      hourlyEarnings = hours * hr;
      totalPay = hourlyEarnings + totalTips + bonus;
    } else if (employee.payType === 'salary') {
      baseSalaryStored = num(employee.baseSalary);
      totalPay = baseSalaryStored + totalTips + bonus;
    } else {
      const e = new Error('Unknown payType');
      e.status = 400;
      throw e;
    }

    const row = await Payroll.create({
      employeeId,
      periodStart,
      periodEnd,
      totalServices,
      totalRevenue,
      commissionAmount,
      hoursWorked: employee.payType === 'hourly' ? hours || null : null,
      hourlyEarnings,
      baseSalary: employee.payType === 'salary' ? baseSalaryStored : null,
      totalTips,
      bonusAmount: bonus,
      totalPay,
      status: 'draft',
      notes,
    });

    const full = await Payroll.findByPk(row.id, { include: [Employee] });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
}

async function getAllPayrolls(req, res, next) {
  try {
    const { start, end } = req.query;
    const where = {};
    if (start && end) {
      where[Op.and] = [
        { periodStart: { [Op.lte]: end } },
        { periodEnd: { [Op.gte]: start } },
      ];
    }
    const rows = await Payroll.findAll({
      where,
      include: [{ model: Employee, attributes: ['id', 'firstName', 'lastName', 'payType'] }],
      order: [['periodEnd', 'DESC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function updatePayrollStatus(req, res, next) {
  try {
    const row = await Payroll.findByPk(req.params.id);
    if (!row) {
      const e = new Error('Payroll not found');
      e.status = 404;
      throw e;
    }
    const { status } = req.body;
    if (!['draft', 'approved', 'paid'].includes(status)) {
      const e = new Error('status must be draft, approved, or paid');
      e.status = 400;
      throw e;
    }
    await row.update({ status });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function getPayrollSummary(req, res, next) {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      const e = new Error('Query params start and end (YYYY-MM-DD) are required');
      e.status = 400;
      throw e;
    }
    const r = await Payroll.findOne({
      where: {
        [Op.and]: [
          { periodStart: { [Op.lte]: end } },
          { periodEnd: { [Op.gte]: start } },
        ],
      },
      attributes: [
        [fn('SUM', col('totalPay')), 'totalPayout'],
        [fn('COUNT', col('id')), 'payrollCount'],
      ],
      raw: true,
    });
    res.json({
      period: { start, end },
      totalPayout: parseFloat(r.totalPayout || 0),
      payrollCount: parseInt(r.payrollCount || 0, 10),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generatePayroll,
  getAllPayrolls,
  updatePayrollStatus,
  getPayrollSummary,
};
