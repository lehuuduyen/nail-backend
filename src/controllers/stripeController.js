const Stripe = require('stripe');

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set in environment');
  return Stripe(key);
};

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

/** Lấy card details (brand, last4) từ PaymentIntent đã completed — gọi sau khi presentPaymentSheet thành công */
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
      cardExpMonth: card.exp_month || null,
      cardExpYear: card.exp_year || null,
    });
  } catch (err) {
    console.error('[stripe] getPaymentDetails error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
