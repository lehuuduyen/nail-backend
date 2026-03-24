/**
 * Smoke test Helcim integration.
 * Usage: npm run test:helcim
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const helcimService = require('../services/helcimService');

async function main() {
  if (!process.env.HELCIM_API_TOKEN) {
    console.error('Missing HELCIM_API_TOKEN in .env');
    process.exit(1);
  }

  console.log('--- 1) Checkout session $45.00 ---');
  try {
    const session = await helcimService.createCheckoutSession(45.0, {
      tipAmount: 0,
      taxAmount: 0,
      internalInvoiceLabel: `NAIL-TEST-${Date.now()}`,
    });
    console.log('checkoutToken:', session.checkoutToken || '(none)');
    console.log('secretToken:', session.secretToken ? '***' : '(none)');
    console.log('invoiceNumber:', session.invoiceNumber);
  } catch (e) {
    console.error('Checkout failed:', e.message);
  }

  console.log('\n--- 2) Terminal status ---');
  const tid = process.env.HELCIM_TERMINAL_ID;
  if (!tid) {
    console.log('HELCIM_TERMINAL_ID not set — skip.');
  } else {
    try {
      const st = await helcimService.getTerminalStatus(tid);
      console.log('keys:', st && typeof st === 'object' ? Object.keys(st) : st);
    } catch (e) {
      console.error('Terminal status failed:', e.message);
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
