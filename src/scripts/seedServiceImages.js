/**
 * Seed a distinct photo for every service (per-service images for the website).
 *
 * Downloads free, commercial-license stock photos from Pexels and stores them on
 * our own server (public/uploads/services/) so the site never depends on an
 * external CDN that could 404 later. Matches services by exact name and sets
 * `imageUrl` to the local URL. Idempotent: already-downloaded files are reused.
 *
 * Admins can later override any image in the Services admin page (upload a file
 * or paste a URL); this script only fills in the initial set.
 *
 * Usage:
 *   cd nail-backend && npm run db:alter   (once — adds the imageUrl column)
 *   cd nail-backend && npm run seed:serviceimages
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/services');

/** Pexels CDN URL for a photo id, sized for service cards. */
const pexelsUrl = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1024`;

// Exact service name → Pexels photo id. Gel variants reuse the base look.
const IMAGE_BY_NAME = {
  // ── Manicure ──
  'Manicure 1 Regular': 6135675,
  'Manicure 1 Gel': 6135675,
  'Manicure 2 Regular': 16041439,
  'Manicure 2 Gel': 16041439,
  'Manicure 3 Regular': 3997384,
  'Manicure 3 Gel': 3997384,

  // ── Pedicure ──
  'Pedicure 1': 34930123,
  'Pedicure 1 Gel': 34930123,
  'Pedicure 2': 19695948,
  'Pedicure 2 Gel': 19695948,
  'Pedicure 3': 17056222,
  'Pedicure 3 Gel': 17056222,
  'Pedicure 4': 32306096,
  'Pedicure 4 Gel': 32306096,
  'Pedicure 5': 7755554,
  'Pedicure 5 Gel': 7755554,
  'Pedicure 6': 19695949,
  'Pedicure 6 Gel': 19695949,
  'Pedicure 7': 15949785,
  'Pedicure 7 Gel': 15949785,

  // ── Nails (styles are visually distinct) ──
  'Full Set Regular': 6135680,
  'Full Set Gel': 6135680,
  'Fill In Regular': 20661202,
  'Fill In Gel': 20661202,
  'Ombre/ Marble': 34835286,
  'Fancy Nail (Your Request)': 34885842,
  'Pink & White': 34997574,
  'White Tip/ French Tip': 34997561,
  'Dipping Nail': 17471377,
  'Gel X': 17010955,

  // ── Add-ons ──
  'Color Nail': 3738369,
  'Color Nail Gel': 3738369,
  'Color Feet': 19695948,
  'Take Off Nail': 6045539,
  'Take Off Gel': 6045539,
  'Full Set Toe': 34930117,
  'Full Set Toe Gel': 34930117,
  'Acrylic Two Big Toes': 17056222,
  'Paraffin Dip': 9146381,
  'Callous Removal': 19695978,
  'Collagen Socks': 6628697,
  '10 Minutes Massage': 19695971,
  'Shiny Buffing': 3997381,
  Rhinestone: 34885844,

  // ── Kids ──
  'Kids Manicure Regular': 3997386,
  'Kids Manicure Gel': 3997386,
  'Kids Pedicure Regular': 34930117,
  'Kids Pedicure Gel': 34930117,
  'Kids Color Nail Gel': 13277178,
  'Kids Color Feet Gel': 15949785,

  // ── Lash ──
  'Eyelash Classic Full Set': 8554941,
  'Eyelash Classic Fill': 7755523,
  'Eyelash Volume Full Set': 7755525,
  'Eyelash Volume Fill': 8558536,
  'Eyelash Wispy Full Set': 7755650,
  'Eyelash Wispy Fill': 36930354,
  'Eyelash Hybrid Full Set': 35013077,
  'Eyelash Hybrid Fill': 5128234,
  'Cluster Lash': 7755650,
  'Lash Lift': 8554941,

  // ── Waxing (facial/brow) ──
  'Eyebrow Wax': 6135615,
  'Face / Chin / Lip Wax': 5178023,

  // ── Head spa ──
  'Head Spa Combo 1': 8834067,
  'Head Spa Combo 2': 23349902,
  'Head Spa Combo 3': 20092123,
  'Facial Scrub': 37229299,
  'Scalp Massage': 35176569,
  'Hand Paraffin Treatment': 6187855,

  // ── Facial ──
  'Facial Combo 1': 37229301,
  'Facial Combo 2': 37229298,
  'Facial Combo 3': 36436447,
};

/** Download a Pexels photo to public/uploads/services/ once; returns the filename. */
async function ensureLocalImage(id) {
  const filename = `px-${id}.jpg`;
  const dest = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return filename; // already downloaded
  const res = await axios.get(pexelsUrl(id), {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.pexels.com/' },
  });
  await fs.promises.writeFile(dest, res.data);
  return filename;
}

async function run() {
  const { sequelize, Service } = require('../models');
  await sequelize.authenticate();
  // Ensure the imageUrl column exists (alter, never force).
  await sequelize.sync({ alter: true });

  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const publicBase = (
    process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5001}`
  ).replace(/\/$/, '');

  const services = await Service.findAll();
  let updated = 0;
  const unmatched = [];
  const failed = [];

  for (const svc of services) {
    const id = IMAGE_BY_NAME[svc.name];
    if (!id) {
      unmatched.push(svc.name);
      continue;
    }
    try {
      const filename = await ensureLocalImage(id);
      await svc.update({ imageUrl: `${publicBase}/uploads/services/${filename}` });
      updated++;
    } catch (err) {
      failed.push(`${svc.name} (px ${id}): ${err.message}`);
    }
  }

  const missingInDb = Object.keys(IMAGE_BY_NAME).filter(
    (name) => !services.some((s) => s.name === name)
  );

  console.log(`[ServiceImages] Downloaded + linked ${updated}/${services.length} services.`);
  if (failed.length) {
    console.log(`[ServiceImages] ${failed.length} download(s) failed:`);
    failed.forEach((f) => console.log(`   - ${f}`));
  }
  if (unmatched.length) {
    console.log(`[ServiceImages] No image mapped for ${unmatched.length} service(s):`);
    unmatched.forEach((n) => console.log(`   - ${n}`));
  }
  if (missingInDb.length) {
    console.log(`[ServiceImages] ${missingInDb.length} mapped name(s) not found in DB (skipped):`);
    missingInDb.forEach((n) => console.log(`   - ${n}`));
  }

  await sequelize.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ServiceImages] Fatal:', err.message);
    process.exit(1);
  });
