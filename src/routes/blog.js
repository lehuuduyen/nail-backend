const express = require('express');
const router = express.Router();
const blogAdminController = require('../controllers/blogAdminController');

router.get('/', blogAdminController.listAll);
router.get('/:id', blogAdminController.getById);
router.post('/', blogAdminController.create);
router.put('/:id', blogAdminController.update);
router.delete('/:id', blogAdminController.remove);

module.exports = router;
