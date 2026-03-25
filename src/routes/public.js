const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const blogController = require('../controllers/blogController');

router.get('/services', publicController.listServices);
router.get('/blog', blogController.listPublished);
router.get('/blog/:slug', blogController.getBySlug);
router.get('/employees', publicController.listEmployees);
router.get('/appointments/availability', publicController.getAvailability);
router.post('/appointments/book', publicController.bookPublic);

module.exports = router;
