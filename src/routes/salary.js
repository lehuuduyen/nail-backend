const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const ctrl = require('../controllers/salaryController');

router.get('/calculate', authMiddleware, ctrl.calculate);
router.get('/history', authMiddleware, ctrl.history);
router.post('/save', authMiddleware, ctrl.save);
router.put('/:id', authMiddleware, ctrl.update);

module.exports = router;
