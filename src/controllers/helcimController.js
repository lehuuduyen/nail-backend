const { Op } = require('sequelize');
const {
  Transaction,
  Employee,
  Service,
} = require('../models');
const helcimService = require('../services/helcimService');

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function toMoney2(n) {
  return helcimService.toMoney2(n);
}

function isApprovedHelcimTxn(data) {
  if (!data || typeof data !== 'object') return false;
  const s = String(
    data.status || data.paymentStatus || data.transactionStatus || ''
  ).toUpperCase();
  if (s === 'APPROVED' || s === 'APPROVAL') return true;
  if (data.approved === true) return true;
  return false;
}

function extractTxnId(helcimData) {
  if (!helcimData) return null;
  return (
    helcimData.transactionId ||
    helcimData.transaction_id ||
    helcimData.id ||
    helcimData.paymentId ||
    null
  );
}

async function createCheckout(req, res) {
  try {
    const {
      amount,
      tips = 0,
      taxEnabled = false,
      employeeId,
      serviceIds = [],
      notes,
      feeSaver = false,
      helcimCustomerCode,
    } = req.body || {};

    const subtotal = toMoney2(amount);
    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        error: 'amount must be a number greater than 0',
      });
    }

    const tax = taxEnabled ? toMoney2(subtotal * 0.03) : 0;
    const tipAmt = toMoney2(tips);
    const total = toMoney2(subtotal + tax + tipAmt);

    const localRef = `NAIL-${Date.now()}`;
    const session = await helcimService.createCheckoutSession(total, {
      tipAmount: tipAmt,
      taxAmount: tax,
      feeSaver,
      ...(helcimCustomerCode && String(helcimCustomerCode).trim()
        ? { customerCode: String(helcimCustomerCode).trim() }
        : {}),
      internalInvoiceLabel: localRef,
    });

    return res.json({
      success: true,
      checkoutToken: session.checkoutToken,
      secretToken: session.secretToken,
      invoiceNumber: session.invoiceNumber || localRef,
      subtotal,
      tax,
      tips: tipAmt,
      total,
      meta: { employeeId, serviceIds, notes },
    });
  } catch (err) {
    console.error('[Helcim] createCheckout', err.message);
    const status = err.status && err.status >= 400 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err.message || 'Helcim checkout failed',
      details: err.data,
    });
  }
}

async function chargeTerminal(req, res) {
  try {
    const { amount, tips = 0, taxEnabled = false, employeeId, terminalId } = req.body || {};
    const subtotal = toMoney2(amount);
    if (!subtotal || subtotal <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be > 0' });
    }
    const tax = taxEnabled ? toMoney2(subtotal * 0.03) : 0;
    const tipAmt = toMoney2(tips);
    const total = toMoney2(subtotal + tax + tipAmt);
    const fromBody = terminalId != null ? String(terminalId).trim() : '';
    const fromEnv =
      process.env.HELCIM_TERMINAL_ID != null ? String(process.env.HELCIM_TERMINAL_ID).trim() : '';
    const tid = fromBody || fromEnv || null;
    if (!tid) {
      console.warn('[Helcim] chargeTerminal: missing terminalId — set HELCIM_TERMINAL_ID in .env');
      return res.status(400).json({
        success: false,
        error:
          'Chưa cấu hình máy chạm thẻ: đặt HELCIM_TERMINAL_ID trong nail-backend/.env = mã ghép nối (device / pairing code hiển thị trên máy sau khi bật pairing mode), hoặc gửi terminalId trong body.',
      });
    }

    const localRef = `NAIL-${Date.now()}`;
    const data = await helcimService.chargeSmartTerminal(tid, total, null, {
      tipAmount: tipAmt,
      taxAmount: tax,
    });

    const helcimTransactionId =
      data?.transactionId ||
      data?.transaction_id ||
      data?.id ||
      data?.paymentId ||
      data?.data?.transactionId ||
      data?.data?.transaction_id ||
      data?.data?.id ||
      data?.data?.data?.transactionId ||
      null;

    return res.json({
      success: true,
      invoiceNumber: localRef,
      message: 'Payment sent to terminal',
      helcim: data,
      helcimTransactionId: helcimTransactionId != null ? String(helcimTransactionId) : null,
      total,
      employeeId,
    });
  } catch (err) {
    console.error('[Helcim] chargeTerminal', err.message);
    const status = err.status && err.status >= 400 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err.message || 'Terminal charge failed',
      details: err.data,
    });
  }
}

async function confirmPayment(req, res) {
  try {
    const {
      helcimTransactionId,
      employeeId,
      serviceId,
      tips = 0,
      amount,
      cardType,
      cardLast4,
      approvalCode,
      invoiceNumber,
      feeSaverAmount = 0,
    } = req.body || {};

    if (!helcimTransactionId) {
      return res.status(400).json({ success: false, error: 'helcimTransactionId required' });
    }
    if (!employeeId || !serviceId) {
      return res.status(400).json({ success: false, error: 'employeeId and serviceId required' });
    }

    const helcimData = await helcimService.getTransactionStatus(helcimTransactionId);
    if (!isApprovedHelcimTxn(helcimData)) {
      return res.status(400).json({
        success: false,
        error: 'Helcim transaction not approved',
        helcim: helcimData,
      });
    }

    const amt = toMoney2(amount);
    const tipAmt = toMoney2(tips);
    const row = await Transaction.create({
      employeeId: Number(employeeId),
      serviceId: Number(serviceId),
      amount: amt,
      tips: tipAmt,
      paymentMethod: 'card',
      date: todayDateStr(),
      notes: invoiceNumber ? `Helcim ${invoiceNumber}` : 'Helcim confirm',
      helcimTransactionId: String(extractTxnId(helcimData) || helcimTransactionId),
      helcimInvoiceNumber: invoiceNumber || null,
      helcimCardType: cardType || helcimData.cardType || null,
      helcimCardLast4: cardLast4 || helcimData.cardLast4 || null,
      helcimApprovalCode: approvalCode || helcimData.approvalCode || null,
      helcimFeeSaverAmount: toMoney2(feeSaverAmount),
      paymentStatus: 'approved',
      refundedAmount: 0,
    });

    return res.status(201).json({ success: true, transaction: row });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'Transaction already recorded for this Helcim ID',
      });
    }
    console.error('[Helcim] confirmPayment', err.message);
    const status = err.status && err.status >= 400 ? err.status : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Confirm failed',
      details: err.data,
    });
  }
}

async function refundPayment(req, res) {
  try {
    const { transactionId, amount, reason = '' } = req.body || {};
    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'transactionId (DB id) required' });
    }
    const amt = toMoney2(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be > 0' });
    }

    const txn = await Transaction.findByPk(transactionId);
    if (!txn) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    if (!txn.helcimTransactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction has no helcimTransactionId — cannot refund via Helcim',
      });
    }

    const refund = await helcimService.refundTransaction(
      txn.helcimTransactionId,
      amt,
      reason
    );

    await txn.update({
      paymentStatus: 'refunded',
      refundedAmount: amt,
      refundReason: reason || null,
    });

    return res.json({ success: true, refund });
  } catch (err) {
    console.error('[Helcim] refundPayment', err.message);
    const status = err.status && err.status >= 400 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err.message || 'Refund failed',
      details: err.data,
    });
  }
}

async function getTerminalStatus(req, res) {
  try {
    const terminalId = process.env.HELCIM_TERMINAL_ID;
    if (!terminalId) {
      return res.status(400).json({
        success: false,
        error: 'HELCIM_TERMINAL_ID not configured',
      });
    }
    const data = await helcimService.getTerminalStatus(terminalId);
    const online =
      data?.online === true ||
      data?.status === 'online' ||
      String(data?.connectionStatus || '').toLowerCase() === 'online';
    const lastSeen =
      data?.lastSeen || data?.last_seen || data?.updatedAt || data?.updated_at || null;

    return res.json({
      success: true,
      online: Boolean(online),
      terminalId,
      lastSeen,
      raw: data,
    });
  } catch (err) {
    console.error('[Helcim] getTerminalStatus', err.message);
    const status = err.status && err.status >= 400 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err.message || 'Terminal status failed',
      details: err.data,
    });
  }
}

async function getHelcimTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'transaction id required' });
    }
    const data = await helcimService.getTransactionStatus(id);
    return res.json({
      success: true,
      approved: isApprovedHelcimTxn(data),
      data,
    });
  } catch (err) {
    console.error('[Helcim] getHelcimTransaction', err.message);
    const status = err.status && err.status >= 400 ? err.status : 502;
    return res.status(status).json({
      success: false,
      error: err.message || 'Transaction lookup failed',
      details: err.data,
    });
  }
}

async function handleWebhook(req, res) {
  try {
    const secret = process.env.HELCIM_WEBHOOK_SECRET;
    const sig =
      req.headers['helcim-signature'] ||
      req.headers['x-helcim-signature'] ||
      req.headers['Helcim-Signature'];

    const raw = req.rawBody;
    if (!helcimService.verifyWebhookSignature(raw, sig, secret)) {
      console.warn('[Helcim] webhook signature invalid');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body || {};
    const eventType = String(
      payload.eventType || payload.event || payload.type || ''
    ).toLowerCase();
    const transactionId =
      payload.transactionId ||
      payload.transaction_id ||
      payload.helcimTransactionId ||
      payload.id;
    const status = String(payload.status || '').toUpperCase();
    const amount = toMoney2(payload.amount || payload.totalAmount || 0);
    const cardType = payload.cardType || payload.card_type;
    const cardLast4 = payload.cardLast4 || payload.card_last4;
    const approvalCode = payload.approvalCode || payload.approval_code;

    if (eventType === 'payment' && status === 'APPROVED' && transactionId) {
      const existing = await Transaction.findOne({
        where: { helcimTransactionId: String(transactionId) },
      });
      if (!existing) {
        const emp = await Employee.findOne({ order: [['id', 'ASC']] });
        const svc = await Service.findOne({ order: [['id', 'ASC']] });
        if (emp && svc) {
          await Transaction.create({
            employeeId: emp.id,
            serviceId: svc.id,
            amount: amount || 0,
            tips: 0,
            paymentMethod: 'card',
            date: todayDateStr(),
            notes: 'Helcim webhook (auto)',
            helcimTransactionId: String(transactionId),
            helcimInvoiceNumber: payload.invoiceNumber || null,
            helcimCardType: cardType || null,
            helcimCardLast4: cardLast4 || null,
            helcimApprovalCode: approvalCode || null,
            helcimFeeSaverAmount: 0,
            paymentStatus: 'approved',
            refundedAmount: 0,
          });
          console.log(`[Helcim] webhook: $${amount} approved (txn ${transactionId})`);
        } else {
          console.error('[Helcim] webhook: no employee/service for auto transaction');
        }
      }
    }

    if (eventType === 'refund' || eventType === 'refunded') {
      const idRef = transactionId || payload.originalTransactionId;
      if (idRef) {
        const t = await Transaction.findOne({ where: { helcimTransactionId: String(idRef) } });
        if (t) {
          await t.update({ paymentStatus: 'refunded' });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Helcim] handleWebhook', err);
    return res.status(500).json({ error: 'Webhook handler error' });
  }
}

async function getPaymentSummary(req, res) {
  try {
    const { start, end } = req.query;
    const endDefault = todayDateStr();
    const startDefault = new Date();
    startDefault.setDate(startDefault.getDate() - 30);
    const startStr = start || startDefault.toISOString().slice(0, 10);
    const endStr = end || endDefault;

    const rows = await Transaction.findAll({
      where: {
        date: { [Op.between]: [startStr, endStr] },
      },
    });

    let total = 0;
    const byCardType = {};
    let helcimFees = 0;

    for (const r of rows) {
      const a = Number(r.amount) || 0;
      total += a;
      const key = r.helcimCardType || r.paymentMethod || 'Other';
      if (!byCardType[key]) {
        byCardType[key] = { count: 0, amount: 0 };
      }
      byCardType[key].count += 1;
      byCardType[key].amount = toMoney2(byCardType[key].amount + a);
      const fs = Number(r.helcimFeeSaverAmount) || 0;
      helcimFees += fs;
      if (r.paymentMethod === 'card' && fs === 0) {
        helcimFees += toMoney2(a * 0.03);
      }
    }

    return res.json({
      success: true,
      range: { start: startStr, end: endStr },
      total: toMoney2(total),
      byCardType,
      helcimFees: toMoney2(helcimFees),
      transactionCount: rows.length,
    });
  } catch (err) {
    console.error('[Helcim] getPaymentSummary', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  createCheckout,
  chargeTerminal,
  confirmPayment,
  refundPayment,
  getTerminalStatus,
  getHelcimTransaction,
  handleWebhook,
  getPaymentSummary,
};
