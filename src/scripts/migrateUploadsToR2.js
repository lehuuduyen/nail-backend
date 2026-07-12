/**
 * Migrate ảnh local (public/uploads/**) lên Cloudflare R2 + đổi URL trong DB.
 *
 * Upload file NGUYÊN GỐC (giữ tên + đuôi) lên key `uploads/<folder>/<file>`
 * để URL trong DB chỉ cần đổi phần host — không re-encode, không đổi tên.
 * Ảnh upload MỚI qua API sẽ được sharp nén (xem services/r2Storage).
 *
 * Chạy:
 *   cd nail-backend
 *   node src/scripts/migrateUploadsToR2.js           # upload + update DB
 *   node src/scripts/migrateUploadsToR2.js --dry-run # chỉ in ra, không làm gì
 *
 * Cần đủ env R2_* trong .env (xem services/r2Storage.js). Muốn migrate DB
 * production thì trỏ DATABASE_URL sang DB đó rồi chạy lại (ảnh trên R2 đã có
 * sẵn từ lần chạy đầu, script tự skip file trùng).
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const { isR2Configured, putObject } = require('../services/r2Storage');

const DRY_RUN = process.argv.includes('--dry-run');
const FOLDERS = ['services', 'gallery', 'avatars'];
const ROOT = path.join(__dirname, '../../public/uploads');

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

async function uploadFolder(folder) {
  const dir = path.join(ROOT, folder);
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => CONTENT_TYPES[path.extname(f).toLowerCase()]);
  } catch {
    console.log(`[skip] ${dir} không tồn tại`);
    return 0;
  }
  let done = 0;
  for (const file of files) {
    const key = `uploads/${folder}/${file}`;
    if (DRY_RUN) {
      console.log(`[dry] would upload ${key}`);
      continue;
    }
    const buffer = await fs.readFile(path.join(dir, file));
    const url = await putObject(key, buffer, CONTENT_TYPES[path.extname(file).toLowerCase()]);
    done++;
    console.log(`[up] ${url}`);
  }
  console.log(`— ${folder}: ${DRY_RUN ? files.length + ' file (dry)' : done + ' file đã lên R2'}`);
  return done;
}

/** Đổi mọi URL dạng http(s)://<host-cũ>/uploads/... → <R2_PUBLIC_URL>/uploads/... */
async function updateDb() {
  const sequelize = require('../config/database');
  const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '');

  const updates = [
    ['services', 'imageUrl'],
    ['galleries', 'imageUrl'],
    ['galleries', 'thumbnailUrl'],
    ['employees', 'avatarUrl'],
  ];

  for (const [table, col] of updates) {
    const sql = `
      UPDATE "${table}"
      SET "${col}" = regexp_replace("${col}", '^https?://[^/]+/uploads/', '${publicUrl}/uploads/')
      WHERE "${col}" ~ '^https?://[^/]+/uploads/'
        AND "${col}" NOT LIKE '${publicUrl}/%'
    `;
    if (DRY_RUN) {
      const [rows] = await sequelize.query(
        `SELECT count(*) AS n FROM "${table}" WHERE "${col}" ~ '^https?://[^/]+/uploads/' AND "${col}" NOT LIKE '${publicUrl}/%'`
      );
      console.log(`[dry] ${table}.${col}: ${rows[0].n} dòng sẽ đổi URL`);
      continue;
    }
    const [, meta] = await sequelize.query(sql);
    console.log(`[db] ${table}.${col}: ${meta?.rowCount ?? '?'} dòng đã đổi URL`);
  }
}

(async () => {
  if (!isR2Configured()) {
    console.error('Thiếu env R2_* (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL). Xem src/services/r2Storage.js');
    process.exit(1);
  }
  for (const folder of FOLDERS) await uploadFolder(folder);
  await updateDb();
  console.log(DRY_RUN ? 'Dry-run xong.' : 'Migrate xong ✔');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
