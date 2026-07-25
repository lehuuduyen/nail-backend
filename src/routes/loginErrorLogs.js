const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { loginErrorLogPost } = require('../middleware/publicRateLimits');
const loginErrorLogController = require('../controllers/loginErrorLogController');

router.get('/', authMiddleware, loginErrorLogController.list);
router.post('/', loginErrorLogPost, loginErrorLogController.create);

module.exports = router;
