const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const User = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");
const Idcard = require("../models/idcard.model");
const recalculateFinance = require("../utils/financeRecalculator");

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

const createIdcard = async (req, res, next) => {
  try {
    const { nameOnCard, matricOnCard, departmentOnCard, levelOnCard } =
      req.body;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      res.status(400).json({ error: "Please upload an image file" });
    }

    // prevent duplicate ID card
    const existing = await Idcard.findOne({ user: req.user.userId });
    if (existing) {
      return res.status(400).json({ error: "ID card already exists" });
    }

    // build the URL path to the saved file
    const photoURLPath = `/uploads/${req.file.filename}`;

    const idcard = await Idcard.create({
      user: req.user.userId,
      photoURL: photoURLPath,
      nameOnCard,
      matricOnCard,
      departmentOnCard,
      levelOnCard,
    });

    // await logAction({});

    res.status(201).json({
      message: "ID card created successfully",
      data: idcard,
    });
  } catch (error) {
    next(error);
  }
};

const timetable = async (req, res, next) => {};

const courses = async (req, res, next) => {
  try {
    const { userId, department, level } = req.user;

    //await logAction({});

    res.json({ success: true, courses });
  } catch (error) {
    next(error);
  }
};

const createFinance = async (req, res, next) => {
  try {
    const { session, semester, items } = req.body;

    const existing = await Finance.findOne({
      student: req.user.userId,
      session,
      semester,
    });

    if (existing) {
      return res.status(400).json({ error: "Finance already exists" });
    }

    const finance = new Finance({
      student: req.user.userId,
      session,
      semester,
      items,
    });

    //calculate BEFORE saving
    recalculateFinance(finance);

    await finance.save();

    //await logAction({})

    res.status(201).json({ data: finance });
  } catch (error) {
    next(error);
  }
};

const payFinance = async (req, res, next) => {
  try {
    const { itemLabel, amount } = req.body;

    const finance = await Finance.findById(req.params.id);

    if (!finance) {
      return res.status(404).json({ error: "Finance not found" });
    }

    const item = finance.items.find((i) => i.label === itemLabel);

    if (!item) {
      return res.status(400).json({ error: "Item not found" });
    }

    // prevent overpayment
    if (item.paidAmount + amount > item.amount) {
      return res.status(400).json({ error: "Payment exceeds required amount" });
    }

    item.paidAmount += amount;

    //ALWAYS recalculate after change
    recalculateFinance(finance);

    await finance.save();

    // await logAction({})

    //sync ID card
    const isPaid = finance.paymentStatus === "Paid";

    await Idcard.findOneAndUpdate(
      { user: finance.student },
      { paidStatus: isPaid ? "Paid" : "Unpaid" },
    );

    res.json({ data: finance });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  profile,
  createIdcard,
  timetable,
};
