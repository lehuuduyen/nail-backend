const crypto = require('crypto');
const { Op } = require('sequelize');
const { Appointment, Employee, Service } = require('../models');

const SLOT_MINUTES = 30;

/** Mon–Sat 9:30–7:00, Sun 10:00–4:00 (matches Nice Nails Phoenix style hours). */
function dayMinutesBounds(dateStr) {
  const probe = new Date(`${dateStr}T12:00:00`);
  const dow = probe.getDay();
  if (dow === 0) {
    return { openM: 10 * 60, closeM: 16 * 60 };
  }
  return { openM: 9 * 60 + 30, closeM: 19 * 60 };
}

function dateDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
}

function apptWindowMs(scheduledAt, durationMin) {
  const s = new Date(scheduledAt).getTime();
  return { start: s, end: s + durationMin * 60 * 1000 };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const PUBLIC_SERVICE_CATEGORY_ORDER = [
  'manicure',
  'pedicure',
  'nails',
  'addon',
  'kids',
  'lash',
  'waxing',
  'head_spa',
  'facial',
];

/** Tên hiển thị tiệm — đồng bộ POS/app với SMS booking (`SALON_DISPLAY_NAME`). */
function getSalonInfo(req, res) {
  const name = process.env.SALON_DISPLAY_NAME || 'Nice Nails & Spa';
  res.json({ name });
}

async function listServices(req, res, next) {
  try {
    const rows = await Service.findAll({
      where: { isActive: true },
      order: [
        ['menuSort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/** Grouped menu for nail-website (flat list + byCategory + ordered sections). */
async function listServicesMenu(req, res, next) {
  try {
    const rows = await Service.findAll({
      where: { isActive: true },
      order: [
        ['menuSort', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    const plain = rows.map((r) => r.get({ plain: true }));
    const byCategory = {};
    for (const s of plain) {
      const c = s.category || 'other';
      if (!byCategory[c]) byCategory[c] = [];
      byCategory[c].push(s);
    }
    const categories = [];
    for (const slug of PUBLIC_SERVICE_CATEGORY_ORDER) {
      if (byCategory[slug]?.length) {
        categories.push({
          slug,
          count: byCategory[slug].length,
          services: byCategory[slug],
        });
      }
    }
    for (const slug of Object.keys(byCategory)) {
      if (!PUBLIC_SERVICE_CATEGORY_ORDER.includes(slug)) {
        categories.push({
          slug,
          count: byCategory[slug].length,
          services: byCategory[slug],
        });
      }
    }
    res.json({
      services: plain,
      byCategory,
      categories,
    });
  } catch (err) {
    next(err);
  }
}

async function listEmployees(req, res, next) {
  try {
    const rows = await Employee.findAll({
      where: { isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
      order: [['lastName', 'ASC']],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET ?employeeId=1|any&date=YYYY-MM-DD&serviceDuration=60
 */
async function getAvailability(req, res, next) {
  try {
    const { employeeId, date, serviceDuration } = req.query;
    const dateStr = date;
    const duration = Math.max(15, parseInt(serviceDuration || '60', 10) || 60);
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const e = new Error('Query param date (YYYY-MM-DD) is required');
      e.status = 400;
      throw e;
    }

    const { start: dayStart, end: dayEnd } = dateDayBounds(dateStr);
    if (dayEnd.getTime() < Date.now() - 86400000) {
      return res.json([]);
    }

    const employees = await Employee.findAll({
      where: { isActive: true },
      order: [['id', 'ASC']],
    });
    if (!employees.length) return res.json([]);

    const appts = await Appointment.findAll({
      where: {
        scheduledAt: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.notIn]: ['cancelled'] },
      },
      include: [{ model: Service, attributes: ['duration'] }],
    });

    const busyByEmp = new Map();
    employees.forEach((e) => busyByEmp.set(e.id, []));
    appts.forEach((a) => {
      const dur = a.Service?.duration ?? 60;
      const w = apptWindowMs(a.scheduledAt, dur);
      if (busyByEmp.has(a.employeeId)) {
        busyByEmp.get(a.employeeId).push(w);
      }
    });

    const { openM, closeM } = dayMinutesBounds(dateStr);
    const slots = [];
    const anyone =
      !employeeId ||
      employeeId === 'any' ||
      employeeId === 'anyone';

    for (let m = openM; m + duration <= closeM; m += SLOT_MINUTES) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const slotStart = new Date(dayStart);
      slotStart.setHours(h, min, 0, 0);
      const slotStartMs = slotStart.getTime();
      const slotEndMs = slotStartMs + duration * 60 * 1000;
      const timeKey = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      let available = false;
      if (anyone) {
        for (const emp of employees) {
          const wins = busyByEmp.get(emp.id) || [];
          const clash = wins.some((w) =>
            rangesOverlap(slotStartMs, slotEndMs, w.start, w.end)
          );
          if (!clash) {
            available = true;
            break;
          }
        }
      } else {
        const eid = parseInt(employeeId, 10);
        if (Number.isNaN(eid)) {
          const e = new Error('Invalid employeeId');
          e.status = 400;
          throw e;
        }
        const wins = busyByEmp.get(eid) || [];
        available = !wins.some((w) =>
          rangesOverlap(slotStartMs, slotEndMs, w.start, w.end)
        );
      }
      slots.push({ time: timeKey, available });
    }

    res.json(slots);
  } catch (err) {
    next(err);
  }
}

function slotFreeForEmployee(
  busyByEmp,
  employeeId,
  slotStartMs,
  slotEndMs
) {
  const wins = busyByEmp.get(employeeId) || [];
  return !wins.some((w) =>
    rangesOverlap(slotStartMs, slotEndMs, w.start, w.end)
  );
}

async function pickEmployeeForSlot(
  employees,
  busyByEmp,
  slotStartMs,
  slotEndMs
) {
  for (const emp of employees) {
    if (slotFreeForEmployee(busyByEmp, emp.id, slotStartMs, slotEndMs)) {
      return emp.id;
    }
  }
  return null;
}

async function bookPublic(req, res, next) {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      employeeId,
      serviceId,
      scheduledAt,
      notes,
    } = req.body;

    if (!customerName || !customerPhone || !serviceId || !scheduledAt) {
      const e = new Error('customerName, customerPhone, serviceId, scheduledAt required');
      e.status = 400;
      throw e;
    }

    const service = await Service.findByPk(serviceId);
    if (!service || !service.isActive) {
      const e = new Error('Invalid service');
      e.status = 400;
      throw e;
    }
    const duration = service.duration || 60;

    const slotDate = new Date(scheduledAt);
    if (Number.isNaN(slotDate.getTime())) {
      const e = new Error('Invalid scheduledAt');
      e.status = 400;
      throw e;
    }

    const y = slotDate.getFullYear();
    const mo = String(slotDate.getMonth() + 1).padStart(2, '0');
    const d = String(slotDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${mo}-${d}`;
    const { start: dayStart, end: dayEnd } = dateDayBounds(dateStr);

    const { openM, closeM } = dayMinutesBounds(dateStr);
    const slotH = slotDate.getHours();
    const slotMin = slotDate.getMinutes();
    const slotM = slotH * 60 + slotMin;
    if (slotM < openM || slotM + duration > closeM) {
      const e = new Error('Selected time is outside business hours');
      e.status = 400;
      throw e;
    }

    const employees = await Employee.findAll({
      where: { isActive: true },
      order: [['id', 'ASC']],
    });
    if (!employees.length) {
      const e = new Error('No staff available');
      e.status = 400;
      throw e;
    }

    const appts = await Appointment.findAll({
      where: {
        scheduledAt: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.notIn]: ['cancelled'] },
      },
      include: [{ model: Service, attributes: ['duration'] }],
    });

    const busyByEmp = new Map();
    employees.forEach((e) => busyByEmp.set(e.id, []));
    appts.forEach((a) => {
      const dur = a.Service?.duration ?? 60;
      const w = apptWindowMs(a.scheduledAt, dur);
      if (busyByEmp.has(a.employeeId)) {
        busyByEmp.get(a.employeeId).push(w);
      }
    });

    const slotStartMs = slotDate.getTime();
    const slotEndMs = slotStartMs + duration * 60 * 1000;

    let chosenEmployeeId = null;
    const wantAny =
      employeeId === 'any' ||
      employeeId === 'anyone' ||
      employeeId == null ||
      employeeId === '';

    if (wantAny) {
      chosenEmployeeId = await pickEmployeeForSlot(
        employees,
        busyByEmp,
        slotStartMs,
        slotEndMs
      );
    } else {
      const eid = parseInt(employeeId, 10);
      if (Number.isNaN(eid)) {
        const e = new Error('Invalid employeeId');
        e.status = 400;
        throw e;
      }
      const emp = await Employee.findByPk(eid);
      if (!emp || !emp.isActive) {
        const e = new Error('Invalid employee');
        e.status = 400;
        throw e;
      }
      if (
        !slotFreeForEmployee(busyByEmp, eid, slotStartMs, slotEndMs)
      ) {
        const e = new Error('That time slot is no longer available');
        e.status = 409;
        throw e;
      }
      chosenEmployeeId = eid;
    }

    if (!chosenEmployeeId) {
      const e = new Error('That time slot is no longer available');
      e.status = 409;
      throw e;
    }

    const confirmationNumber = `WEB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const row = await Appointment.create({
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerEmail: customerEmail ? String(customerEmail).trim() : null,
      employeeId: chosenEmployeeId,
      serviceId,
      scheduledAt: slotDate,
      status: 'scheduled',
      notes: notes ? String(notes).trim() : null,
      source: 'web',
      confirmationNumber,
    });

    try {
      await sendBookingSms({
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        scheduledAt: row.scheduledAt,
        confirmationNumber,
      });
    } catch (smsErr) {
      console.warn('SMS skipped:', smsErr.message);
    }

    res.status(201).json({
      success: true,
      appointmentId: row.id,
      confirmationNumber,
      employeeId: chosenEmployeeId,
    });
  } catch (err) {
    next(err);
  }
}

async function sendBookingSms({
  customerName,
  customerPhone,
  scheduledAt,
  confirmationNumber,
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return;

  const salon = process.env.SALON_DISPLAY_NAME || 'Nice Nails & Spa';
  const when = new Date(scheduledAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const body = `Hi ${customerName}! Your appointment at ${salon} is confirmed for ${when}. Ref: ${confirmationNumber}. See you soon!`;

  const twilio = require('twilio')(sid, token);
  const to = normalizePhoneE164(customerPhone);
  if (!to) return;
  await twilio.messages.create({ from, to, body });
}

function normalizePhoneE164(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (raw.startsWith('+')) return raw;
  return null;
}

module.exports = {
  getSalonInfo,
  listServices,
  listServicesMenu,
  listEmployees,
  getAvailability,
  bookPublic,
};
