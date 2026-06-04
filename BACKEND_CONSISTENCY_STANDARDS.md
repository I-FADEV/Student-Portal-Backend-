# Backend Consistency Standards

## Purpose
This document outlines the consistency standards for the Student Portal Backend to ensure different developers working on different parts of the application maintain consistency and avoid conflicts.

## Model Field Naming Standards

### Reference Fields
- **Student references**: Use `student` (ObjectId), NOT `studentId`
  - Examples: Finance.student, IdCard.student, Result.student
  - ❌ Incorrect: Result.studentId (fixed)

### Data Types
- **Level fields**: Use `Number`, NOT `String`
  - Examples: Student.level, Course.level, Timetable.level, IdCard.level
  - ❌ Incorrect: IdCard.level as String (fixed)

### String Fields
- **Department/Faculty**: Stored in UPPERCASE in database
  - Examples: Student.department, Student.faculty
  - Normalization: Always use `.toUpperCase()` when creating
  - Querying: Always use case-insensitive regex `{ $regex: value, $options: "i" }`

## Service Layer Standards

### Data Normalization
- **Department**: Always normalize to uppercase before saving
- **Faculty**: Always normalize to uppercase before saving
- **Matric Number**: Always normalize to uppercase before saving
- **Names**: Always trim whitespace before saving

### Query Patterns
- **Department/Faculty filtering**: Always use case-insensitive regex
  ```javascript
  filter.department = { $regex: department, $options: "i" }
  filter.faculty = { $regex: faculty, $options: "i" }
  ```

### Audit Logging
- **targetType**: Must be one of the enum values in auditLog.model.js
  - Valid values: FINANCE, IDCARD, COURSE, TIMETABLE, ADMIN, RESULT, FACULTY, DEPARTMENT, MATRIC, STUDENT
- **targetId**: Optional (can be null for actions without specific document IDs)
- **affectedStudent**: Use the student ObjectId (from `student` field, not `studentId`)

## Controller Standards

### Response Format
- **Success responses**: Always use `{ data: ... }` or `{ message: ..., data: ... }`
- **Error responses**: Handled by error middleware
- **Status codes**: 
  - 200: GET requests
  - 201: POST creation
  - 204: DELETE (no content)
  - 400: Bad request
  - 404: Not found
  - 409: Conflict (duplicate)
  - 500: Server error

### Request Data
- **Extract user info**: Always use `req.user.userId` and `req.ip` from auth middleware
- **Pass to services**: Always include `performedBy: req.user.userId` and `ipAddress: req.ip`

## Model-Specific Notes

### Student Model
- Fields: name, matricNumber, password, role, department (uppercase), faculty (uppercase), level (number)
- matricNumber is unique and stored in uppercase

### IdCard Model
- student: ObjectId reference to Student
- level: Number (not String)
- department: String (uppercase)
- status enum: "unsubmitted", "pending", "collected", "rejected"

### Finance Model
- student: ObjectId reference to Student
- session: String (e.g., "2025/2026")
- semester: String enum: "First", "Second"
- paymentStatus enum: "Paid", "Partial", "Unpaid"

### Result Model
- student: ObjectId reference to Student (not studentId)
- courseCode: String with uppercase: true
- session: String (e.g., "2024/2025")
- semester: String enum: "First", "Second"
- test: Number (0-40)
- exam: Number (0-60)

### Course Model
- department: String (uppercase)
- level: Number
- session: String (e.g., "2025/2026")
- semester: String enum: "First", "Second"

### Timetable Model
- department: String (uppercase)
- level: Number
- session: String (e.g., "2025/2026")
- semester: String enum: "First", "Second"

### Department Model
- name: String
- faculty: ObjectId reference to Faculty
- minLevel: Number
- maxLevel: Number
- abbreviation: String (uppercase, unique)

### Faculty Model
- name: String

## Common Patterns

### Creating Records with Student Reference
```javascript
const record = new Model({
  student: studentId,  // Always use 'student', not 'studentId'
  // ... other fields
});
```

### Filtering by Department/Faculty
```javascript
// ❌ WRONG - exact match fails with case differences
filter.department = department;

// ✅ CORRECT - case-insensitive
filter.department = { $regex: department, $options: "i" };
```

### Normalizing String Fields
```javascript
const normalizedName = name.trim();
const normalizedDepartment = department.toUpperCase();
const normalizedFaculty = faculty.toUpperCase();
const normalizedMatric = matricNumber.toUpperCase();
```

## Recent Fixes Applied

1. **Case-insensitive filtering** (auth.controller.js, finance.service.js, registry.service.js)
   - Fixed department/faculty filtering to use case-insensitive regex

2. **Result model field naming** (result.model.js, result.service.js)
   - Changed `studentId` to `student` for consistency

3. **IdCard level data type** (idcard.model.js)
   - Changed `level` from String to Number for consistency

4. **AuditLog enum values** (auditLog.model.js)
   - Added MATRIC and STUDENT to targetType enum
   - Made targetId optional (not required)

## Checklist for New Features

When adding new features or modifying existing ones, ensure:

- [ ] Reference fields use consistent naming (e.g., `student` not `studentId`)
- [ ] Data types match existing patterns (e.g., level as Number)
- [ ] String fields are normalized (uppercase for department/faculty/matric)
- [ ] Filtering uses case-insensitive regex for department/faculty
- [ ] Audit logging uses correct targetType from enum
- [ ] Response format matches existing patterns
- [ ] Request data includes performedBy and ipAddress
- [ ] Update this document if new patterns are established
