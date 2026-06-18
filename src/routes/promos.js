const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const promoController = require('../controllers/promoController');

// Admin (auth) — all promos incl. inactive
router.get('/admin', authMiddleware, promoController.listAdmin);
// Public — active promos for the website
router.get('/', promoController.listPublic);

router.post('/', authMiddleware, promoController.create);
router.put('/:id', authMiddleware, promoController.update);
router.delete('/:id', authMiddleware, promoController.remove);

module.exports = router;
