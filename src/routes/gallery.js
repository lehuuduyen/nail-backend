const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const galleryController = require('../controllers/galleryController');
const { uploadGallery } = require('../middleware/uploadGallery');

router.get('/admin', authMiddleware, galleryController.listAdmin);
router.get('/', galleryController.list);

router.post('/instagram-sync', authMiddleware, galleryController.syncFromInstagram);
router.post('/from-url', authMiddleware, galleryController.createFromUrl);
router.post('/', authMiddleware, uploadGallery, galleryController.create);
router.put('/:id', authMiddleware, galleryController.update);
router.delete('/:id', authMiddleware, galleryController.remove);

module.exports = router;
