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
  BlogPost,
} = require('../models');

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function run() {
  await sequelize.authenticate();

  await sequelize.query(
    'TRUNCATE TABLE payrolls, transactions, appointments, galleries, blog_posts, services, employees, users RESTART IDENTITY CASCADE;'
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

  /** Ảnh từ gallery salon: shared/gallerySeed.json (nicenailsphoenix.com/Home/Gallery) */
  const gallerySeed = require(path.join(__dirname, '../../../shared/gallerySeed.json'));
  function galleryCategory(file) {
    const n = String(file).toLowerCase();
    if (n.includes('pedicure')) return 'pedicure';
    if (n.includes('manicure')) return 'manicure';
    if (n.includes('aryclic') || n.includes('acrylic')) return 'acrylic';
    return 'other';
  }
  function galleryTitle(file) {
    const base = String(file).replace(/\.[^.]+$/, '');
    if (/^IMG_\d+$/i.test(base)) return 'Nice Nails & Spa';
    return base.replace(/_/g, ' ');
  }
  const gBase = gallerySeed.baseUrl.replace(/\/?$/, '/');
  await Gallery.bulkCreate(
    gallerySeed.files.map((file, i) => ({
      imageUrl: `${gBase}${file}`,
      category: galleryCategory(file),
      title: galleryTitle(file),
      displayOrder: i + 1,
    }))
  );

  const blogSeed = require('./blogSeed');
  await BlogPost.bulkCreate(blogSeed);

  console.log(
    `Seed completed: admin / admin123, 7 employees, ${serviceMenuSeed.length} menu services, 20 transactions, appointments, ${gallerySeed.files.length} gallery images, ${blogSeed.length} blog posts.`
  );
  await sequelize.close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
