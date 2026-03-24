const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

router.get('/daily', transactionController.getDailyRevenue);
router.get('/revenue', transactionController.getRevenueByPeriod);
router.get('/summary', transactionController.getSummaryStats);
router.get('/', transactionController.list);
router.post('/', transactionController.create);

module.exports = router;
