const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const Student = require("../models/student.model");
const Admin = require("../models/admin.model");

// GET /session/active - check if user session is active
router.get("/active", protect, async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    
    let user;
    if (role === "student") {
      user = await Student.findById(userId).select("-password");
    } else if (role === "admin") {
      user = await Admin.findById(userId).select("-password");
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      active: true,
      user: {
        id: user._id,
        role: user.role,
        ...(user.adminType && { adminType: user.adminType }),
        ...(user.username && { username: user.username }),
        ...(user.name && { name: user.name }),
        ...(user.matricNumber && { matricNumber: user.matricNumber }),
        ...(user.department && { department: user.department }),
        ...(user.faculty && { faculty: user.faculty }),
        ...(user.level && { level: user.level }),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /session/logout - logout user (client-side token deletion)
router.post("/logout", protect, async (req, res, next) => {
  try {
    // JWT tokens are stateless, so logout is handled client-side by deleting the token
    // This endpoint is for logging the logout action if needed
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
