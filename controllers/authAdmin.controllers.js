const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const User = require("../models/admin.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");

const register = async (req, res, next) => {
  try {
    // 1. Pull data from request body
    const { username, password, role } = req.body;

    // 2. Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already in use" });
    }

    // 3. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Save new user with hashed password
    const newUser = await User.create({
      username,
      password: hashedPassword,
      role,
    });

    // await logAction({});

    //  Create a JWT token
    const token = generateToken(newUser._id, newUser.role);

    // 5. Send back success (never send the password back)
    // Don't issue JWT yet — they must verify first
    res.status(201).json({
      message: "Account created successfully!",
      user: { id: newUser._id, username: newUser.username },
      token,
      role: newUser.role,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    // 1. Pull credentials from request body
    const { username, password } = req.body;

    // 2. Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // 3. Compare the given password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

   // logAction({});

    // 4. Create a JWT token
    const token = generateToken(user._id, user.role);

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

 
    const newToken = generateToken(decoded.userId, decoded.role);

    res.status(200).json({ token: newToken });

  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = { register, login, refresh };
