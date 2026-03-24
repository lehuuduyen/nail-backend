const express = require('express');
const router = express.Router();
const helcimController = require('../controllers/helcimController');

router.post('/checkout', helcimController.createCheckout);
router.post('/terminal/charge', helcimController.chargeTerminal);
router.post('/confirm', helcimController.confirmPayment);
router.post('/refund', helcimController.refundPayment);
router.get('/terminal/status', helcimController.getTerminalStatus);
router.get('/transaction/:id', helcimController.getHelcimTransaction);
router.get('/summary', helcimController.getPaymentSummary);

module.exports = router;
