const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

/**
 * Image storage: Cloudflare R2 khi có config, fallback disk local khi không
 * (dev không cần credentials vẫn chạy như cũ).
 *
 * Env cần cho R2:
 *   R2_ACCOUNT_ID        — Cloudflare account id (trang R2 → API)
 *   R2_ACCESS_KEY_ID     — R2 API token (Object Read & Write)
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET            — vd: nailgallery
 *   R2_PUBLIC_URL        — vd: https://pub-xxxx.r2.dev (hoặc custom domain)
 *
 * Ảnh được nén bằng sharp trước khi lưu (webp, resize theo maxWidth) nên
 * KHÔNG cần Vercel/Cloudflare image optimizer phía trước nữa.
 */

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      R2_PUBLIC_URL
  );
}

let _client = null;
function client() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/**
 * Nén ảnh: resize về tối đa maxWidth (không phóng to) + convert webp q80.
 * GIF (animation) và file sharp không đọc được thì giữ nguyên bytes.
 */
async function optimize(buffer, ext, { maxWidth = 1600 } = {}) {
  if (ext === '.gif') {
    return { buffer, ext, contentType: 'image/gif' };
  }
  try {
    const out = await sharp(buffer)
      .rotate() // theo EXIF orientation
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { buffer: out, ext: '.webp', contentType: 'image/webp' };
  } catch {
    return {
      buffer,
      ext,
      contentType: CONTENT_TYPES[ext] || 'application/octet-stream',
    };
  }
}

async function putObject(key, buffer, contentType) {
  await client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Tên file là duy nhất (timestamp+random) → cache 1 năm an toàn
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Lưu 1 buffer ảnh vào folder (services|gallery|avatars).
 * Trả về URL public đầy đủ. baseName không kèm đuôi file.
 */
async function storeBuffer(buffer, folder, { baseName, ext = '.jpg', maxWidth } = {}) {
  const name =
    baseName || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (isR2Configured()) {
    const opt = await optimize(buffer, ext.toLowerCase(), { maxWidth });
    return putObject(`uploads/${folder}/${name}${opt.ext}`, opt.buffer, opt.contentType);
  }

  // Fallback disk local (dev) — giữ nguyên behavior cũ
  const dir = path.join(__dirname, `../../public/uploads/${folder}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}${ext}`), buffer);
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || 5001}`;
  return `${base.replace(/\/$/, '')}/uploads/${folder}/${name}${ext}`;
}

/**
 * Lưu file multer (diskStorage) đã nhận: đọc → đẩy R2 → xoá file tạm.
 * Khi R2 chưa config thì giữ file tại chỗ và trả URL local như cũ.
 */
async function storeUpload(file, folder, { maxWidth } = {}) {
  const ext = (path.extname(file.filename || file.originalname) || '.jpg').toLowerCase();
  const baseName = path.basename(file.filename, ext);

  if (!isR2Configured()) {
    const base =
      process.env.PUBLIC_BASE_URL ||
      process.env.API_BASE_URL ||
      `http://localhost:${process.env.PORT || 5001}`;
    return `${base.replace(/\/$/, '')}/uploads/${folder}/${file.filename}`;
  }

  const buffer = await fs.readFile(file.path);
  const url = await storeBuffer(buffer, folder, { baseName, ext, maxWidth });
  await fs.unlink(file.path).catch(() => {});
  return url;
}

/**
 * Liệt kê object trong bucket theo prefix (vd 'uploads/gallery/').
 * Trả về [{ key, url, size, lastModified }] — tự phân trang (>1000 file).
 * Trả [] khi R2 chưa config.
 */
async function listObjects(prefix) {
  if (!isR2Configured()) return [];
  const out = [];
  let ContinuationToken;
  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        Prefix: prefix,
        ContinuationToken,
      })
    );
    for (const obj of res.Contents || []) {
      if (!obj.Key || obj.Key.endsWith('/') || !obj.Size) continue;
      out.push({
        key: obj.Key,
        url: `${R2_PUBLIC_URL}/${obj.Key}`,
        size: obj.Size,
        lastModified: obj.LastModified,
      });
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return out;
}

/** Xoá ảnh theo URL đã lưu trong DB — nhận diện R2 hay local tự xử lý. */
async function deleteByUrl(url) {
  if (!url) return;
  if (R2_PUBLIC_URL && url.startsWith(`${R2_PUBLIC_URL}/`)) {
    const key = url.slice(R2_PUBLIC_URL.length + 1);
    await client()
      .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }))
      .catch(() => {});
    return;
  }
  const urlPath = url.replace(/^https?:\/\/[^/]+/, '');
  if (!urlPath.startsWith('/uploads/')) return;
  const localPath = path.join(__dirname, '../../public', urlPath.replace(/^\//, ''));
  await fs.unlink(localPath).catch(() => {});
}

module.exports = { isR2Configured, storeBuffer, storeUpload, deleteByUrl, putObject, listObjects };
