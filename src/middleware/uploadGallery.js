const path = require('path');
const fs = require('fs');
const multer = require('multer');

const dir = path.join(__dirname, '../../public/uploads/gallery');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      cb(new Error('Only image uploads allowed'));
      return;
    }
    cb(null, true);
  },
});

module.exports = { uploadGallery: upload.single('image') };
