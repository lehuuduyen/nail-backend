/**
 * seedTransactions.js — Tạo dữ liệu giao dịch test realistic cho 60 ngày
 *
 * Chạy: cd nail-backend && node src/seeders/seedTransactions.js
 *
 * - XÓA toàn bộ transactions, payrolls hiện có
 * - Tạo lại ~600-800 transactions trải dài 60 ngày
 * - Mix payment: 60% cash / 25% card / 10% venmo / 5% zelle
 * - ~35% có tip, ~20% là multi-service ticket (2 dịch vụ cùng ticketId)
 * - Hôm nay có 12 giao dịch để test home screen
 */

require('dotenv').config();
const path = require('path');
const { sequelize, Transaction: _Txn, Employee, Service, Payroll } = require('../models');

// ─── Helpers ───────────────────────────────────────────────────────────────

function ymd(date) {
  return date.toLocaleDateString('en-CA'); // 'YYYY-MM-DD' theo local timezone
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function nanoid8() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Tip logic: 35% có tip, range $3–$25 ────────────────────────────────────

const TIP_AMOUNTS = [0, 0, 0, 0, 0, 5, 5, 8, 8, 10, 10, 12, 15, 15, 20, 25];

function randomTip() {
  return pick(TIP_AMOUNTS);
}

// ─── Phân bổ tech trong ngày — phân phối không đều để realistic ─────────────

function buildDayEmployeePool(employees) {
  // Một số tech làm ít hơn (nghỉ / part-time)
  const pool = [];
  employees.forEach((e, i) => {
    const times = i < 3 ? 4 : i < 5 ? 3 : 2; // tech 0-2: nhiều lượt hơn
    for (let t = 0; t < times; t++) pool.push(e);
  });
  return pool;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  await sequelize.authenticate();
  console.log('DB connected');

  const employees = await Employee.findAll({ where: { isActive: true }, order: [['id', 'ASC']] });
  const services = await Service.findAll({ where: { isActive: true }, order: [['id', 'ASC']] });

  if (!employees.length || !services.length) {
    console.error('Không có employees hoặc services. Hãy chạy `npm run seed` trước.');
    process.exit(1);
  }

  console.log(`Loaded ${employees.length} employees, ${services.length} services`);

  // Xóa transactions + payrolls
  const Transaction = sequelize.models.Transaction;
  await Transaction.destroy({ truncate: true, cascade: true });
  console.log('Đã xóa transactions');

  const payMethods = ['cash', 'cash', 'cash', 'cash', 'card', 'card', 'venmo', 'zelle'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = [];

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dateStr = ymd(date);
    const isToday = dayOffset === 0;

    // Chủ nhật (getDay()===0) — ít khách hơn; thứ 7 nhiều nhất
    const dow = date.getDay();
    let txCount;
    if (isToday) txCount = 12;
    else if (dow === 0) txCount = rand(4, 7);   // Chủ nhật
    else if (dow === 6) txCount = rand(12, 18); // Thứ 7
    else txCount = rand(7, 13);                  // Thứ 2–6

    const empPool = buildDayEmployeePool(employees);
    let turnNumber = 1;

    // ~20% tickets là multi-service (2 dịch vụ)
    let i = 0;
    while (i < txCount) {
      const isMulti = i < txCount - 1 && Math.random() < 0.2;
      const ticketId = nanoid8();
      const emp = pick(empPool);
      const method = pick(payMethods);
      const tip = randomTip();

      if (isMulti) {
        // 2 services cùng ticket
        const svc1 = pick(services);
        const svc2 = pick(services.filter((s) => s.id !== svc1.id) || services);
        rows.push({
          employeeId: emp.id,
          serviceId: svc1.id,
          amount: parseFloat(svc1.price),
          tips: tip,
          paymentMethod: method,
          date: dateStr,
          paymentStatus: 'approved',
          ticketId,
          turnNumber,
          turnType: 'walk_in',
          isCountedInRotation: true,
        });
        rows.push({
          employeeId: emp.id,
          serviceId: svc2.id,
          amount: parseFloat(svc2.price),
          tips: 0,
          paymentMethod: method,
          date: dateStr,
          paymentStatus: 'approved',
          ticketId,
          turnNumber,
          turnType: 'walk_in',
          isCountedInRotation: false,
        });
        i += 2;
      } else {
        const svc = pick(services);
        rows.push({
          employeeId: emp.id,
          serviceId: svc.id,
          amount: parseFloat(svc.price),
          tips: tip,
          paymentMethod: method,
          date: dateStr,
          paymentStatus: 'approved',
          ticketId,
          turnNumber,
          turnType: 'walk_in',
          isCountedInRotation: true,
        });
        i += 1;
      }

      turnNumber++;
    }
  }

  // Insert theo batch
  const BATCH = 100;
  for (let start = 0; start < rows.length; start += BATCH) {
    await Transaction.bulkCreate(rows.slice(start, start + BATCH));
  }

  // Summary
  const byMethod = {};
  rows.forEach((r) => {
    byMethod[r.paymentMethod] = (byMethod[r.paymentMethod] || 0) + 1;
  });
  const totalRevenue = rows.reduce((s, r) => s + r.amount + r.tips, 0);
  const withTip = rows.filter((r) => r.tips > 0).length;

  console.log(`\n✅ Tạo xong ${rows.length} transactions trong 60 ngày`);
  console.log(`   Tổng doanh thu: $${totalRevenue.toFixed(2)}`);
  console.log(`   Có tip: ${withTip}/${rows.length} (${((withTip / rows.length) * 100).toFixed(0)}%)`);
  console.log(`   Phương thức thanh toán:`, byMethod);
  console.log(`   Hôm nay (${ymd(today)}):`, rows.filter((r) => r.date === ymd(today)).length, 'transactions');

  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
