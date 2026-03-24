const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');

router.post('/sms', receiptController.sendSmsReceipt);

module.exports = router;
