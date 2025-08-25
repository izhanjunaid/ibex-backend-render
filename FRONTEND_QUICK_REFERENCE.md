# Grade Section Homework System - Frontend Quick Reference

## 🚀 Quick Start

### 1. Authentication
```javascript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

### 2. Key Endpoints
- **Grade Sections**: `/api/grade-sections`
- **Homework**: `/api/homework`
- **Student Homework**: `/api/homework/student`

### 3. File Upload (PDF Required)
```javascript
const formData = new FormData();
formData.append('grade_section_id', 'uuid');
formData.append('title', 'Homework Title');
formData.append('content', 'Brief description');
formData.append('homework_date', '2025-01-07');
formData.append('pdf_file', fileInput.files[0]); // PDF file containing all homework

fetch('/api/homework', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

## 📋 Essential Data Structures

### Grade Section
```javascript
{
  id: "uuid",
  name: "Grade 6B",
  grade_level: 6,
  section: "B",
  teacher_id: "uuid",
  enrolled_students_count: 25
}
```

### Homework
```javascript
{
  id: "uuid",
  title: "Daily Homework",
  content: "Complete assignments from PDF",
  homework_date: "2025-01-07",
  pdf_file: {
    filename: "homework.pdf",
    cdn_url: "https://cdn.example.com/homework.pdf"
  }
}
```

## 🎯 Common Use Cases

### Teacher Creates Homework
1. Select grade section
2. Fill basic info (title, description, date)
3. **Upload one PDF file** containing all homework for all subjects
4. Publish

### Student Views Homework
1. Fetch homework for date range
2. See homework title and description
3. **Download PDF** containing all homework

### Admin Manages Grade Sections
1. Create grade sections
2. Assign teachers
3. Enroll students
4. Monitor homework

## ⚠️ Important Notes

- **PDF file is REQUIRED** for homework creation
- **One PDF contains all homework** for all subjects
- Use `FormData` for file uploads, don't set `Content-Type`
- Dates: Use ISO format (YYYY-MM-DD) for API
- Authentication: All endpoints require JWT token
- PDF Files: Stored in hybrid storage system

## 🔗 Full Documentation
See `GRADE_SECTION_HOMEWORK_API_DOCUMENTATION.md` for complete details. 