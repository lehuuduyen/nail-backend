const express = require('express');
const router = express.Router();
const voiceServiceAuth = require('../middleware/voiceServiceAuth');
const { Employee, Service } = require('../models');
const appointmentController = require('../controllers/appointmentController');

router.use(voiceServiceAuth);

/** Active services (compact for AI) */
router.get('/services', async (req, res, next) => {
  try {
    const rows = await Service.findAll({
      where: { isActive: true },
      order: [
        ['menuSort', 'ASC'],
        ['name', 'ASC'],
      ],
      attributes: ['id', 'name', 'price', 'duration', 'category', 'description'],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Active employees (for choosing technician) */
router.get('/employees', async (req, res, next) => {
  try {
    const rows = await Employee.findAll({
      where: { isActive: true },
      order: [['firstName', 'ASC']],
      attributes: ['id', 'firstName', 'lastName'],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/** Create appointment (same body as /api/appointments) */
router.post('/appointments', (req, res, next) => appointmentController.create(req, res, next));

module.exports = router;
