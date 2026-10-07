const { num, salesExcludingTips } = require('./transactionAmounts');

function grossServiceAmount(txn) {
  const amount = Number(txn.serviceAmount);
  if (Number.isFinite(amount) && amount > 0) return num(amount);

  const notes = typeof txn.notes === 'string' ? txn.notes : '';
  const separator = notes.lastIndexOf(':');
  if (separator !== -1) {
    const price = notes.slice(separator + 1).trim();
    if (price !== '' && Number.isFinite(Number(price)) && Number(price) >= 0) {
      return num(price);
    }
  }
  return salesExcludingTips(txn);
}

module.exports = { grossServiceAmount };
