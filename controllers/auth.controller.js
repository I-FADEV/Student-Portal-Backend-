const {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  refreshToken,
} = require("../services/auth.service");

const adminRegister = async (req, res, next) => {
  try {
    // Bug fix: was "const { ipAddress } = req.ip" and "const { performedBy } = req.user.userId"
    // Both were destructuring primitives, which gives undefined. Fixed below:
    const ipAddress = req.ip;
    const performedBy = req.user.userId;
    const { username, password, adminType } = req.body;

    const { user, token, role, type } = await registerAdmin({
      username,
      password,
      adminType,
      performedBy,
      ipAddress,
    });

    res.status(201).json({
      message: "Account created successfully!",
      user,
      token,
      role,
      type,
    });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const ipAddress = req.ip;
    const { username, password } = req.body;

    const { token } = await loginAdmin({ username, password, ipAddress });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    next(error);
  }
};

const studentRegister = async (req, res, next) => {
  try {
    const { matricNumber, password, department, level } = req.body;

    const { user, token } = await registerStudent({
      matricNumber,
      password,
      department,
      level,
    });

    res.status(201).json({
      message: "Account created successfully!",
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

const studentLogin = async (req, res, next) => {
  try {
    const { matricNumber, password } = req.body;

    const { token } = await loginStudent({ matricNumber, password });

    res.status(200).json({ message: "Login successful", token });
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
