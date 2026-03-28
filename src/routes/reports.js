const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.get('/technician/by-date', authMiddleware, ctrl.byDate);
router.get('/technician/by-week', authMiddleware, ctrl.byWeek);
router.get('/technician/by-month', authMiddleware, ctrl.byMonth);
router.get('/technician/by-range', authMiddleware, ctrl.byRange);
router.get('/technician/by-year', authMiddleware, ctrl.byYear);

router.get('/store-income/by-date', authMiddleware, ctrl.storeIncomeByDate);
router.get('/store-income/by-range', authMiddleware, ctrl.storeIncomeByRange);

router.get('/owner-advanced', authMiddleware, ctrl.ownerAdvanced);
router.get('/pedicure-log', authMiddleware, ctrl.pedicureLog);

module.exports = router;
