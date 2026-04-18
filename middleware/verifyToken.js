const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token, access denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('Token verified for:', decoded.id);
    next();
  } catch (error) {
    console.error(' Invalid token:', error.message);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

module.exports = protect;
