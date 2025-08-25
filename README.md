# Ibex Backend API

Educational Management System Backend API built with Express.js and Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase project

### Installation
```bash
npm install
```

### Environment Variables
Create a `.env` file with:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
CLIENT_URL=https://your-frontend.vercel.app
```

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Classes
- `GET /api/classes` - Get all classes
- `POST /api/classes` - Create new class
- `PUT /api/classes/:id` - Update class
- `DELETE /api/classes/:id` - Delete class

### Assignments
- `GET /api/assignments` - Get all assignments
- `POST /api/assignments` - Create new assignment
- `PUT /api/assignments/:id` - Update assignment
- `DELETE /api/assignments/:id` - Delete assignment

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id` - Get file
- `DELETE /api/files/:id` - Delete file

### Grade Sections (NEW - Additive Feature)
- `GET /api/grade-sections` - Get all grade sections (role-based)
- `POST /api/grade-sections` - Create new grade section (admin only)
- `GET /api/grade-sections/:id` - Get specific grade section
- `PUT /api/grade-sections/:id` - Update grade section (admin only)
- `GET /api/grade-sections/:id/students` - Get enrolled students
- `POST /api/grade-sections/:id/enroll` - Enroll students
- `DELETE /api/grade-sections/:id/enroll/:studentId` - Remove student

### Homework Announcements (NEW - Additive Feature)
- `GET /api/homework/grade-section/:gradeSectionId` - Get homework for grade section
- `GET /api/homework/student` - Get homework for current student
- `POST /api/homework` - Create homework announcement (teacher/admin)
- `GET /api/homework/:id` - Get specific homework
- `PUT /api/homework/:id` - Update homework (teacher/admin)
- `DELETE /api/homework/:id` - Delete homework (teacher/admin)

## 🔧 Deployment

This backend is configured for deployment on Render.

### Render Deployment
1. Connect this repository to Render
2. Set environment variables in Render dashboard
3. Deploy as Web Service

## 🆕 Grade Section Homework System

### Overview
The Grade Section Homework System is an **additive feature** that allows teachers to create collective daily homework announcements for entire grade sections (e.g., Grade 6B). This system works alongside the existing class-based assignment system.

### How It Works
1. **Admin** creates grade sections and assigns teachers
2. **Teacher** creates daily homework PDFs containing all subjects' homework
3. **Students** see one consolidated homework announcement per day from their grade section teacher

### Key Features
- **Collective Homework**: One PDF per day with all subjects
- **Role-based Access**: Teachers manage their assigned grade sections
- **PDF Upload**: Support for PDF homework files
- **Student View**: Students see homework from their grade section teacher
- **Non-disruptive**: Works alongside existing class assignments

### Database Tables
- `grade_sections` - Grade section definitions
- `grade_section_enrollments` - Student enrollments
- `homework_announcements` - Daily homework announcements

### Example Usage
```javascript
// Create a grade section
POST /api/grade-sections
{
  "grade_level": 6,
  "section": "B",
  "name": "Grade 6B",
  "teacher_id": "uuid",
  "academic_year": "2024-2025"
}

// Create homework announcement
POST /api/homework
{
  "grade_section_id": "uuid",
  "title": "Daily Homework - January 7, 2025",
  "homework_date": "2025-01-07",
  "subjects": [
    {"subject": "Math", "homework": "Complete exercises 1-15", "due_date": "2025-01-08"},
    {"subject": "Science", "homework": "Read Chapter 3", "due_date": "2025-01-10"}
  ]
}
```

## 📝 License

MIT License 