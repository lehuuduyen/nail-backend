const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.get('/popular', serviceController.getPopularServices);
router.get('/', serviceController.list);
router.post('/', serviceController.create);
router.get('/:id', serviceController.getById);
router.put('/:id', serviceController.update);
router.delete('/:id', serviceController.remove);

module.exports = router;
