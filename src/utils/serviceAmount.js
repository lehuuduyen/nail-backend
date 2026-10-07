const { num, salesExcludingTips } = require('./transactionAmounts');

// Owner edits and split payments append payment metadata after the POS line.
// Never interpret those amounts (especially disc/tip) as a service price.
function serviceLineFromNotes(notes) {
  if (typeof notes !== 'string') return null;
  const line = notes.split(/\s*·\s*(?=(?:card|cash|gift|check|disc|split|tip)\s*:)|\s*\|\s*split\s*:/i)[0].trim();
  const separator = line.lastIndexOf(':');
  if (separator < 1) return null;
  const name = line.slice(0, separator).trim();
  const price = line.slice(separator + 1).trim();
  if (/^(?:card|cash|gift|check|disc|split|tip)\s*:/i.test(line) ||
      price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return null;
  return { name, price: num(price) };
}

function grossServiceAmount(txn) {
  const amount = Number(txn.serviceAmount);
  // An explicit zero is a valid listed price, not missing historical data.
  if (txn.serviceAmount != null && txn.serviceAmount !== '' &&
      Number.isFinite(amount) && amount >= 0) return num(amount);

  const line = serviceLineFromNotes(txn.notes);
  if (line) return line.price;
  return salesExcludingTips(txn);
}

module.exports = { grossServiceAmount, serviceLineFromNotes };
