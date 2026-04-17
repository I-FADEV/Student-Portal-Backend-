const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  // 1. Get the token from the request headers
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token, access denied" });
  }

  // 2. Extract just the token (remove "Bearer " prefix)
  const token = authHeader.split(" ")[1];

  // 3. Verify the token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info to req for next handler
    next(); // everything is fine — continue to the route
  } catch (error) {
    console.error(error.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = protect;
