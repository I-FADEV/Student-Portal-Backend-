const jwt = require("jsonwebtoken");

const generateToken = (userId, role, adminType = null, tokenVersion = 0) => {
  return jwt.sign({ userId, role, adminType, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

module.exports = generateToken;
