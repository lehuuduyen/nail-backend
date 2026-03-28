'use strict';

/**
 * POS lưu: amount = phí dịch vụ + tip (một dòng), tips = tip (trùng phần tip trong amount).
 * Doanh thu dịch vụ (total sales không gồm tip) = amount - tips.
 */
function num(v) {
  const n = parseFloat(v == null || v === '' ? 0 : v);
  return Number.isFinite(n) ? n : 0;
}

function salesExcludingTips(t) {
  return Math.max(0, num(t.amount) - num(t.tips));
}

/** Tiền thu (tổng quẹt/thu) — bằng cột amount. */
function paymentTotal(t) {
  return num(t.amount);
}

module.exports = { num, salesExcludingTips, paymentTotal };
