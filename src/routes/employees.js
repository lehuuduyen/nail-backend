const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { uploadAvatar } = require('../middleware/uploadAvatar');

router.get('/', employeeController.list);
router.post('/', employeeController.create);
router.post('/:id/avatar', uploadAvatar, employeeController.uploadAvatar);
router.get('/:id/stats', employeeController.getEmployeeStats);
router.get('/:id', employeeController.getById);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.remove);

module.exports = router;
