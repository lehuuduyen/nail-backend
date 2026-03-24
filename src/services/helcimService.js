const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://api.helcim.com/v2';

function createClient() {
  const token = process.env.HELCIM_API_TOKEN;
  if (!token || !String(token).trim()) {
    const e = new Error(
      'HELCIM_API_TOKEN is missing. Helcim: Integrations → API Access Configuration → set HELCIM_API_TOKEN in nail-backend/.env'
    );
    e.status = 503;
    throw e;
  }
  return axios.create({
    baseURL: BASE_URL,
    timeout: 60000,
    headers: {
      'api-token': token.trim(),
      'Content-Type': 'application/json',
    },
    validateStatus: () => true,
  });
}

function toMoney2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function logHelcimError(context, err) {
  if (err.response) {
    console.error(`[Helcim] ${context} HTTP ${err.response.status}`, err.response.data);
  } else if (err.request) {
    console.error(`[Helcim] ${context} no response`, err.message);
  } else {
    console.error(`[Helcim] ${context}`, err.message);
  }
}

/**
 * POST /helcim-pay/initialize — do not send fake invoiceNumber or customerCode;
 * those must exist in Helcim when provided.
 */
async function createCheckoutSession(amount, options = {}) {
  const client = createClient();
  // Auth = header api-token (HELCIM_API_TOKEN). Không gửi checkoutToken cũ trong body — mỗi lần initialize trả checkoutToken mới cho Pay.js.
  const body = {
    paymentType: 'purchase',
    amount: toMoney2(amount),
    currency: 'USD',
    paymentMethod: 'cc',
    allowPartialCaptures: false,
    ...(options.tipAmount > 0 && { tipAmount: toMoney2(options.tipAmount) }),
    ...(options.taxAmount > 0 && { taxAmount: toMoney2(options.taxAmount) }),
    ...(options.customerCode && { customerCode: options.customerCode }),
    ...(options.feeSaver && { feeSaverEnabled: true }),
  };
  if (options.linkExistingInvoiceNumber) {
    body.invoiceNumber = options.linkExistingInvoiceNumber;
  }
  try {
    console.log('[Helcim] createCheckoutSession request', {
      amount: body.amount,
      invoice: body.invoiceNumber ?? '(auto)',
    });
    const res = await client.post('/helcim-pay/initialize', body);
    if (res.status >= 400) {
      console.error('[Helcim] createCheckoutSession failed', res.status, res.data);
      const msg = res.data?.message || res.data?.error || res.data?.errors || JSON.stringify(res.data);
      const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      e.status = res.status;
      e.data = res.data;
      throw e;
    }
    const d = res.data || {};
    const checkoutToken = d.checkoutToken || d.token || d.checkout_token;
    const secretToken = d.secretToken || d.secret_token || d.secret;
    console.log('[Helcim] createCheckoutSession OK', { checkoutToken: !!checkoutToken, secretToken: !!secretToken });
    const helcimInvoiceNo =
      d.invoiceNumber ||
      d.invoice?.invoiceNumber ||
      d.invoice?.number ||
      d.invoiceId ||
      null;
    return {
      checkoutToken,
      secretToken,
      raw: d,
      invoiceNumber: helcimInvoiceNo || options.internalInvoiceLabel || null,
    };
  } catch (err) {
    if (!err.response && !err.status) logHelcimError('createCheckoutSession', err);
    throw err;
  }
}

/**
 * Payment Hardware API — Start a purchase on paired device.
 * POST /v2/devices/{code}/payment/purchase
 * @param deviceCode Mã ghép nối trên máy (pairing / device code), thường alphanumeric — không phải mọi số trong dashboard.
 * @param transactionAmount Tổng tiền (đã gồm thuế/tip nếu POS gộp vào).
 */
async function chargeSmartTerminal(deviceCode, transactionAmount, invoiceNumber, options = {}) {
  const client = createClient();
  const code = encodeURIComponent(String(deviceCode).trim());
  const body = {
    currency: 'USD',
    transactionAmount: toMoney2(transactionAmount),
  };
  if (invoiceNumber) {
    body.invoiceNumber = invoiceNumber;
  }
  if (options.customerCode && String(options.customerCode).trim()) {
    body.customerCode = String(options.customerCode).trim();
  }
  const idempotencyKey = crypto.randomBytes(16).toString('hex').slice(0, 25);
  try {
    console.log('[Helcim] devices/.../payment/purchase', {
      deviceCode: String(deviceCode).trim(),
      transactionAmount: body.transactionAmount,
    });
    const res = await client.post(`/devices/${code}/payment/purchase`, body, {
      headers: { 'idempotency-key': idempotencyKey },
    });
    if (res.status >= 400) {
      console.error('[Helcim] chargeSmartTerminal failed', res.status, res.data);
      const msg =
        res.data?.message ||
        res.data?.error ||
        (Array.isArray(res.data) && res.data.length === 0
          ? `Helcim HTTP ${res.status} — kiểm tra mã máy (device pairing code), bật pairing/API mode, và quyền API PositiveTransaction`
          : `Helcim HTTP ${res.status}`);
      const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      e.status = res.status;
      e.data = res.data;
      throw e;
    }
    console.log('[Helcim] chargeSmartTerminal OK');
    return res.data;
  } catch (err) {
    if (!err.response && !err.status) logHelcimError('chargeSmartTerminal', err);
    throw err;
  }
}

async function getTransactionStatus(helcimTransactionId) {
  const client = createClient();
  const id = encodeURIComponent(String(helcimTransactionId));
  try {
    const res = await client.get(`/payment/${id}`);
    if (res.status >= 400) {
      const e = new Error(res.data?.message || `Helcim HTTP ${res.status}`);
      e.status = res.status;
      e.data = res.data;
      throw e;
    }
    return res.data;
  } catch (err) {
    if (!err.response && !err.status) logHelcimError('getTransactionStatus', err);
    throw err;
  }
}

async function refundTransaction(helcimTransactionId, amount, reason = '') {
  const client = createClient();
  const body = {
    originalTransactionId: helcimTransactionId,
    amount: toMoney2(amount),
    currency: 'USD',
    comments: reason || '',
  };
  try {
    const res = await client.post('/payment/refund', body);
    if (res.status >= 400) {
      const e = new Error(res.data?.message || res.data?.error || `Helcim HTTP ${res.status}`);
      e.status = res.status;
      e.data = res.data;
      throw e;
    }
    return res.data;
  } catch (err) {
    if (!err.response && !err.status) logHelcimError('refundTransaction', err);
    throw err;
  }
}

async function getTerminalStatus(deviceCode) {
  const client = createClient();
  const id = encodeURIComponent(String(deviceCode).trim());
  try {
    let res = await client.get(`/devices/${id}`);
    if (res.status === 404) {
      res = await client.get(`/smart-terminal/${id}`);
    }
    if (res.status >= 400) {
      const e = new Error(res.data?.message || `Helcim HTTP ${res.status}`);
      e.status = res.status;
      e.data = res.data;
      throw e;
    }
    return res.data;
  } catch (err) {
    if (!err.response && !err.status) logHelcimError('getTerminalStatus', err);
    throw err;
  }
}

function verifyWebhookSignature(payload, signature, secret) {
  if (!secret || signature == null || payload == null) {
    return false;
  }
  const payloadStr = typeof payload === 'string' ? payload : String(payload);
  const hmac = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  let sig = String(signature).trim();
  if (sig.toLowerCase().startsWith('sha256=')) {
    sig = sig.slice(7);
  }
  if (hmac.length !== sig.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}

module.exports = {
  createCheckoutSession,
  chargeSmartTerminal,
  getTransactionStatus,
  refundTransaction,
  getTerminalStatus,
  verifyWebhookSignature,
  toMoney2,
};
