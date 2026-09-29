const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const idCardRoutes = require("./routes/idCard.routes");
const profileRoutes = require("./routes/profile.routes");
const financeRoutes = require("./routes/finance.routes");
const financeTemplateRoutes = require("./routes/financeTemplate.routes");
const timetableRoutes = require("./routes/timetable.routes");
const courseRoutes = require("./routes/course.routes");
const resultRoutes = require("./routes/result.routes");
const adminRoutes = require("./routes/admin.routes");
const registryRoutes = require("./routes/registry.routes");
const matricRoutes = require("./routes/matric.routes");
const sessionRoutes = require("./routes/session.routes");


const errorHandler = require("./middleware/error.middleware");
const { generalLimiter, authLimiter } = require("./config/rateLimiter");



// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(value => value.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.set("trust proxy", 1);
app.use(generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Passport photos require authenticated access through the ID-card routes.


// Routes
app.use("/auth/admin/login", authLimiter);
app.use("/auth/student/login", authLimiter);
app.use("/auth/", authRoutes);
app.use("/announcements", require("./routes/announcement.routes"));
app.use("/staff", require("./routes/staff.routes"));
app.use("/headcount", require("./routes/headcount.routes"));
app.use("/assessments", require("./routes/assessment.routes"));
app.use("/feed", require("./routes/feed.routes"));
app.use("/idcard/", idCardRoutes);
app.use("/profile", profileRoutes);
app.use("/students", require("./routes/studentManagement.routes"));
app.use("/finance", financeRoutes);
app.use("/finance", financeTemplateRoutes);
app.use("/timetable", timetableRoutes);
app.use("/courses", courseRoutes);
app.use("/results", resultRoutes);
app.use("/admin", adminRoutes);
app.use("/registry", registryRoutes);
app.use("/matric", matricRoutes);
app.use("/session", sessionRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Student Portal API running..." });
});

app.use(errorHandler);

app.get('/health/ready', (req, res) => {
  const ready = require('mongoose').connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});
module.exports = app;
