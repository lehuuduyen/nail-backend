const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/services', publicController.listServices);
router.get('/employees', publicController.listEmployees);
router.get('/appointments/availability', publicController.getAvailability);
router.post('/appointments/book', publicController.bookPublic);

module.exports = router;
