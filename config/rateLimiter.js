const rateLimit = require("express-rate-limit");

// General limiter → for all routes
const generalLimiter = rateLimit({
  keyGenerator: req => {
    try {
      const value = req.headers.authorization;
      if(value?.startsWith('Bearer ')) {
        const account = require('jsonwebtoken').verify(value.slice(7), process.env.JWT_SECRET, {algorithms:['HS256']});
        if(/^[a-f\d]{24}$/i.test(account.userId)) return `account:${account.userId}`;
      }
    } catch { /* Invalid credentials retain the IP-based limit. */ }
    return rateLimit.ipKeyGenerator(req.ip);
  },
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Shared campus networks and concurrent check-in stations share an IP.
  message: {
    error: "Too many request from this IP, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  skipSuccessfulRequests: true,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many login attempts, please try again in 15 minutes",
  },
  standardHeaders: true, // sends rate limit info in response headers
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter };
