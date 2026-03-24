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

sequelize
  .authenticate()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`nail-backend listening on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
