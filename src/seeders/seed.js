require('dotenv').config();
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  sequelize,
  User,
  Employee,
  Service,
  Transaction: Txn,
  Appointment,
  Gallery,
} = require('../models');

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function run() {
  await sequelize.authenticate();

  await sequelize.query(
    'TRUNCATE TABLE payrolls, transactions, appointments, galleries, services, employees, users RESTART IDENTITY CASCADE;'
  );

  const passwordHash = await bcrypt.hash('admin123', 10);
  await User.create({
    username: 'admin',
    password: passwordHash,
    role: 'admin',
  });

  /** Cùng nguồn với nail-app fallback + web: shared/employeesSeed.json */
  const employeesSeed = require(path.join(__dirname, '../../../shared/employeesSeed.json'));
  await Employee.bulkCreate(employeesSeed);

  const employees = await Employee.findAll({ order: [['id', 'ASC']] });

  const serviceMenuSeed = require('./serviceMenuSeed');
  await Service.bulkCreate(serviceMenuSeed);

  const services = await Service.findAll({ order: [['id', 'ASC']] });

  const payMethods = ['cash', 'card', 'venmo', 'zelle', 'other'];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const txRows = [];
  for (let i = 0; i < 20; i += 1) {
    const day = 1 + (i % Math.min(daysInMonth, 28));
    const emp = employees[i % employees.length];
    const svc = services[i % services.length];
    const tip = i % 3 === 0 ? 5 : i % 3 === 1 ? 8 : 0;
    txRows.push({
      appointmentId: null,
      employeeId: emp.id,
      serviceId: svc.id,
      customerId: null,
      amount: svc.price,
      tips: tip,
      paymentMethod: payMethods[i % payMethods.length],
      date: ymd(year, month, day),
      notes: `Sample transaction ${i + 1}`,
      paymentStatus: 'approved',
    });
  }

  await Txn.bulkCreate(txRows);

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const atToday = (hour, minute = 0) => {
    const d = new Date(today0);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const tomorrow = new Date(today0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const apptRows = [];
  for (let i = 0; i < Math.min(5, employees.length); i += 1) {
    apptRows.push({
      customerName: `Walk-in ${i + 1}`,
      customerPhone: `555010${i}`,
      employeeId: employees[i].id,
      serviceId: services[i % services.length].id,
      scheduledAt: atToday(9 + (i % 6), (i % 2) * 30),
      status: i === 0 ? 'in_progress' : 'scheduled',
    });
  }
  apptRows.push({
    customerName: 'Tomorrow booking',
    customerPhone: '5550199',
    employeeId: employees[0].id,
    serviceId: services[1].id,
    scheduledAt: new Date(tomorrow.getTime() + 11 * 60 * 60 * 1000),
    status: 'scheduled',
  });
  await Appointment.bulkCreate(apptRows);

  const u = (id) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
  await Gallery.bulkCreate([
    { imageUrl: u('1519014815893-47d9d7bbc588'), category: 'manicure', title: 'Classic French', displayOrder: 1 },
    { imageUrl: u('1604654894610-df63bc536371'), category: 'gel', title: 'Gel shine', displayOrder: 2 },
    { imageUrl: u('1522335789203-aabd1fc54bc9'), category: 'pedicure', title: 'Spa pedi', displayOrder: 3 },
    { imageUrl: u('1610997527762-d227582c8d25'), category: 'acrylic', title: 'Acrylic set', displayOrder: 4 },
    { imageUrl: u('1596462502278-27bfdc403348'), category: 'nail_art', title: 'Nail art', displayOrder: 5 },
    { imageUrl: u('1516975080664-2c7fe9f1a9a6'), category: 'manicure', title: 'Elegant nude', displayOrder: 6 },
    { imageUrl: u('1507003211169-0a1dd7228f2d'), category: 'other', title: 'Salon moment', displayOrder: 7 },
    { imageUrl: u('1560066984-138dadb4c035'), category: 'pedicure', title: 'Summer toes', displayOrder: 8 },
    { imageUrl: u('1596178065887-1198b6148b2b'), category: 'gel', title: 'Chrome gel', displayOrder: 9 },
  ]);

  console.log(
    `Seed completed: admin / admin123, 7 employees, ${serviceMenuSeed.length} menu services, 20 transactions, appointments, gallery.`
  );
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
