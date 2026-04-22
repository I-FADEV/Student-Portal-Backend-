const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const idCardRoutes = require("./routes/idCard.routes");
const profileRoutes = require("./routes/profile.routes");
const financeRoutes = require("./routes/finance.routes");
const errorHandler = require("./middleware/error.middleware");
const { generalLimiter, authLimiter } = require("./config/rateLimiter");
connectDB();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// apply strict limiter to auth routes only
app.use("/auth/admin/login", authLimiter);
app.use("/auth/student/login", authLimiter);
app.use("/auth/", authRoutes);
app.use("/idcard/", idCardRoutes);
app.use("/profile", profileRoutes);
app.use("/finance", financeRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Student Portal API running..." });
});

app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}, waiting for mongoDB connection...`,
  );
});
