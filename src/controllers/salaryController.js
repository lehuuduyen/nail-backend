const { Op } = require('sequelize');
const { Transaction, Employee, Payroll } = require('../models');
const { salesExcludingTips } = require('../utils/transactionAmounts');

function num(v) {
  return parseFloat(v == null || v === '' ? 0 : v);
}

function ymd(s) {
  return String(s || '').slice(0, 10);
}

function intOr(v, d) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
}

/** Tech / owner shares of commission pool (percents 0–100, normalized). */
function commissionShares(emp) {
  let t = intOr(emp.commissionTechPct, 100);
  let o = intOr(emp.commissionOwnerPct, 0);
  if (t < 0) t = 0;
  if (o < 0) o = 0;
  const sum = t + o;
  if (sum <= 0) return { tech: 1, owner: 0 };
  return { tech: t / sum, owner: o / sum };
}

function fmtTenthPair(pctA, pctB) {
  const a = pctA / 10;
  const b = pctB / 10;
  const fmt = (x) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(1));
  return `${fmt(a)} - ${fmt(b)}`;
}

/** Label thợ–chủ: 6-4 hoặc 4.5-5.5 tùy cách lưu (tổng 10 vs tổng 100). */
function fmtCommissionSplitLabel(techRaw, ownerRaw) {
  const t = intOr(techRaw, 100);
  const o = intOr(ownerRaw, 0);
  if (t <= 10 && o <= 10 && t + o === 10) {
    return `${t} - ${o}`;
  }
  const a = t / 10;
  const b = o / 10;
  const fmt = (x) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(1));
  return `${fmt(a)} - ${fmt(b)}`;
}

exports.calculate = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate (YYYY-MM-DD) are required' });
    }
    const startStr = ymd(startDate);
    const endStr = ymd(endDate);

    const empWhere = { isActive: true };
    if (employeeId) empWhere.id = Number(employeeId);

    const employees = await Employee.findAll({
      where: empWhere,
      order: [
        ['firstName', 'ASC'],
        ['lastName', 'ASC'],
      ],
    });

    const results = [];
    for (const emp of employees) {
      const transactions = await Transaction.findAll({
        where: {
          employeeId: emp.id,
          date: { [Op.between]: [startStr, endStr] },
          paymentStatus: { [Op.ne]: 'refunded' },
        },
      });

      const totalSales = transactions.reduce((s, t) => s + salesExcludingTips(t), 0);
      let totalTips = transactions.reduce((s, t) => s + num(t.tips), 0);
      if (!emp.tipsEnabled) totalTips = 0;

      const cardTx = transactions.filter((t) => t.paymentMethod === 'card');
      const cardTips = cardTx.reduce((s, t) => s + num(t.tips), 0);
      const computedTipCredit = cardTips * 0.03;

      const existing = await Payroll.findOne({
        where: {
          employeeId: emp.id,
          periodStart: startStr,
          periodEnd: endStr,
        },
      });

      const tipCredit = existing != null ? num(existing.tipCredit) : computedTipCredit;

      const cleanFee = existing ? num(existing.cleanFee) : 0;
      const { tech: techShare, owner: ownerShare } = commissionShares(emp);

      let grossPool = 0;
      if (emp.payType === 'commission') {
        /** Toàn bộ doanh thu kỳ vào pool; chia thợ/chủ theo commissionTechPct / commissionOwnerPct. */
        grossPool = totalSales;
      } else if (emp.payType === 'hourly') {
        const hr = num(emp.hourlyRate);
        grossPool = hr > 0 ? num(existing?.hoursWorked) * hr : 0;
      } else if (emp.payType === 'salary') {
        grossPool = num(emp.baseSalary);
      }

      const commission = grossPool * techShare;

      const minPay = num(emp.minimumPay);
      const cashPctRaw = intOr(emp.cashPortionPct, 50);
      const cashPct = Math.min(100, Math.max(0, cashPctRaw));

      const ctp = intOr(emp.commissionTechPct, 100);
      const cop = intOr(emp.commissionOwnerPct, 0);
      const commSplitLabel = fmtCommissionSplitLabel(ctp, cop);
      const bonusCheckDisplay = fmtTenthPair(cashPct, 100 - cashPct);

      const baseNet = commission + totalTips - tipCredit - cleanFee;
      const computedTotalPay = Math.max(baseNet, minPay);

      const totalPay =
        existing && existing.totalPay != null ? num(existing.totalPay) : computedTotalPay;

      const minPayApplied = minPay > 0.005 && baseNet + 1e-6 < minPay;

      /**
       * Chi thêm cho thợ so với công thức (bao lương hoặc chỉnh tay totalPay). Trừ vào phần chủ.
       * Clean fee: trừ ở baseNet nên thợ không nhận — tiền ở lại tiệm → cộng vào profit chủ.
       * Tip credit: coi như tiệm giữ để bù phí quẹt tip (xấp xỉ), không cộng thêm vào profit để tránh lời ảo.
       */
      const minPaySubsidy = Math.max(0, totalPay - baseNet);
      const ownerSplitGross = grossPool * ownerShare;
      const cleanFeeN = Math.max(0, num(cleanFee));
      const profit = ownerSplitGross - minPaySubsidy + cleanFeeN;

      let cash;
      let check;
      if (existing && existing.bonusAmount != null && existing.checkDue != null) {
        cash = num(existing.bonusAmount);
        check = num(existing.checkDue);
      } else {
        cash = totalPay * (cashPct / 100);
        check = totalPay - cash;
      }

      const bonusDue = cash;
      const checkDue = check;

      results.push({
        payrollId: existing ? existing.id : null,
        employeeId: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
        bonusCheck: bonusCheckDisplay,
        commSplitLabel,
        totalSales,
        totalTips,
        commission,
        ownerSplitGross,
        minPaySubsidy,
        profit,
        tipCredit,
        computedTipCredit,
        cleanFee,
        totalPay,
        cash,
        check,
        bonusDue,
        checkDue,
        note: existing?.notes || '',
        isSaved: !!existing,
        ticketCount: transactions.length,
        payType: emp.payType,
        minimumPay: minPay,
        baseNet,
        minPayApplied,
        /** draft | approved | paid — paid = đã thanh toán thợ kỳ này */
        payrollStatus: existing
          ? String(existing.getDataValue?.('status') ?? existing.status ?? 'draft').toLowerCase()
          : 'draft',
      });
    }

    const totals = results.reduce(
      (acc, e) => ({
        totalSales: acc.totalSales + e.totalSales,
        totalTips: acc.totalTips + e.totalTips,
        commission: acc.commission + e.commission,
        ownerSplitGross: acc.ownerSplitGross + (e.ownerSplitGross || 0),
        minPaySubsidy: acc.minPaySubsidy + (e.minPaySubsidy || 0),
        profit: acc.profit + e.profit,
        tipCredit: acc.tipCredit + e.tipCredit,
        cleanFee: acc.cleanFee + e.cleanFee,
        totalPay: acc.totalPay + e.totalPay,
        bonusDue: acc.bonusDue + e.bonusDue,
        checkDue: acc.checkDue + e.checkDue,
        cash: acc.cash + e.cash,
        check: acc.check + e.check,
      }),
      {
        totalSales: 0,
        totalTips: 0,
        commission: 0,
        ownerSplitGross: 0,
        minPaySubsidy: 0,
        profit: 0,
        tipCredit: 0,
        cleanFee: 0,
        totalPay: 0,
        bonusDue: 0,
        checkDue: 0,
        cash: 0,
        check: 0,
      }
    );

    /** P&L tiệm (kỳ): profit mỗi thợ = chia chủ trên DV − bù trả thợ + clean fee giữ lại; tổng profit = tổng các dòng. */
    const shopSummary = {
      serviceRevenueTotal: totals.totalSales,
      staffTotalPay: totals.totalPay,
      tipsToStaff: totals.totalTips,
      ownerSplitGrossTotal: totals.ownerSplitGross,
      minPaySubsidyTotal: totals.minPaySubsidy,
      ownerNetProfitTotal: totals.profit,
      tipCreditTotal: totals.tipCredit,
      cleanFeeTotal: totals.cleanFee,
      commissionToTechTotal: totals.commission,
    };

    res.json({
      success: true,
      startDate: startStr,
      endDate: endStr,
      employees: results,
      totals,
      shopSummary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.save = async (req, res) => {
  try {
    const {
      employeeId,
      startDate,
      endDate,
      totalSales,
      totalTips,
      commission,
      tipCredit,
      cleanFee,
      totalPay,
      bonusAmount,
      checkDue,
      notes,
      bonusCheckRate,
      ownerProfit,
    } = req.body;

    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({ error: 'employeeId, startDate, endDate required' });
    }

    const startStr = ymd(startDate);
    const endStr = ymd(endDate);

    const [row, created] = await Payroll.findOrCreate({
      where: {
        employeeId: Number(employeeId),
        periodStart: startStr,
        periodEnd: endStr,
      },
      defaults: {
        employeeId: Number(employeeId),
        periodStart: startStr,
        periodEnd: endStr,
        totalServices: 0,
        totalRevenue: num(totalSales),
        totalTips: num(totalTips),
        commissionAmount: num(commission),
        tipCredit: num(tipCredit),
        cleanFee: num(cleanFee),
        totalPay: num(totalPay),
        bonusAmount: num(bonusAmount),
        checkDue: checkDue != null ? num(checkDue) : null,
        bonusCheckRate: bonusCheckRate != null ? num(bonusCheckRate) : null,
        ownerProfitAmount: ownerProfit != null ? num(ownerProfit) : null,
        notes: notes || null,
        status: 'draft',
      },
    });

    if (!created) {
      await row.update({
        totalRevenue: num(totalSales),
        totalTips: num(totalTips),
        commissionAmount: num(commission),
        tipCredit: num(tipCredit),
        cleanFee: num(cleanFee),
        totalPay: num(totalPay),
        bonusAmount: num(bonusAmount),
        checkDue: checkDue != null ? num(checkDue) : row.checkDue,
        bonusCheckRate: bonusCheckRate != null ? num(bonusCheckRate) : row.bonusCheckRate,
        ownerProfitAmount: ownerProfit != null ? num(ownerProfit) : row.ownerProfitAmount,
        notes: notes != null ? notes : row.notes,
      });
    }

    const full = await Payroll.findByPk(row.id, { include: [Employee] });
    res.json({ success: true, payroll: full, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findByPk(id);
    if (!payroll) return res.status(404).json({ error: 'Not found' });

    const {
      bonusAmount,
      notes,
      status,
      checkDue,
      totalPay,
      tipCredit,
      cleanFee,
      bonusCheckRate,
      ownerProfit,
    } = req.body;

    const patch = {};
    if (bonusAmount != null) patch.bonusAmount = num(bonusAmount);
    if (notes != null) patch.notes = notes;
    if (status != null) {
      const s = String(status).toLowerCase();
      if (['draft', 'approved', 'paid'].includes(s)) patch.status = s;
    }
    if (checkDue != null) patch.checkDue = num(checkDue);
    if (totalPay != null) patch.totalPay = num(totalPay);
    if (tipCredit != null) patch.tipCredit = num(tipCredit);
    if (cleanFee != null) patch.cleanFee = num(cleanFee);
    if (bonusCheckRate != null) patch.bonusCheckRate = num(bonusCheckRate);
    if (ownerProfit != null) patch.ownerProfitAmount = num(ownerProfit);

    await payroll.update(patch);
    const full = await Payroll.findByPk(payroll.id, { include: [Employee] });
    res.json({ success: true, payroll: full });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.history = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }
    const startStr = ymd(startDate);
    const endStr = ymd(endDate);

    const payrolls = await Payroll.findAll({
      where: {
        periodStart: startStr,
        periodEnd: endStr,
      },
      include: [{ model: Employee, attributes: ['id', 'firstName', 'lastName', 'payType'] }],
      order: [
        ['employeeId', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    res.json({ success: true, payrolls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
