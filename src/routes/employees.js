const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

router.get('/', employeeController.list);
router.post('/', employeeController.create);
router.get('/:id/stats', employeeController.getEmployeeStats);
router.get('/:id', employeeController.getById);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

module.exports = router;
