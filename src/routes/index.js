const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const helcimController = require('../controllers/helcimController');

router.use('/auth', require('./auth'));
router.use('/voice', require('./voice'));
router.use('/public', require('./public'));
router.use('/gallery', require('./gallery'));
router.use('/blog', authMiddleware, require('./blog'));
router.use('/employees', authMiddleware, require('./employees'));
router.use('/services', authMiddleware, require('./services'));
router.use('/appointments', authMiddleware, require('./appointments'));
router.use('/transactions', authMiddleware, require('./transactions'));
router.use('/turns', require('./turns'));
router.use('/payroll', authMiddleware, require('./payroll'));
router.post('/helcim/webhook', helcimController.handleWebhook);
router.use('/helcim', authMiddleware, require('./helcim'));
router.use('/receipt', authMiddleware, require('./receipt'));
router.use('/reports', require('./reports'));
router.use('/salary', require('./salary'));

module.exports = router;
