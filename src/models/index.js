const { sequelize } = require('../config/database');

const User = require('./User')(sequelize);
const Employee = require('./Employee')(sequelize);
const Service = require('./Service')(sequelize);
const Appointment = require('./Appointment')(sequelize);
const Transaction = require('./Transaction')(sequelize);
const Payroll = require('./Payroll')(sequelize);
const Gallery = require('./Gallery')(sequelize);
const BlogPost = require('./BlogPost')(sequelize);

Employee.hasMany(Appointment, { foreignKey: 'employeeId' });
Appointment.belongsTo(Employee, { foreignKey: 'employeeId' });

Service.hasMany(Appointment, { foreignKey: 'serviceId' });
Appointment.belongsTo(Service, { foreignKey: 'serviceId' });

Employee.hasMany(Transaction, { foreignKey: 'employeeId' });
Transaction.belongsTo(Employee, { foreignKey: 'employeeId' });

Service.hasMany(Transaction, { foreignKey: 'serviceId' });
Transaction.belongsTo(Service, { foreignKey: 'serviceId' });

Appointment.hasMany(Transaction, { foreignKey: 'appointmentId' });
Transaction.belongsTo(Appointment, { foreignKey: 'appointmentId' });

Employee.hasMany(Payroll, { foreignKey: 'employeeId' });
Payroll.belongsTo(Employee, { foreignKey: 'employeeId' });

module.exports = {
  sequelize,
  User,
  Employee,
  Service,
  Appointment,
  Transaction,
  Payroll,
  Gallery,
  BlogPost,
};
