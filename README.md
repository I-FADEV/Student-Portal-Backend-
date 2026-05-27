# Student Portal Backend

A comprehensive backend system for managing student information, authentication, financial records, ID cards, timetables, courses, and academic results. Built with **Express.js**, **MongoDB**, and **Node.js**.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [Authentication & Authorization](#authentication--authorization)
- [Middleware](#middleware)

---

## Overview

The Student Portal Backend is an educational management system designed to facilitate student registration, authentication, and access to academic records. It supports multiple user roles with role-based access control (RBAC) and provides comprehensive features for managing student data across various departments.

### Key Users

- **Students**: View and manage their academic records, financial status, and profile information
- **Admin Users**: Manage students, verify ID cards, handle finance records, and oversee timetables
  - General Admin
  - Finance Admin
  - ID Card Admin
  - Timetable Admin

---

## Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js 4.19.2
- **Database**: MongoDB 8.23.0 (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs 2.4.3
- **File Upload**: Multer 2.1.1
- **File Storage**: Cloudinary 2.9.0
- **PDF Generation**: PDFKit 0.18.0
- **Excel Parsing**: XLSX 0.18.5
- **Rate Limiting**: express-rate-limit 8.3.2
- **Data Validation**: Joi 18.1.2
- **Logging**: Morgan 1.10.1
- **CORS**: cors 2.8.5

---

## Features

### 1. **Authentication System**

- Student registration and login
- Admin registration (by general admin only) and login
- JWT-based token authentication with refresh tokens
- Rate limiting on auth endpoints for security
- Password encryption using bcryptjs

### 2. **ID Card Management**

- Photo upload and storage via Cloudinary
- ID card status tracking (unsubmitted → pending → collected)
- Fee verification before ID card issuance
- Student photo submission with validation
- Admin approval workflow

### 3. **Financial Management**

- Semester-based payment tracking
- Multiple payment items per record (tuition, fees, etc.)
- Payment status tracking (pending, part-paid, fully-paid)
- Finance admin dashboard capabilities
- Automatic financial calculations and recalculations

### 4. **Academic Results**

- Course-based grading system
- Continuous assessment (test) and exam scores
- Automatic GPA calculation
- Grade point conversions
- Result management by authorized admins

### 5. **Timetable Management**

- Course scheduling by level and department
- Semester-based timetable organization
- Room assignment tracking
- Timetable admin management

### 6. **Course Management**

- Course catalog with codes and units
- Department-based organization
- Prerequisite tracking (fields available)
- Level-based course assignments

### 7. **Student Profile**

- Personal information management
- Department and level assignment
- Profile update capabilities
- Contact information storage

### 8. **Audit Logging**

- Action tracking for administrative activities
- Timestamp recording
- User identification for all actions
- Compliance and accountability tracking

---

## Project Structure

```
student-portal-backend/
├── config/              # Configuration files
│   ├── cloudinary.js    # Cloudinary setup for image storage
│   ├── db.js            # MongoDB connection
│   ├── multer.js        # File upload configuration
│   └── rateLimiter.js   # Rate limiting rules
├── controllers/         # Request handlers
│   ├── auth.controller.js
│   ├── idCard.controller.js
│   ├── profile.controller.js
│   ├── finance.controller.js
│   ├── timetable.controller.js
│   ├── course.controller.js
│   ├── result.controller.js
│   └── pdf.controller.js
├── models/              # MongoDB Schemas
│   ├── student.model.js
│   ├── admin.model.js
│   ├── idcard.model.js
│   ├── finance.model.js
│   ├── result.model.js
│   ├── timetable.model.js
│   ├── course.model.js
│   └── auditLog.model.js
├── routes/              # API routes
│   ├── auth.routes.js
│   ├── idCard.routes.js
│   ├── profile.routes.js
│   ├── finance.routes.js
│   ├── timetable.routes.js
│   ├── course.routes.js
│   └── result.routes.js
├── middleware/          # Custom middleware
│   ├── auth.middleware.js       # JWT verification
│   ├── roleCheck.middleware.js  # RBAC
│   ├── error.middleware.js      # Error handling
│   ├── validate.middleware.js   # Joi validation
│   └── excelParser.middleware.js # Excel parsing
├── services/            # Business logic
│   ├── auth.service.js
│   ├── profile.service.js
│   ├── finance.service.js
│   ├── idCard.service.js
│   ├── timetable.service.js
│   ├── course.service.js
│   └── result.service.js
├── utils/               # Utility functions
│   ├── appError.js              # Error handling
│   ├── generateToken.js         # JWT token generation
│   ├── logAction.js             # Audit logging
│   ├── excelParser.js           # Excel file parsing
│   ├── financeRecalculator.js   # Finance calculations
│   └── resultCalculator.js      # GPA and grade calculations
├── validation/          # Joi validation schemas
│   ├── auth.validation.js
│   └── idCard.validation.js
├── scripts/             # Utility scripts
│   └── seedGeneralAdmin.js     # Bootstrap general admin account
├── uploads/             # Local file storage directory
├── server.js            # Main application entry point
├── package.json
└── README.md
```

---

## Installation & Setup

### Prerequisites

- Node.js 20.x
- MongoDB instance (local or cloud)
- Cloudinary account (for image storage)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd student-portal-backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) section).

### Step 4: Create General Admin (Bootstrap)

```bash
node scripts/seedGeneralAdmin.js
```

### Step 5: Start Development Server

```bash
npm run dev
```

**For Production:**

```bash
npm start
```

The API will be available at `http://localhost:3000` by default.

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>

# JWT
JWT_SECRET=<your-secure-secret-key>
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=<your-secure-refresh-secret>
JWT_REFRESH_EXPIRE=30d

# Cloudinary (Image Storage)
CLOUDINARY_NAME=<your-cloudinary-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>

# CORS
FRONTEND_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

---

## API Endpoints

### Authentication Routes (`/auth`)

| Method | Endpoint            | Description                             | Auth Required |
| ------ | ------------------- | --------------------------------------- | ------------- |
| POST   | `/admin/register`   | Register new admin (General Admin only) | Yes           |
| POST   | `/admin/login`      | Admin login                             | No            |
| POST   | `/student/register` | Student registration                    | No            |
| POST   | `/student/login`    | Student login                           | No            |
| POST   | `/refresh`          | Refresh JWT token                       | No            |

### ID Card Routes (`/idcard`)

- Get student ID card status
- Submit ID card photos
- Approve/reject ID card submissions
- Generate ID card PDFs

### Profile Routes (`/profile`)

- Get student profile
- Update profile information
- Retrieve student details

### Finance Routes (`/finance`)

- Get student financial records
- Get payment status by semester
- Calculate outstanding balances
- Finance admin dashboard endpoints

### Timetable Routes (`/timetable`)

- Get student timetable
- Get course schedule by level/department
- Manage timetable (admin)

### Course Routes (`/courses`)

- Get available courses
- Get courses by department/level
- Retrieve course prerequisites

### Results Routes (`/results`)

- Get student academic results
- Get grades by course
- Calculate GPA
- Upload/manage results (admin)

---

## Database Models

### Student Model

```javascript
{
  matricNumber: String (unique),
  password: String (hashed),
  role: String (default: "student"),
  department: String,
  level: Number,
  timestamps: Date
}
```

### Admin Model

```javascript
{
  username: String (unique),
  password: String (hashed),
  role: String (default: "admin"),
  adminType: String (enum: general_admin, finance_admin, idcard_admin, timetable_admin),
  timestamps: Date
}
```

### Student ID Card Model

```javascript
{
  student: ObjectId (ref: Student),
  status: String (enum: unsubmitted, pending, collected, rejected),
  feePaid: Boolean,
  photoURL: String (Cloudinary URL),
  timestamps: Date
  // Additional personal info fields...
}
```

### Finance Model

```javascript
{
  student: ObjectId (ref: Student),
  session: String (e.g., "2025/2026"),
  semester: String (First/Second),
  items: [{
    label: String,
    amount: Number,
    // ...
  }],
  timestamps: Date
  // Payment status tracking...
}
```

### Result Model

```javascript
{
  studentId: ObjectId (ref: Student),
  courseCode: String,
  courseName: String,
  creditUnit: Number,
  test: Number (0-40),
  exam: Number,
  grade: String,
  gradePoint: Number,
  // GPA calculations...
}
```

### Additional Models

- **Course Model**: Course catalog and details
- **Timetable Model**: Schedule and room assignments
- **Audit Log Model**: Action tracking for compliance

---

## Authentication & Authorization

### JWT Flow

1. User logs in → receives access token + refresh token
2. Access token valid for 7 days
3. Use refresh token to get new access token
4. Tokens verified by `auth.middleware.js`

### Role-Based Access Control (RBAC)

- **Student**: Can view own profile, results, finance, timetable
- **General Admin**: Can register new admins, manage all admin users
- **Finance Admin**: Manage student financial records
- **ID Card Admin**: Approve/reject ID card submissions
- **Timetable Admin**: Create and manage course timetables

Role enforcement via `roleCheck.middleware.js` on protected routes.

---

## Middleware

| Middleware                  | Purpose                             |
| --------------------------- | ----------------------------------- |
| `auth.middleware.js`        | JWT token verification              |
| `roleCheck.middleware.js`   | Role-based access control           |
| `validate.middleware.js`    | Joi schema validation               |
| `error.middleware.js`       | Global error handling               |
| `excelParser.middleware.js` | Excel file parsing for bulk uploads |

---

## Running Tests

Currently, no automated tests are configured. To run tests when available:

```bash
npm test
```

---

## Production Deployment

### Before Deploying:

1. Set `NODE_ENV=production` in `.env`
2. Use strong JWT secrets
3. Configure MongoDB production instance
4. Set CORS origin to production domain
5. Enable rate limiting for production traffic
6. Use HTTPS for all connections

### Deployment Checklist:

- [ ] All environment variables configured
- [ ] Database backups enabled
- [ ] JWT secrets are cryptographically secure
- [ ] Cloudinary credentials secured
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Audit logging active

---

## Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Prevents brute force attacks
- **CORS**: Configured for specific origins
- **Input Validation**: Joi schema validation
- **Audit Logging**: Track all admin actions
- **File Upload Security**: Multer configuration + Cloudinary

---

## License

ISC

---

## Contact & Support

For issues, questions, or contributions, please refer to the project repository.
