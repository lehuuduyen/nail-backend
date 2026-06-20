const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { uploadServiceImage } = require('../middleware/uploadServiceImage');

router.get('/popular', serviceController.getPopularServices);
router.get('/', serviceController.list);
router.post('/', serviceController.create);
router.get('/:id', serviceController.getById);
router.put('/:id', serviceController.update);
router.post('/:id/image', uploadServiceImage, serviceController.uploadImage);
router.delete('/:id', serviceController.remove);

module.exports = router;
