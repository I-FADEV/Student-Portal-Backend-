const rateLimit = require("express-rate-limit");

// General limiter → for all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window
  message: {
    error: "Too many request from this IP, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    error: "Too many login attempts, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter };
