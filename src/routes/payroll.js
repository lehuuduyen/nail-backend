const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');

router.post('/generate', payrollController.generatePayroll);
router.get('/summary', payrollController.getPayrollSummary);
router.get('/', payrollController.getAllPayrolls);
router.put('/:id/status', payrollController.updatePayrollStatus);

module.exports = router;
