const rateLimit = require('express-rate-limit');

// Wallet balance rate limiter - 20 requests per minute
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 20 requests per windowMs
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again after a minute.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Optional: Custom key generator (use IP + merchant_key for better control)
  keyGenerator: (req) => {
    const merchantKey = req.headers['merchant-key'] || req.body?.merchant_key || 'unknown';
    const ip = req.ip || req.connection.remoteAddress;
    return `${ip}-${merchantKey}`;
  },
  
  // Optional: Skip rate limiting for certain conditions
  skip: (req) => {
    // Skip rate limiting for internal IPs or admin users
    // return req.ip === '127.0.0.1' || req.headers['admin-key'] === 'your-admin-key';
    return false;
  },
  
  // Optional: Custom handler when limit is exceeded
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}, Merchant: ${req.headers['merchant-key']}`);
    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many requests. Please try again after 1 minute.',
      retryAfter: 60
    });
  }
});

module.exports = { apiRateLimiter };