require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const connectDB = require('./config/db');

// Routes
const authAdminRoutes   = require('./routes/authAdmin.Routes');
const authStudentRoutes = require('./routes/authStudent.Routes')

// Middleware
const errorHandler = require('./middleware/errorMiddleware');

// Connect DB
connectDB();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


//ROUTE
app.use('/auth/admin',   authAdminRoutes);
app.use('/auth/student', authStudentRoutes);


// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Student Portal API running...' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler (must be LAST)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
  process.exit(1);
});
