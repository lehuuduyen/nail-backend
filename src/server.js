require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5001;

/** Set true after first successful sequelize.authenticate (for /health/ready). */
let dbReady = false;

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
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'nail-backend' });
});
app.get('/health/ready', (req, res) => {
  if (!dbReady) {
    return res.status(503).json({ ok: false, database: false });
  }
  res.json({ ok: true, database: true });
});
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../public/uploads'))
);
/** Trang Pay.js cho POS WebView — origin thật giúp reCAPTCHA / cookie bên thứ ba ổn định hơn */
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', routes);
app.use(errorHandler);

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set');
}

function connectDatabase() {
  return sequelize
    .authenticate()
    .then(() => {
      dbReady = true;
      console.log('Database connection OK');
    })
    .catch((err) => {
      dbReady = false;
      console.error('Database connection failed:', err.message);
      console.error(
        'Fix DATABASE_URL (Railway Postgres → Variables) then redeploy or wait for retry.'
      );
      setTimeout(connectDatabase, 5000);
    });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`nail-backend listening on http://0.0.0.0:${PORT}`);
  connectDatabase();
});
