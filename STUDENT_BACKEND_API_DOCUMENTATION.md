# Student Backend API Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Data Flow](#data-flow)
6. [Error Handling](#error-handling)
7. [File Upload System](#file-upload-system)
8. [Security Features](#security-features)
9. [Integration Guidelines](#integration-guidelines)
10. [Development Setup](#development-setup)

---

## System Overview

The Ibex Backend is a Node.js/Express.js REST API built with Supabase as the database backend. It's designed to handle educational management with role-based access control, focusing on student functionality for homework management, assignments, and file submissions.

### Architecture
- **Framework**: Express.js with Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens
- **File Storage**: Hybrid storage (Supabase Storage + Cloudflare R2)
- **Security**: Role-based access control (RBAC)

### Key Features for Students
- View homework announcements by grade section
- Submit assignments with file attachments
- View class assignments and due dates
- Access grade section information
- File upload and management

---

## Authentication & Authorization

### JWT Token Structure
```json
{
  "user": {
    "id": "uuid",
    "email": "student@school.com",
    "role": "student"
  },
  "iat": 1640995200,
  "exp": 1641081600
}
```

### Authentication Flow
1. **Login**: `POST /api/auth/login`
   - Returns JWT token on successful authentication
   - Token must be included in all subsequent requests

2. **Token Validation**: Middleware validates token on each request
   - Checks token expiration
   - Verifies user exists and is active
   - Adds user data to request object

### Authorization Levels
- **Student**: Can access their enrolled classes and grade sections
- **Teacher**: Can manage their assigned classes and grade sections
- **Admin**: Full system access

### Middleware Functions
```javascript
// Student-only access
const { studentOnly } = require('../middleware/auth');

// Token authentication (required for all protected routes)
const { authenticateToken } = require('../middleware/auth');
```

---

## Database Schema

### Core Tables for Student Functionality

#### 1. Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20), -- 'student', 'teacher', 'admin'
    status VARCHAR(20), -- 'active', 'inactive'
    school_id UUID REFERENCES schools(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### 2. Grade Sections Table
```sql
CREATE TABLE grade_sections (
    id UUID PRIMARY KEY,
    school_id UUID REFERENCES schools(id),
    grade_level INTEGER,
    section VARCHAR(10), -- A, B, C, etc.
    name VARCHAR(100), -- "Grade 6B"
    teacher_id UUID REFERENCES users(id),
    academic_year VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 3. Grade Section Enrollments
```sql
CREATE TABLE grade_section_enrollments (
    id UUID PRIMARY KEY,
    grade_section_id UUID REFERENCES grade_sections(id),
    student_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active',
    enrolled_at TIMESTAMP
);
```

#### 4. Homework Announcements
```sql
CREATE TABLE homework_announcements (
    id UUID PRIMARY KEY,
    grade_section_id UUID REFERENCES grade_sections(id),
    teacher_id UUID REFERENCES users(id),
    title VARCHAR(255),
    content TEXT,
    homework_date DATE,
    subjects JSONB, -- Array of subjects with homework
    pdf_file_id UUID REFERENCES file_uploads(id),
    is_published BOOLEAN DEFAULT FALSE
);
```

#### 5. Assignments
```sql
CREATE TABLE assignments (
    id UUID PRIMARY KEY,
    class_id UUID REFERENCES classes(id),
    title VARCHAR(255),
    description TEXT,
    due_date TIMESTAMP,
    allow_late_submission BOOLEAN DEFAULT TRUE,
    attachments JSONB
);
```

#### 6. Assignment Submissions
```sql
CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id),
    student_id UUID REFERENCES users(id),
    content TEXT,
    attachments JSONB,
    submitted_at TIMESTAMP,
    status VARCHAR(20) -- 'submitted', 'graded'
);
```

---

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
**Purpose**: Student login
```javascript
// Request
{
  "email": "student@school.com",
  "password": "password123"
}

// Response
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "email": "student@school.com",
    "role": "student",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Homework Endpoints

#### GET /api/homework/grade-section/:gradeSectionId
**Purpose**: Get homework for a specific grade section
```javascript
// Headers
Authorization: Bearer <jwt_token>

// Query Parameters
?start_date=2025-01-01&end_date=2025-01-31

// Response
{
  "homework": [
    {
      "id": "uuid",
      "title": "Math Homework",
      "content": "Complete exercises 1-10",
      "homework_date": "2025-01-08",
      "subjects": [
        {
          "subject": "Math",
          "homework": "Complete exercises 1-10",
          "due_date": "2025-01-08"
        }
      ],
      "teacher": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith"
      },
      "pdf_file": {
        "id": "uuid",
        "filename": "math_homework.pdf",
        "cdn_url": "https://cdn.example.com/file.pdf"
      }
    }
  ]
}
```

### Assignment Endpoints

#### GET /api/assignments/class/:classId
**Purpose**: Get assignments for a specific class
```javascript
// Headers
Authorization: Bearer <jwt_token>

// Response
{
  "assignments": [
    {
      "id": "uuid",
      "title": "Essay Assignment",
      "description": "Write a 500-word essay",
      "due_date": "2025-01-15T23:59:59Z",
      "allow_late_submission": true,
      "attachments": [
        {
          "id": "uuid",
          "filename": "essay_guidelines.pdf",
          "url": "https://cdn.example.com/file.pdf"
        }
      ],
      "class": {
        "id": "uuid",
        "name": "English Literature",
        "subject": "English"
      }
    }
  ]
}
```

### Submission Endpoints

#### POST /api/submissions
**Purpose**: Submit or update assignment submission
```javascript
// Headers
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

// Form Data
assignmentId: "uuid"
text: "My essay content here"
files: [File1, File2, ...] // Optional file attachments

// Response
{
  "success": true,
  "submission": {
    "id": "uuid",
    "assignment_id": "uuid",
    "student_id": "uuid",
    "content": "My essay content here",
    "attachments": [
      {
        "id": "uuid",
        "filename": "essay.pdf",
        "url": "https://cdn.example.com/file.pdf",
        "size": 1024000
      }
    ],
    "submitted_at": "2025-01-10T10:30:00Z",
    "status": "submitted"
  }
}
```

#### GET /api/submissions/assignment/:assignmentId
**Purpose**: Get student's submission for a specific assignment
```javascript
// Headers
Authorization: Bearer <jwt_token>

// Response
{
  "submission": {
    "id": "uuid",
    "assignment_id": "uuid",
    "student_id": "uuid",
    "content": "My essay content here",
    "attachments": [...],
    "submitted_at": "2025-01-10T10:30:00Z",
    "status": "submitted"
  }
}
```

### Grade Section Endpoints

#### GET /api/grade-sections/student/:studentId
**Purpose**: Get grade sections where student is enrolled
```javascript
// Headers
Authorization: Bearer <jwt_token>

// Response
{
  "grade_sections": [
    {
      "id": "uuid",
      "name": "Grade 6B",
      "grade_level": 6,
      "section": "B",
      "teacher": {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith"
      },
      "academic_year": "2024-2025",
      "enrollment": {
        "status": "active",
        "enrolled_at": "2024-09-01T00:00:00Z"
      }
    }
  ]
}
```

---

## Data Flow

### 1. Student Login Flow
```
1. Student submits credentials → POST /api/auth/login
2. Server validates credentials against Supabase
3. Server generates JWT token with user data
4. Client stores token for subsequent requests
```

### 2. Homework Retrieval Flow
```
1. Student requests homework → GET /api/homework/grade-section/:id
2. Server validates JWT token
3. Server checks student enrollment in grade section
4. Server queries homework_announcements table
5. Server returns filtered homework data
```

### 3. Assignment Submission Flow
```
1. Student uploads files and submits → POST /api/submissions
2. Server validates JWT token and student role
3. Server checks assignment due date and late submission policy
4. Server uploads files to hybrid storage
5. Server creates/updates submission record
6. Server returns submission confirmation
```

### 4. File Upload Flow
```
1. Client sends file via multipart/form-data
2. Server receives file in memory (multer)
3. Server uploads to hybrid storage (Supabase/R2)
4. Server creates file_uploads record
5. Server returns file metadata and URL
```

---

## Error Handling

### Standard Error Response Format
```javascript
{
  "success": false,
  "message": "Error description",
  "error": "technical_error_code", // Optional
  "details": {} // Optional additional info
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created (for new resources)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (missing/invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **413**: Payload Too Large (file size exceeded)
- **500**: Internal Server Error

### Error Examples

#### Authentication Error
```javascript
{
  "success": false,
  "message": "Token has expired"
}
```

#### Validation Error
```javascript
{
  "success": false,
  "message": "Invalid input",
  "errors": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ]
}
```

#### Permission Error
```javascript
{
  "success": false,
  "message": "Not enrolled in this grade section"
}
```

---

## File Upload System

### Hybrid Storage Architecture
The system uses a hybrid storage approach:
- **Small files** (< 2MB): Supabase Storage
- **Medium files** (2MB - 50MB): Cloudflare R2
- **Large files** (50MB - 200MB): Cloudflare R2

### File Upload Process
```javascript
// 1. Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
    files: 10
  }
});

// 2. Upload to hybrid storage
const uploadResult = await hybridStorage.uploadFile(file, {
  userId: user.id,
  folder: `submissions/${assignmentId}/${user.id}`,
  relatedTable: 'assignment_submissions'
});
```

### Supported File Types
- Documents: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX
- Images: JPG, JPEG, PNG, GIF
- Videos: MP4, AVI, MOV
- Archives: ZIP, RAR

### File Metadata
```javascript
{
  "id": "uuid",
  "filename": "original_filename.pdf",
  "cdn_url": "https://cdn.example.com/file.pdf",
  "size": 1024000,
  "content_type": "application/pdf",
  "provider": "supabase" // or "r2"
}
```

---

## Security Features

### 1. JWT Token Security
- Tokens expire after 24 hours
- Tokens are validated on every request
- User status is checked (active/inactive)

### 2. Role-Based Access Control
- Students can only access their enrolled classes/sections
- Teachers can only access their assigned classes
- Admins have full system access

### 3. File Upload Security
- File type validation
- File size limits
- Virus scanning (if configured)
- Secure file storage with CDN

### 4. Rate Limiting
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per IP
});
```

### 5. CORS Configuration
```javascript
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://your-frontend-domain.com"
  ],
  credentials: true
}));
```

---

## Integration Guidelines

### Frontend Integration Steps

#### 1. Setup Authentication
```javascript
// Store token after login
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    return data.user;
  }
};
```

#### 2. API Request Helper
```javascript
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  
  const config = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  const response = await fetch(`/api${endpoint}`, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  
  return data;
};
```

#### 3. File Upload Helper
```javascript
const uploadFiles = async (files, assignmentId) => {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  
  formData.append('assignmentId', assignmentId);
  files.forEach(file => {
    formData.append('files', file);
  });
  
  const response = await fetch('/api/submissions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

### Error Handling in Frontend
```javascript
const handleApiError = (error) => {
  if (error.message === 'Token has expired') {
    // Redirect to login
    localStorage.removeItem('token');
    window.location.href = '/login';
  } else {
    // Show error message to user
    showNotification(error.message, 'error');
  }
};
```

### Real-time Updates (Optional)
For real-time features, consider using Supabase real-time subscriptions:
```javascript
// Subscribe to homework updates
const subscription = supabase
  .from('homework_announcements')
  .on('INSERT', payload => {
    // Handle new homework
    updateHomeworkList(payload.new);
  })
  .subscribe();
```

---

## Development Setup

### Environment Variables
Create a `.env` file with the following variables:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret

# File Storage
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name

# Email Configuration (Optional)
GMAIL_USER=your_gmail_user
GMAIL_PASS=your_gmail_password
FROM_EMAIL=your_from_email

# Client Configuration
CLIENT_URL=http://localhost:3000
```

### Installation Steps
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 3. Run database migrations
npx supabase db push

# 4. Start development server
npm run dev
```

### Testing Endpoints
Use tools like Postman or curl to test endpoints:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@school.com","password":"password123"}'

# Get homework (with token)
curl -X GET http://localhost:3000/api/homework/grade-section/uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Best Practices

### 1. Token Management
- Store tokens securely (localStorage for web apps)
- Implement token refresh logic
- Clear tokens on logout

### 2. Error Handling
- Always handle API errors gracefully
- Show user-friendly error messages
- Log errors for debugging

### 3. File Uploads
- Validate file types and sizes on frontend
- Show upload progress
- Handle upload failures gracefully

### 4. Performance
- Implement pagination for large datasets
- Use caching where appropriate
- Optimize file uploads with chunking

### 5. Security
- Never expose sensitive data in frontend
- Validate all user inputs
- Use HTTPS in production

---

## Troubleshooting

### Common Issues

#### 1. "Invalid URL" Error
**Cause**: Missing or incorrect Supabase URL
**Solution**: Check `SUPABASE_URL` environment variable

#### 2. "Token has expired" Error
**Cause**: JWT token expired
**Solution**: Implement token refresh or redirect to login

#### 3. "Not enrolled in this grade section" Error
**Cause**: Student not enrolled in requested grade section
**Solution**: Check enrollment status in database

#### 4. File Upload Failures
**Cause**: File too large or invalid type
**Solution**: Check file size limits and supported types

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=true
```

### Logs
Check server logs for detailed error information:
```bash
# View real-time logs
tail -f logs/app.log

# Search for specific errors
grep "ERROR" logs/app.log
```

---

This documentation provides a comprehensive guide for integrating with the Ibex Backend API for student functionality. For additional support or questions, refer to the main API documentation or contact the development team. 