const jwt = require("jsonwebtoken");

const generateToken = (userId, role, adminType = null) => {
  return jwt.sign({ userId, role, adminType }, process.env.JWT_SECRET, {
    expiresIn: "2d",
  });
};

module.exports = generateToken;
