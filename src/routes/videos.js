const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const videoController = require('../controllers/videoController');

// Admin (auth) — all videos incl. inactive
router.get('/admin', authMiddleware, videoController.listAdmin);
// Public — active videos for the website
router.get('/', videoController.listPublic);

router.post('/', authMiddleware, videoController.create);
router.put('/:id', authMiddleware, videoController.update);
router.delete('/:id', authMiddleware, videoController.remove);

module.exports = router;
