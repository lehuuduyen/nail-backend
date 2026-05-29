const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

router.post('/payment-intent', stripeController.createPaymentIntent);
router.get('/payment/:paymentIntentId', stripeController.getPaymentDetails);

module.exports = router;
