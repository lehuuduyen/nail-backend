const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const turnController = require('../controllers/turnController');

router.get('/check-turn', authMiddleware, turnController.getCheckTurnColumns);
router.get('/today', authMiddleware, turnController.getTodayTurns);
router.get('/by-date', authMiddleware, turnController.getTurnsByDate);

module.exports = router;
