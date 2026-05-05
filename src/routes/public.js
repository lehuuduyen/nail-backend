const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const blogController = require('../controllers/blogController');
const checkinController = require('../controllers/checkinController');

router.get('/salon', publicController.getSalonInfo);
router.get('/services/menu', publicController.listServicesMenu);
router.get('/services', publicController.listServices);
router.get('/blog', blogController.listPublished);
router.get('/blog/:slug', blogController.getBySlug);
router.get('/employees', publicController.listEmployees);
router.get('/appointments/availability', publicController.getAvailability);
router.post('/appointments/book', publicController.bookPublic);

// Check-in kiosk
router.get('/checkin', checkinController.lookup);
router.post('/checkin/register', checkinController.register);
router.patch('/checkin/face-enrolled', checkinController.markFaceEnrolled);
router.post('/checkin/arrive', checkinController.arrive);
router.get('/checkin/waiting', checkinController.waiting);

module.exports = router;
