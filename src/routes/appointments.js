const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

router.get('/day', appointmentController.getByDay);
router.get('/today', appointmentController.getToday);
router.get('/', appointmentController.list);
router.post('/', appointmentController.create);
router.put('/:id', appointmentController.update);

module.exports = router;
