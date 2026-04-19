const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const User = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");

// Register
const register = async (req, res, next) => {
  try {
    const { matric_number, password, role } = req.body;

    const existingUser = await User.findOne({ matric_number });
    if (existingUser) {
      return res.status(400).json({ error: "Matric number already in use" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      matric_number,
      password: hashedPassword,
      role,
    });

    //  await logAction({});

    const token = generateToken(newUser._id, newUser.role);

    res.status(201).json({
      message: "Account created successfully!",
      user: {
        id: newUser._id,
        matric_number: newUser.matric_number,
        role: newUser.role,
      },
      token, // remove if you truly want verification first
    });
  } catch (error) {
    next(error);
  }
};

//  LOGIN
const login = async (req, res, next) => {
  try {
    const { matric_number, password } = req.body;

    const user = await User.findOne({ matric_number });
    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid matric number or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Invalid matric number or password" });
    }

    // await logAction({});

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
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

const profile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

const idcard = async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(400).json({ error: "Please upload an image file" });
    }

    // build the URL path to the saved file
    const photoURLPath = `/uploads/${req.file.filename}`;

    // save the path to the logged-in user's record
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { photoURL: photoURLPath },
      { returnDocument: "after" },
    ).select("-password");

    await user.save();

    res.status(200).json({
      message: "Avatar uploaded successfully",
      avatar: photoURLPath,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const timetable = async (req, res, next) => {};

module.exports = {
  register,
  login,
  refresh,
  profile,
  idcard,
  timetable,
};
