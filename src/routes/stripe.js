const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

// Online PaymentSheet
router.post('/payment-intent', stripeController.createPaymentIntent);
router.get('/payment/:paymentIntentId', stripeController.getPaymentDetails);

// Stripe Terminal (máy chạm thẻ vật lý)
router.post('/connection-token', stripeController.createConnectionToken);
router.post('/terminal/payment-intent', stripeController.createTerminalPaymentIntent);
router.patch('/terminal/payment-intent/:id', stripeController.updateTerminalPaymentIntent);
router.post('/terminal/payment-intent/:id/capture', stripeController.captureTerminalPaymentIntent);

module.exports = router;
