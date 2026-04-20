const {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  refreshToken,
} = require("../services/auth.service");

const adminRegister = async (req, res, next) => {
  try {
    // 1. Pull data from request body
    const { username, password } = req.body;

    const { user, token, role } = await registerAdmin({
      username,
      password,
    });

    // 5. Send back success (never send the password back)
    // Don't issue JWT yet — they must verify first
    res.status(201).json({
      message: "Account created successfully!",
      user,
      token,
      role,
    });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    // 1. Pull credentials from request body
    const { username, password } = req.body;

    const { token } = await loginAdmin({ username, password });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    next(error);
  }
};

// Register
const studentRegister = async (req, res, next) => {
  try {
    const { matricNumber, password } = req.body;

    const { user, token } = await registerStudent({
      matricNumber,
      password,
    });

    res.status(201).json({
      message: "Account created successfully!",
      user,
      token, // remove if you truly want verification first
    });
  } catch (error) {
    next(error);
  }
};

//  LOGIN
const studentLogin = async (req, res, next) => {
  try {
    const { matricNumber, password } = req.body;

    const { token } = await loginStudent({ matricNumber, password });

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
    const { oldToken } = req.body;

    const { token } = await refreshToken({ oldToken });

    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminRegister,
  adminLogin,
  studentRegister,
  studentLogin,
  refresh,
};
