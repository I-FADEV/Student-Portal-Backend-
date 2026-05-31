const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
require("dotenv").config();
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth.routes");
const idCardRoutes = require("./routes/idCard.routes");
const profileRoutes = require("./routes/profile.routes");
const financeRoutes = require("./routes/finance.routes");
const timetableRoutes = require("./routes/timetable.routes");
const courseRoutes = require("./routes/course.routes");
const resultRoutes = require("./routes/result.routes");
const adminRoutes = require("./routes/admin.routes");

const errorHandler = require("./middleware/error.middleware");
const { generalLimiter, authLimiter } = require("./config/rateLimiter");

connectDB();

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://student-portal-frontend-seven.vercel.app",
];

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

app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded passport photos as static files
// Frontend accesses them as: API_BASE_URL + "/uploads/" + filename
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/auth/admin/login", authLimiter);
app.use("/auth/student/login", authLimiter);
app.use("/auth/", authRoutes);
app.use("/idcard/", idCardRoutes);
app.use("/profile", profileRoutes);
app.use("/finance", financeRoutes);
app.use("/timetable", timetableRoutes);
app.use("/courses", courseRoutes);
app.use("/results", resultRoutes);
app.use("/admin", adminRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Student Portal API running..." });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}, waiting for mongoDB connection...`,
  );
});
