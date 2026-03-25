require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 5001;

/** Set true after first successful sequelize.authenticate (for /health/ready). */
let dbReady = false;

/**
 * Register liveness first, listen immediately, then load routes.
 * If any require() throws (misconfigured deploy), Railway still sees GET /health.
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'nail-backend' });
});
app.get('/health/ready', (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ ok: false, database: false });
  }
  res.json({ ok: true, database: true });
});

function connectDatabase(sequelize) {
  return sequelize
    .authenticate()
    .then(() => {
      console.log('Database connection OK — syncing schema...');
      // alter: true → thêm cột mới, KHÔNG xóa data cũ
      return sequelize.sync({ alter: true });
    })
    .then(() => {
      dbReady = true;
      console.log('Database schema synced OK');
    })
    .catch((err) => {
      dbReady = false;
      console.error('Database connection/sync failed:', err.message);
      console.error(
        'Fix DATABASE_URL (Railway Postgres → Variables) then redeploy or wait for retry.'
      );
      setTimeout(() => connectDatabase(sequelize), 5000);
    });
}

function mountAppStack() {
  const cors = require('cors');
  const morgan = require('morgan');
  const routes = require('./routes');
  const errorHandler = require('./middleware/errorHandler');
  const { sequelize } = require('./models');

  app.use(cors());
  app.use(
    express.json({
      verify: (req, res, buf) => {
        if (String(req.originalUrl || '').includes('/helcim/webhook')) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(morgan('dev'));
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '../public/uploads'))
  );
  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/api', routes);
  app.use(errorHandler);

  if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET is not set');
  }

  connectDatabase(sequelize);
}

app.listen(PORT, () => {
  console.log(`nail-backend listening on port ${PORT}`);
  try {
    mountAppStack();
  } catch (err) {
    console.error('Failed to mount API (fix errors and redeploy):', err);
  }
});