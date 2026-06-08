const Stripe = require('stripe');

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set in environment');
  return Stripe(key);
};

// ─── Online PaymentSheet ────────────────────────────────────────────────────

exports.createPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const { amount_cents, description } = req.body;
    if (!amount_cents || Number(amount_cents) <= 0) {
      return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount_cents)),
      currency: 'usd',
      description: description || 'Nail salon payment',
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('[stripe] createPaymentIntent error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const stripe = getStripe();
    const { paymentIntentId } = req.params;
    if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['payment_method'],
    });
    const pm = intent.payment_method;
    const card = pm?.card || {};
    res.json({
      status: intent.status,
      cardBrand: card.brand || null,
      cardLast4: card.last4 || null,
    });
  } catch (err) {
    console.error('[stripe] getPaymentDetails error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Stripe Terminal (máy chạm thẻ vật lý) ─────────────────────────────────

/** SDK gọi mỗi khi cần token mới để kết nối reader */
exports.createConnectionToken = async (req, res) => {
  try {
    const stripe = getStripe();
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ secret: token.secret });
  } catch (err) {
    console.error('[stripe-terminal] createConnectionToken error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/** Update amount trên PI sau khi collect card (dùng để cộng tip) */
exports.updateTerminalPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const { id } = req.params;
    const { amount_cents } = req.body;
    if (!id) return res.status(400).json({ error: 'paymentIntentId required' });
    if (!amount_cents || Number(amount_cents) <= 0)
      return res.status(400).json({ error: 'amount_cents must be positive' });
    const intent = await stripe.paymentIntents.update(id, {
      amount: Math.round(Number(amount_cents)),
    });
    res.json({ paymentIntentId: intent.id, amount: intent.amount });
  } catch (err) {
    console.error('[stripe-terminal] updateTerminalPaymentIntent error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/** Tạo PaymentIntent cho terminal (card_present) */
exports.createTerminalPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const { amount_cents, description, capture_method } = req.body;
    if (!amount_cents || Number(amount_cents) <= 0) {
      return res.status(400).json({ error: 'amount_cents must be a positive integer' });
    }
    // 'manual_preferred': giữ tiền (authorize) khi chạm thẻ, KHÔNG trừ ngay — cho
    // phép app hỏi tip + lấy chữ ký SAU rồi mới capture đúng số cuối (xem
    // captureTerminalPaymentIntent). Card network không hỗ trợ manual sẽ tự rơi về
    // 'automatic' nên vẫn an toàn nếu app không truyền capture_method.
    const allowedCaptureMethods = ['automatic', 'manual', 'manual_preferred'];
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount_cents)),
      currency: 'usd',
      description: description || 'Nail salon — terminal',
      payment_method_types: ['card_present'],
      capture_method: allowedCaptureMethods.includes(capture_method) ? capture_method : 'automatic',
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (err) {
    console.error('[stripe-terminal] createTerminalPaymentIntent error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Capture (trừ tiền thật) cho PaymentIntent đã được authorize bằng capture_method
 * thủ công. amount_to_capture có thể LỚN HƠN số tiền đã authorize ban đầu
 * ("overcapture" — dùng để cộng thêm tip chốt sau khi khách đã chạm thẻ); Stripe
 * giới hạn phần vượt tối đa 50% số đã authorize hoặc $50, tuỳ giá trị nào lớn hơn.
 */
exports.captureTerminalPaymentIntent = async (req, res) => {
  try {
    const stripe = getStripe();
    const { id } = req.params;
    const { amount_to_capture } = req.body;
    if (!id) return res.status(400).json({ error: 'paymentIntentId required' });
    if (!amount_to_capture || Number(amount_to_capture) <= 0) {
      return res.status(400).json({ error: 'amount_to_capture must be positive' });
    }
    const intent = await stripe.paymentIntents.capture(id, {
      amount_to_capture: Math.round(Number(amount_to_capture)),
    });
    res.json({
      paymentIntentId: intent.id,
      status: intent.status,
      amountReceived: intent.amount_received,
    });
  } catch (err) {
    console.error('[stripe-terminal] captureTerminalPaymentIntent error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
