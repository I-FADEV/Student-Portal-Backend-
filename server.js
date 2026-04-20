const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middleware/error.middleware");
connectDB();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/auth/", authRoutes);

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
