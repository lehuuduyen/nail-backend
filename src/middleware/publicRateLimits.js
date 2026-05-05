const rateLimit = require('express-rate-limit');

function limiter(opts) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    ...opts,
  });
}

exports.publicBookingPost = limiter({
  windowMs: 15 * 60 * 1000,
  max: Math.max(5, parseInt(process.env.RATE_LIMIT_BOOK_MAX || '30', 10) || 30),
  message: { error: 'Too many booking attempts. Please try again later.' },
});

exports.publicAvailabilityGet = limiter({
  windowMs: 60 * 1000,
  max: Math.max(20, parseInt(process.env.RATE_LIMIT_AVAILABILITY_MAX || '120', 10) || 120),
  message: { error: 'Too many requests. Please slow down.' },
});
