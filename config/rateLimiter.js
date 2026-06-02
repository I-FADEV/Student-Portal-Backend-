const rateLimit = require("express-rate-limit");

// General limiter → for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 50 requests per window
  message: {
    error: "Too many request from this IP, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many login attempts, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter };
