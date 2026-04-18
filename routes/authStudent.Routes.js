const express = require('express');
const router = express.Router();
const protect = require('../middleware/verifyToken');
const {
  register,
  login,
  refresh,
  profile,
  course,
  finance,
} = require('../controllers/authStudent.controllers');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/profile', protect, profile);
router.get('/course',protect, course)
router.get('/finance',protect, finance)

module.exports = router;