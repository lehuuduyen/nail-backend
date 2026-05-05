const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      appointmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'appointments', key: 'id' },
      },
      employeeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'employees', key: 'id' },
      },
      serviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'services', key: 'id' },
      },
      customerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      customerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      tips: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paymentMethod: {
        type: DataTypes.ENUM('cash', 'card', 'venmo', 'zelle', 'other'),
        allowNull: false,
      },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      helcimTransactionId: {
        type: DataTypes.STRING(80),
        allowNull: true,
        unique: true,
      },
      helcimInvoiceNumber: { type: DataTypes.STRING(64), allowNull: true },
      helcimCardType: { type: DataTypes.STRING(32), allowNull: true },
      helcimCardLast4: { type: DataTypes.STRING(8), allowNull: true },
      helcimApprovalCode: { type: DataTypes.STRING(32), allowNull: true },
      helcimFeeSaverAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      paymentStatus: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'approved',
        comment: 'Giá trị phải thuộc enum_transactions_paymentStatus (vd: approved, refunded)',
      },
      refundedAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      refundReason: { type: DataTypes.TEXT, allowNull: true },
      /** walk_in | customer_pick | owner_assign | appointment */
      turnType: {
        type: DataTypes.ENUM(
          'walk_in',
          'customer_pick',
          'owner_assign',
          'appointment'
        ),
        allowNull: false,
        defaultValue: 'walk_in',
      },
      /** ID nhóm vé — tất cả dòng trong cùng 1 lần thanh toán dùng chung giá trị này */
      ticketId: { type: DataTypes.STRING(32), allowNull: true },
      /** Thứ tự vé trong ngày (toàn salon), gán khi tạo transaction */
      turnNumber: { type: DataTypes.INTEGER, allowNull: true },
      /** Chỉ walk-in tính vào xoay lượt công bằng */
      isCountedInRotation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'transactions',
      timestamps: true,
    }
  );
  return Transaction;
};
