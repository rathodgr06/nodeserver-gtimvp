const rateLimit = require('express-rate-limit');


function createApiRateLimiter() {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    message: {
      status: 429,
      message: 'Too many requests from this IP, please try again after a minute.',
      retryAfter: '60 seconds'
    },
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
      const merchantKey =
        req.headers['merchant-key'] ||
        req.body?.merchant_key ||
        'unknown';

      return `${req.ip}-${merchantKey}`;
    },

    handler: (req, res) => {
      console.warn(
        `Rate limit exceeded | IP: ${req.ip} | Merchant: ${req.headers['merchant-key']}`
      );

      res.status(429).json({
        status: 429,
        success: false,
        message: 'Too many requests. Please try again after 1 minute.',
        retryAfter: 60
      });
    }
  });
}

module.exports = createApiRateLimiter;