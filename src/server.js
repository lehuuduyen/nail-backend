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

function startSmsCronJobs() {
  const cron = require('node-cron');
  const { Op } = require('sequelize');
  const tz = process.env.SALON_TIMEZONE || 'America/Phoenix';

  // Runs every minute — checks if current HH:MM matches configured times
  cron.schedule('* * * * *', async () => {
    try {
      const { SmsSettings, Customer, Appointment } = require('./models');
      const { sendEodThankYou, sendBirthdaySms } = require('./services/smsService');

      const settings = await SmsSettings.findOne({ where: { id: 1 } });
      if (!settings) return;

      const now = new Date();
      const currentHHMM = now.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).replace(/^24:/, '00:');

      // End-of-day thank you
      if (settings.eodEnabled && settings.eodTime === currentHHMM) {
        const tz_offset = new Date().toLocaleString('en-US', { timeZone: tz });
        const todayStr = new Date(tz_offset).toISOString().slice(0, 10);
        const dayStart = new Date(`${todayStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${todayStr}T23:59:59.999Z`);

        const completed = await Appointment.findAll({
          where: {
            completedAt: { [Op.between]: [dayStart, dayEnd] },
            status: 'completed',
            customerPhone: { [Op.ne]: null },
          },
        });

        const sent = new Set();
        for (const appt of completed) {
          if (sent.has(appt.customerPhone)) continue;
          const customer = await Customer.findOne({ where: { phone: appt.customerPhone } });
          if (!customer?.smsOptIn) continue;
          sent.add(appt.customerPhone);
          sendEodThankYou({ name: appt.customerName, phone: appt.customerPhone })
            .catch((e) => console.warn('[EOD SMS]', e.message));
        }
      }

      // Birthday SMS
      if (settings.birthdayEnabled && settings.birthdayTime === currentHHMM) {
        const todayMMDD = now.toLocaleString('en-US', { month: '2-digit', day: '2-digit', timeZone: tz });
        const [mm, dd] = todayMMDD.split('/');
        const customers = await Customer.findAll({
          where: {
            smsOptIn: true,
            birthday: { [Op.ne]: null },
          },
        });
        for (const c of customers) {
          if (!c.birthday) continue;
          const [, bMM, bDD] = String(c.birthday).split('-');
          if (bMM === mm && bDD === dd) {
            sendBirthdaySms({ name: c.name, phone: c.phone })
              .catch((e) => console.warn('[Birthday SMS]', e.message));
          }
        }
      }
    } catch (err) {
      console.warn('[SMS cron]', err.message);
    }
  }, { timezone: tz });
}

app.listen(PORT, () => {
  console.log(`nail-backend listening on port ${PORT}`);
  try {
    mountAppStack();
    startSmsCronJobs();
  } catch (err) {
    console.error('Failed to mount API (fix errors and redeploy):', err);
  }
});