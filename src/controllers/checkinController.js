const { Op } = require('sequelize');
const { Customer, Appointment, Service, Employee, Transaction } = require('../models');

// In-memory waiting list — khách vừa check-in, chờ được phục vụ
// Tối đa 30 entries, tự hết hạn sau 3 giờ
const _waitingList = [];
const WAITING_TTL_MS = 3 * 60 * 60 * 1000;
const MAX_WAITING = 30;

function _cleanWaiting() {
  const cutoff = Date.now() - WAITING_TTL_MS;
  while (_waitingList.length > 0 && new Date(_waitingList[0].arrivedAt).getTime() < cutoff) {
    _waitingList.shift();
  }
}

async function lookup(req, res) {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    let customer = await Customer.findOne({ where: { phone } });

    // Lịch sử dịch vụ — tất cả trừ cancelled
    const pastAppointments = await Appointment.findAll({
      where: {
        customerPhone: phone,
        status: { [Op.in]: ['completed', 'in_progress', 'scheduled'] },
      },
      include: [{ model: Service, attributes: ['name', 'category'] }],
      order: [['scheduledAt', 'DESC']],
      limit: 30,
    });

    // Lịch hẹn sắp tới — status scheduled, không lọc ngày (để hiện cả lịch hẹn chưa hoàn thành)
    const upcomingAppointments = await Appointment.findAll({
      where: {
        customerPhone: phone,
        status: 'scheduled',
      },
      include: [
        { model: Service, attributes: ['name'] },
        { model: Employee, attributes: ['firstName', 'lastName'] },
      ],
      order: [['scheduledAt', 'ASC']],
      limit: 5,
    });

    // Nếu chưa có Customer record nhưng có appointment → tự tạo từ tên trong appointment
    if (!customer && pastAppointments.length > 0) {
      const name = pastAppointments[0].customerName || 'Khách hàng';
      [customer] = await Customer.findOrCreate({
        where: { phone },
        defaults: { name, faceEnrolled: false },
      });
    }

    if (!customer) return res.json({ found: false });

    // Lịch sử giao dịch POS — theo customerPhone (ưu tiên) hoặc customerId
    const txWhere = { [Op.or]: [{ customerPhone: phone }] };
    if (customer.id) txWhere[Op.or].push({ customerId: customer.id });
    const pastTransactions = await Transaction.findAll({
      where: txWhere,
      include: [{ model: Service, attributes: ['name'] }],
      order: [['date', 'DESC'], ['id', 'DESC']],
      limit: 50,
    });

    // Tổng hợp số lần sử dụng dịch vụ + ngày gần nhất (gộp appointment + transaction)
    const serviceMap = {}; // { name: { count, lastDate } }
    const _updateService = (name, dateVal) => {
      if (!serviceMap[name]) serviceMap[name] = { count: 0, lastDate: null };
      serviceMap[name].count += 1;
      if (dateVal) {
        const d = new Date(dateVal);
        if (!serviceMap[name].lastDate || d > new Date(serviceMap[name].lastDate)) {
          serviceMap[name].lastDate = d.toISOString();
        }
      }
    };
    pastAppointments.forEach((a) => {
      const name = a.Service?.name ?? 'Dịch vụ';
      _updateService(name, a.completedAt ?? a.scheduledAt);
    });
    pastTransactions.forEach((t) => {
      const name = t.Service?.name ?? 'Dịch vụ';
      _updateService(name, t.date);
    });

    const lastApptDate = pastAppointments[0]?.completedAt ?? pastAppointments[0]?.scheduledAt ?? null;
    const lastTxDate = pastTransactions[0]?.date ?? null;
    const lastVisit = lastApptDate && lastTxDate
      ? (new Date(lastApptDate) > new Date(lastTxDate) ? lastApptDate : lastTxDate)
      : (lastApptDate ?? lastTxDate);

    return res.json({
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        faceEnrolled: customer.faceEnrolled,
      },
      services: Object.entries(serviceMap)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, { count, lastDate }]) => ({ name, count, lastDate })),
      lastVisit,
      appointments: upcomingAppointments.map((a) => ({
        id: a.id,
        scheduledAt: a.scheduledAt,
        serviceName: a.Service?.name ?? 'Dịch vụ',
        employeeName: a.Employee ? `${a.Employee.firstName} ${a.Employee.lastName}`.trim() : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function register(req, res) {
  try {
    const { phone, name } = req.body;
    if (!phone || !name) return res.status(400).json({ error: 'phone and name required' });

    const [customer, created] = await Customer.findOrCreate({
      where: { phone },
      defaults: { name },
    });

    if (!created && customer.name !== name) {
      await customer.update({ name });
    }

    return res.status(created ? 201 : 200).json({
      customer: { name: customer.name, phone: customer.phone, faceEnrolled: customer.faceEnrolled },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function markFaceEnrolled(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const [updated] = await Customer.update({ faceEnrolled: true }, { where: { phone } });
    if (!updated) return res.status(404).json({ error: 'customer not found' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Khách xác nhận check-in tại kiosk → đưa vào danh sách chờ
async function arrive(req, res) {
  try {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    _cleanWaiting();

    // Xoá entry cũ của cùng SĐT (nếu check-in lại)
    const idx = _waitingList.findIndex((e) => e.phone === phone);
    if (idx !== -1) _waitingList.splice(idx, 1);

    // Đọc thông tin mới nhất từ DB
    const customer = await Customer.findOne({ where: { phone } });
    const entry = {
      phone,
      name: customer?.name || name || 'Khách',
      faceEnrolled: customer?.faceEnrolled ?? false,
      customerId: customer?.id ?? null,
      arrivedAt: new Date().toISOString(),
    };

    _waitingList.push(entry);
    if (_waitingList.length > MAX_WAITING) _waitingList.shift();

    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Trả danh sách khách đang chờ (nail-app dùng để hiện trong modal chọn khách)
function waiting(req, res) {
  _cleanWaiting();
  // Mới nhất lên đầu
  const list = [..._waitingList].reverse();
  res.json({ waiting: list });
}

module.exports = { lookup, register, markFaceEnrolled, arrive, waiting };
