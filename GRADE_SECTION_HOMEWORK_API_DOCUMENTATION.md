# Grade Section Homework System - Frontend API Documentation

## 📋 Overview

The Grade Section Homework System allows teachers to create collective daily homework announcements for entire grade sections (e.g., Grade 6B) by uploading **one PDF file** that contains all the homework for all subjects. This system works alongside the existing class-based assignment system.

## 🏗️ System Architecture

### Database Tables
- `grade_sections` - Grade sections with assigned teachers
- `homework_announcements` - Homework announcements with PDF files
- `grade_section_enrollments` - Student enrollment in grade sections

### Key Features
- ✅ Teachers assigned to grade sections (e.g., Grade 6B)
- ✅ **One PDF file** containing all homework for all subjects
- ✅ PDF file uploads using hybrid storage system
- ✅ Student access to homework for their grade section
- ✅ Additive design (doesn't affect existing functionality)

### 🎯 **Simplified Workflow**
1. **Teacher** creates a grade section (e.g., Grade 6B)
2. **Teacher** enrolls students in the grade section
3. **Teacher** uploads **one PDF file** containing all homework for all subjects
4. **Students** download the PDF to see their homework

---

## 🔐 Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```javascript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

---

## 📚 API Endpoints

### 1. Grade Sections Management

#### 1.1 Create Grade Section
**POST** `/api/grade-sections`

**Request Body:**
```json
{
  "school_id": "uuid",
  "grade_level": 6,
  "section": "B",
  "name": "Grade 6B",
  "description": "Grade 6 Section B",
  "teacher_id": "uuid",
  "academic_year": "2024-2025"
}
```

**Response:**
```json
{
  "success": true,
  "gradeSection": {
    "id": "uuid",
    "school_id": "uuid",
    "grade_level": 6,
    "section": "B",
    "name": "Grade 6B",
    "description": "Grade 6 Section B",
    "teacher_id": "uuid",
    "academic_year": "2024-2025",
    "is_active": true,
    "created_at": "2025-01-07T10:00:00Z",
    "updated_at": "2025-01-07T10:00:00Z"
  }
}
```

**Frontend Implementation:**
```javascript
const createGradeSection = async (gradeSectionData) => {
  try {
    const response = await fetch('/api/grade-sections', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gradeSectionData)
    });
    
    const data = await response.json();
    if (data.success) {
      return data.gradeSection;
    }
  } catch (error) {
    console.error('Error creating grade section:', error);
  }
};
```

#### 1.2 Get All Grade Sections
**GET** `/api/grade-sections`

**Query Parameters:**
- `school_id` (optional) - Filter by school
- `teacher_id` (optional) - Filter by teacher
- `academic_year` (optional) - Filter by academic year

**Response:**
```json
{
  "success": true,
  "gradeSections": [
    {
      "id": "uuid",
      "school_id": "uuid",
      "grade_level": 6,
      "section": "B",
      "name": "Grade 6B",
      "description": "Grade 6 Section B",
      "teacher_id": "uuid",
      "academic_year": "2024-2025",
      "is_active": true,
      "teacher": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@school.com"
      },
      "enrolled_students_count": 25
    }
  ]
}
```

#### 1.3 Get Grade Section by ID
**GET** `/api/grade-sections/:id`

**Response:**
```json
{
  "success": true,
  "gradeSection": {
    "id": "uuid",
    "school_id": "uuid",
    "grade_level": 6,
    "section": "B",
    "name": "Grade 6B",
    "description": "Grade 6 Section B",
    "teacher_id": "uuid",
    "academic_year": "2024-2025",
    "is_active": true,
    "teacher": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@school.com"
    },
    "enrolled_students_count": 25
  }
}
```

#### 1.4 Update Grade Section
**PUT** `/api/grade-sections/:id`

**Request Body:**
```json
{
  "name": "Updated Grade 6B",
  "description": "Updated description",
  "teacher_id": "uuid",
  "is_active": true
}
```

#### 1.5 Delete Grade Section
**DELETE** `/api/grade-sections/:id`

---

### 2. Student Enrollment

#### 2.1 Enroll Students
**POST** `/api/grade-sections/:gradeSectionId/enroll`

**Request Body:**
```json
{
  "studentIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Students enrolled successfully",
  "enrolledCount": 3
}
```

#### 2.2 Get Enrolled Students
**GET** `/api/grade-sections/:gradeSectionId/students`

**Response:**
```json
{
  "success": true,
  "students": [
    {
      "student_id": "uuid",
      "first_name": "Alice",
      "last_name": "Smith",
      "email": "alice.smith@school.com"
    }
  ]
}
```

#### 2.3 Remove Student
**DELETE** `/api/grade-sections/:gradeSectionId/enroll/:studentId`

---

### 3. Homework Management

#### 3.1 Create Homework Announcement (Simplified)
**POST** `/api/homework`

**Request Body (PDF file required):**
```javascript
// Use FormData for file upload
const formData = new FormData();
formData.append('grade_section_id', 'uuid');
formData.append('title', 'Daily Homework - January 7, 2025');
formData.append('content', 'Complete the following assignments from the PDF');
formData.append('homework_date', '2025-01-07');
formData.append('is_published', 'true');
formData.append('pdf_file', fileInput.files[0]); // PDF file containing all homework
```

**Request Body (with optional subjects list):**
```javascript
const formData = new FormData();
formData.append('grade_section_id', 'uuid');
formData.append('title', 'Daily Homework - January 7, 2025');
formData.append('content', 'Complete the following assignments from the PDF');
formData.append('homework_date', '2025-01-07');
formData.append('subjects', JSON.stringify([
  {
    "subject": "Mathematics",
    "homework": "Complete exercises 1-10 in Chapter 5",
    "due_date": "2025-01-08"
  },
  {
    "subject": "Science",
    "homework": "Read pages 45-50 and answer questions 1-5",
    "due_date": "2025-01-08"
  }
]));
formData.append('is_published', 'true');
formData.append('pdf_file', fileInput.files[0]); // PDF file containing all homework
```

**Response:**
```json
{
  "success": true,
  "homework": {
    "id": "uuid",
    "grade_section_id": "uuid",
    "teacher_id": "uuid",
    "title": "Daily Homework - January 7, 2025",
    "content": "Complete the following assignments from the PDF",
    "homework_date": "2025-01-07",
    "subjects": [...],
    "pdf_file_id": "uuid",
    "is_published": true,
    "created_at": "2025-01-07T10:00:00Z",
    "teacher": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe"
    },
    "pdf_file": {
      "id": "uuid",
      "filename": "homework_jan7.pdf",
      "cdn_url": "https://cdn.example.com/homework_jan7.pdf"
    }
  }
}
```

**Frontend Implementation:**
```javascript
const createHomework = async (homeworkData, pdfFile) => {
  try {
    const formData = new FormData();
    
    // Add text fields
    formData.append('grade_section_id', homeworkData.grade_section_id);
    formData.append('title', homeworkData.title);
    formData.append('content', homeworkData.content);
    formData.append('homework_date', homeworkData.homework_date);
    formData.append('is_published', homeworkData.is_published);
    
    // Add optional subjects if provided
    if (homeworkData.subjects && homeworkData.subjects.length > 0) {
      formData.append('subjects', JSON.stringify(homeworkData.subjects));
    }
    
    // PDF file is required
    formData.append('pdf_file', pdfFile);
    
    const response = await fetch('/api/homework', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type for FormData
      },
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      return data.homework;
    }
  } catch (error) {
    console.error('Error creating homework:', error);
  }
};
```

#### 3.2 Get Homework for Grade Section
**GET** `/api/homework/grade-section/:gradeSectionId`

**Query Parameters:**
- `start_date` (optional) - Filter from date (YYYY-MM-DD)
- `end_date` (optional) - Filter to date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "homework": [
    {
      "id": "uuid",
      "title": "Daily Homework - January 7, 2025",
      "content": "Complete the following assignments from the PDF",
      "homework_date": "2025-01-07",
      "subjects": [...],
      "is_published": true,
      "created_at": "2025-01-07T10:00:00Z",
      "teacher": {
        "id": "uuid",
        "first_name": "John",
        "last_name": "Doe"
      },
      "pdf_file": {
        "id": "uuid",
        "filename": "homework_jan7.pdf",
        "cdn_url": "https://cdn.example.com/homework_jan7.pdf"
      }
    }
  ]
}
```

#### 3.3 Get Homework for Student
**GET** `/api/homework/student`

**Query Parameters:**
- `start_date` (optional) - Filter from date (YYYY-MM-DD)
- `end_date` (optional) - Filter to date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "homework_id": "uuid",
    "title": "Daily Homework - January 7, 2025",
    "content": "Complete the following assignments from the PDF",
    "homework_date": "2025-01-07",
    "subjects": [
      {
        "subject": "Mathematics",
        "homework": "Complete exercises 1-10 in Chapter 5",
        "due_date": "2025-01-08"
      }
    ],
    "pdf_url": "https://cdn.example.com/homework_jan7.pdf",
    "teacher_name": "John Doe"
  }
]
```

#### 3.4 Get Specific Homework
**GET** `/api/homework/:id`

**Response:**
```json
{
  "success": true,
  "homework": {
    "id": "uuid",
    "grade_section_id": "uuid",
    "teacher_id": "uuid",
    "title": "Daily Homework - January 7, 2025",
    "content": "Complete the following assignments from the PDF",
    "homework_date": "2025-01-07",
    "subjects": [...],
    "pdf_file_id": "uuid",
    "is_published": true,
    "created_at": "2025-01-07T10:00:00Z",
    "teacher": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe"
    },
    "pdf_file": {
      "id": "uuid",
      "filename": "homework_jan7.pdf",
      "cdn_url": "https://cdn.example.com/homework_jan7.pdf"
    },
    "grade_section": {
      "id": "uuid",
      "name": "Grade 6B",
      "teacher_id": "uuid"
    }
  }
}
```

#### 3.5 Update Homework
**PUT** `/api/homework/:id`

**Request Body:**
```json
{
  "title": "Updated Daily Homework",
  "content": "Updated content",
  "subjects": [...],
  "is_published": true
}
```

#### 3.6 Delete Homework
**DELETE** `/api/homework/:id`

---

## 🎨 Frontend UI Implementation Guide

### 1. Teacher Dashboard Components

#### 1.1 Grade Section Management
```javascript
// GradeSectionManager.jsx
import React, { useState, useEffect } from 'react';

const GradeSectionManager = () => {
  const [gradeSections, setGradeSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGradeSections();
  }, []);

  const fetchGradeSections = async () => {
    try {
      const response = await fetch('/api/grade-sections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setGradeSections(data.gradeSections);
      }
    } catch (error) {
      console.error('Error fetching grade sections:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grade-section-manager">
      <h2>My Grade Sections</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grade-sections-grid">
          {gradeSections.map(section => (
            <div key={section.id} className="grade-section-card">
              <h3>{section.name}</h3>
              <p>{section.description}</p>
              <p>Students: {section.enrolled_students_count}</p>
              <button onClick={() => navigateToHomework(section.id)}>
                Upload Homework PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 1.2 Simplified Homework Creation Form
```javascript
// HomeworkCreationForm.jsx
import React, { useState } from 'react';

const HomeworkCreationForm = ({ gradeSectionId }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    homework_date: new Date().toISOString().split('T')[0],
    is_published: false
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!pdfFile) {
      alert('Please select a PDF file containing the homework');
      return;
    }
    
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('grade_section_id', gradeSectionId);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      formDataToSend.append('homework_date', formData.homework_date);
      formDataToSend.append('is_published', formData.is_published);
      formDataToSend.append('pdf_file', pdfFile);

      const response = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataToSend
      });

      const data = await response.json();
      if (data.success) {
        alert('Homework PDF uploaded successfully!');
        // Reset form or navigate away
      }
    } catch (error) {
      console.error('Error uploading homework:', error);
      alert('Failed to upload homework PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="homework-form">
      <h2>Upload Homework PDF</h2>
      
      <div className="form-group">
        <label>Title:</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="e.g., Daily Homework - January 7, 2025"
          required
        />
      </div>

      <div className="form-group">
        <label>Description:</label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Brief description of the homework"
          required
        />
      </div>

      <div className="form-group">
        <label>Homework Date:</label>
        <input
          type="date"
          value={formData.homework_date}
          onChange={(e) => setFormData(prev => ({ ...prev, homework_date: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Homework PDF File (Required):</label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setPdfFile(e.target.files[0])}
          required
        />
        <small>Upload a PDF file containing all homework for all subjects</small>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={formData.is_published}
            onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
          />
          Publish immediately
        </label>
      </div>

      <button type="submit" disabled={loading || !pdfFile}>
        {loading ? 'Uploading...' : 'Upload Homework PDF'}
      </button>
    </form>
  );
};
```

### 2. Student Dashboard Components

#### 2.1 Student Homework View (Simplified)
```javascript
// StudentHomeworkView.jsx
import React, { useState, useEffect } from 'react';

const StudentHomeworkView = () => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchHomework();
  }, [dateRange]);

  const fetchHomework = async () => {
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date
      });

      const response = await fetch(`/api/homework/student?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setHomework(data);
    } catch (error) {
      console.error('Error fetching homework:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = (pdfUrl, filename) => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    link.click();
  };

  return (
    <div className="student-homework-view">
      <h2>My Homework</h2>
      
      <div className="date-filter">
        <label>From:</label>
        <input
          type="date"
          value={dateRange.start_date}
          onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
        />
        <label>To:</label>
        <input
          type="date"
          value={dateRange.end_date}
          onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
        />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="homework-list">
          {homework.map(hw => (
            <div key={hw.homework_id} className="homework-card">
              <h3>{hw.title}</h3>
              <p className="date">{new Date(hw.homework_date).toLocaleDateString()}</p>
              <p className="teacher">By: {hw.teacher_name}</p>
              <p className="content">{hw.content}</p>
              
              {hw.pdf_url && (
                <button 
                  onClick={() => downloadPDF(hw.pdf_url, `homework_${hw.homework_date}.pdf`)}
                  className="download-btn"
                >
                  📄 Download Homework PDF
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### 3. Admin Dashboard Components

#### 3.1 Grade Section Overview
```javascript
// AdminGradeSectionOverview.jsx
import React, { useState, useEffect } from 'react';

const AdminGradeSectionOverview = () => {
  const [gradeSections, setGradeSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGradeSections();
  }, []);

  const fetchGradeSections = async () => {
    try {
      const response = await fetch('/api/grade-sections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setGradeSections(data.gradeSections);
      }
    } catch (error) {
      console.error('Error fetching grade sections:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-grade-section-overview">
      <h2>Grade Section Overview</h2>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grade-sections-table">
          <table>
            <thead>
              <tr>
                <th>Grade Section</th>
                <th>Teacher</th>
                <th>Students</th>
                <th>Academic Year</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gradeSections.map(section => (
                <tr key={section.id}>
                  <td>{section.name}</td>
                  <td>{section.teacher?.first_name} {section.teacher?.last_name}</td>
                  <td>{section.enrolled_students_count}</td>
                  <td>{section.academic_year}</td>
                  <td>
                    <button onClick={() => viewStudents(section.id)}>View Students</button>
                    <button onClick={() => editSection(section.id)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

---

## 🎯 Key UI/UX Considerations

### 1. Navigation Structure
```
Dashboard
├── Teachers
│   ├── My Grade Sections
│   ├── Upload Homework PDF
│   └── Manage Students
├── Students
│   ├── My Homework
│   └── Download PDFs
└── Admins
    ├── Grade Section Overview
    ├── Create Grade Sections
    └── Assign Teachers
```

### 2. File Upload Handling
- **PDF file is required** for homework creation
- Show upload progress
- Validate file type (PDF only)
- Handle upload errors gracefully
- Clear messaging about PDF requirement

### 3. Date Handling
- Use ISO date format (YYYY-MM-DD) for API
- Display dates in user-friendly format
- Implement date range filters

### 4. Error Handling
- Show user-friendly error messages
- Handle network errors
- Validate form inputs
- Clear feedback for PDF upload requirements

### 5. Loading States
- Show loading spinners during API calls
- Disable buttons during operations
- Provide feedback for successful operations

---

## 🔧 Integration with Existing System

### 1. Authentication
- Use existing JWT token system
- Maintain current user roles (teacher, student, admin)
- Leverage existing middleware

### 2. File Storage
- PDF files use existing hybrid storage system
- Files are organized in `homework/{grade_section_id}/` folders
- CDN URLs are automatically generated

### 3. Database
- New tables are additive (don't affect existing tables)
- Existing functionality remains unchanged
- Can coexist with class-based assignments

---

## 🚀 Deployment Checklist

### Frontend
- [ ] Implement all UI components
- [ ] Add proper error handling
- [ ] Test PDF file uploads
- [ ] Validate form inputs
- [ ] Add loading states
- [ ] Test responsive design
- [ ] Ensure PDF requirement is clear to users

### Backend
- [ ] ✅ Database migration applied
- [ ] ✅ API endpoints implemented
- [ ] ✅ Authentication working
- [ ] ✅ PDF file uploads working
- [ ] ✅ Error handling implemented

### Testing
- [ ] Test teacher workflows
- [ ] Test student access
- [ ] Test admin functions
- [ ] Test PDF uploads/downloads
- [ ] Test error scenarios

---

## 📞 Support

For questions or issues with the API implementation:
1. Check the server logs for detailed error messages
2. Verify authentication tokens are valid
3. Ensure database migration has been applied
4. Test endpoints with Postman/Insomnia first

The Grade Section Homework System is designed to be robust, scalable, and user-friendly. Happy coding! 🎉 