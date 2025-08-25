# Student App Quick Reference Guide

## 🚀 Quick Start for Student App Development

### Essential Endpoints for Student App

#### 1. Authentication
```javascript
// Login
POST /api/auth/login
Body: { email, password }
Response: { token, user }
```

#### 2. Get Student's Grade Sections
```javascript
// Get enrolled grade sections
GET /api/grade-sections/student/:studentId
Headers: Authorization: Bearer <token>
```

#### 3. Get Homework
```javascript
// Get homework for a grade section
GET /api/homework/grade-section/:gradeSectionId
Headers: Authorization: Bearer <token>
Query: ?start_date=2025-01-01&end_date=2025-01-31
```

#### 4. Get Class Assignments
```javascript
// Get assignments for a class
GET /api/assignments/class/:classId
Headers: Authorization: Bearer <token>
```

#### 5. Submit Assignment
```javascript
// Submit assignment with files
POST /api/submissions
Headers: Authorization: Bearer <token>
Body: FormData (assignmentId, text, files[])
```

### 🔑 Key Data Structures

#### Student User Object
```javascript
{
  id: "uuid",
  email: "student@school.com",
  first_name: "John",
  last_name: "Doe",
  role: "student",
  school_id: "uuid"
}
```

#### Homework Object
```javascript
{
  id: "uuid",
  title: "Math Homework",
  content: "Complete exercises 1-10",
  homework_date: "2025-01-08",
  subjects: [
    {
      subject: "Math",
      homework: "Complete exercises 1-10",
      due_date: "2025-01-08"
    }
  ],
  teacher: {
    id: "uuid",
    first_name: "Jane",
    last_name: "Smith"
  },
  pdf_file: {
    id: "uuid",
    filename: "math_homework.pdf",
    cdn_url: "https://cdn.example.com/file.pdf"
  }
}
```

#### Assignment Object
```javascript
{
  id: "uuid",
  title: "Essay Assignment",
  description: "Write a 500-word essay",
  due_date: "2025-01-15T23:59:59Z",
  allow_late_submission: true,
  attachments: [
    {
      id: "uuid",
      filename: "essay_guidelines.pdf",
      url: "https://cdn.example.com/file.pdf"
    }
  ],
  class: {
    id: "uuid",
    name: "English Literature",
    subject: "English"
  }
}
```

### 📱 Frontend Integration Code

#### 1. API Client Setup
```javascript
class StudentAPI {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // Authentication
  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      this.setToken(data.token);
      return data.user;
    }
    throw new Error(data.message);
  }

  // Get grade sections
  async getGradeSections(studentId) {
    return this.request(`/grade-sections/student/${studentId}`);
  }

  // Get homework
  async getHomework(gradeSectionId, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return this.request(`/homework/grade-section/${gradeSectionId}?${params}`);
  }

  // Get assignments
  async getAssignments(classId) {
    return this.request(`/assignments/class/${classId}`);
  }

  // Submit assignment
  async submitAssignment(assignmentId, text, files = []) {
    const formData = new FormData();
    formData.append('assignmentId', assignmentId);
    if (text) formData.append('text', text);
    
    files.forEach(file => {
      formData.append('files', file);
    });

    return this.request('/submissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
  }
}
```

#### 2. React Hook for API
```javascript
import { useState, useEffect } from 'react';

export const useStudentAPI = () => {
  const [api] = useState(() => new StudentAPI());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await api.login(email, password);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return {
    api,
    user,
    loading,
    error,
    login,
    logout
  };
};
```

#### 3. React Component Examples

##### Login Component
```javascript
import React, { useState } from 'react';
import { useStudentAPI } from './hooks/useStudentAPI';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useStudentAPI();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};
```

##### Homework List Component
```javascript
import React, { useState, useEffect } from 'react';

const HomeworkList = ({ gradeSectionId }) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = new StudentAPI();

  useEffect(() => {
    const fetchHomework = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];
        
        const data = await api.getHomework(gradeSectionId, today, endDate);
        setHomework(data.homework || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHomework();
  }, [gradeSectionId]);

  if (loading) return <div>Loading homework...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="homework-list">
      {homework.map(hw => (
        <div key={hw.id} className="homework-item">
          <h3>{hw.title}</h3>
          <p>{hw.content}</p>
          <p>Date: {hw.homework_date}</p>
          <p>Teacher: {hw.teacher.first_name} {hw.teacher.last_name}</p>
          {hw.subjects.map((subject, index) => (
            <div key={index}>
              <strong>{subject.subject}:</strong> {subject.homework}
            </div>
          ))}
          {hw.pdf_file && (
            <a href={hw.pdf_file.cdn_url} target="_blank" rel="noopener">
              Download PDF
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
```

##### Assignment Submission Component
```javascript
import React, { useState } from 'react';

const AssignmentSubmission = ({ assignmentId }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const api = new StudentAPI();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.submitAssignment(assignmentId, text, files);
      alert('Assignment submitted successfully!');
      setText('');
      setFiles([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your assignment content..."
        rows={10}
      />
      
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      />
      
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Assignment'}
      </button>
      
      {error && <p className="error">{error}</p>}
    </form>
  );
};
```

### 🔧 Environment Setup

#### Required Environment Variables
```env
# Backend URL (change for production)
REACT_APP_API_URL=http://localhost:3000/api

# Optional: Enable debug mode
REACT_APP_DEBUG=true
```

#### Package.json Dependencies
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.0.0",
    "axios": "^1.0.0"
  }
}
```

### 🎯 App Structure Recommendations

```
src/
├── components/
│   ├── Login.js
│   ├── Dashboard.js
│   ├── HomeworkList.js
│   ├── AssignmentList.js
│   └── AssignmentSubmission.js
├── hooks/
│   └── useStudentAPI.js
├── services/
│   └── api.js
├── utils/
│   └── dateHelpers.js
└── App.js
```

### 🚨 Common Issues & Solutions

#### 1. CORS Errors
**Problem**: Frontend can't connect to backend
**Solution**: Ensure backend CORS is configured for your frontend domain

#### 2. Token Expiration
**Problem**: API calls fail with "Token expired"
**Solution**: Implement automatic logout and redirect to login

#### 3. File Upload Failures
**Problem**: Files not uploading
**Solution**: Check file size limits and supported file types

#### 4. Network Errors
**Problem**: Can't connect to API
**Solution**: Verify backend is running and URL is correct

### 📊 Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] View grade sections
- [ ] View homework for grade section
- [ ] View assignments for class
- [ ] Submit assignment with text only
- [ ] Submit assignment with files
- [ ] Handle token expiration
- [ ] Handle network errors
- [ ] Handle file upload errors

### 🎨 UI/UX Tips

1. **Loading States**: Always show loading indicators for API calls
2. **Error Handling**: Display user-friendly error messages
3. **File Upload**: Show progress and file validation
4. **Responsive Design**: Ensure app works on mobile devices
5. **Offline Support**: Consider caching for better user experience

### 🔒 Security Considerations

1. **Token Storage**: Store tokens securely (localStorage for web apps)
2. **Input Validation**: Validate all user inputs
3. **File Validation**: Check file types and sizes
4. **HTTPS**: Use HTTPS in production
5. **Error Messages**: Don't expose sensitive information in errors

This quick reference provides everything needed to build a student app that integrates with the Ibex backend. For detailed API documentation, refer to `STUDENT_BACKEND_API_DOCUMENTATION.md`. 