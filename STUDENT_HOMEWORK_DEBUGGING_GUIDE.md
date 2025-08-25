# 🔍 Student Homework Debugging Guide

## Overview
This guide helps you debug student homework requests from the frontend. The backend now includes comprehensive logging to track every step of the process.

## 📊 **Debugging Logs Added**

### **1. Authentication Logs**
```
🔐 [AUTH] Student homework request detected
   📍 Path: /api/homework/grade-section/123e4567-e89b-12d3-a456-426614174000
   🔑 Token present: true
   🌐 Origin: http://localhost:3000
   📱 User agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...

✅ [AUTH] Token verified successfully
   👤 Decoded user: { id: 'student-id', email: 'student@example.com', role: 'student' }
```

### **2. Grade Section Homework Request Logs**
```
🔍 [HOMEWORK] GET /grade-section/:gradeSectionId - Fetching grade section homework
   🆔 Grade section ID: 123e4567-e89b-12d3-a456-426614174000
   👤 User: { id: 'student-id', role: 'student', email: 'student@example.com' }
   📅 Query params: {}
   🌐 Request origin: http://localhost:3000
   📱 User agent: Mozilla/5.0...
   🔑 Token present: true

   👨‍🎓 Checking student enrollment...
   ✅ [HOMEWORK] Student enrollment verified
   📊 Enrollment details: { id: 'enrollment-id', grade_section_id: '...', student_id: '...', status: 'active' }

   🔍 Executing database query...
   ✅ [HOMEWORK] Successfully fetched 2 homework items
   📊 Response data: [{...}, {...}]
   📈 Response size: 1234 characters
   🕒 Response time: 2025-07-26T15:30:45.123Z
```

### **3. Student-Specific Homework Request Logs**
```
🔍 [HOMEWORK] GET /student - Fetching student homework
   👤 User: { id: 'student-id', role: 'student', email: 'student@example.com' }
   📅 Query params: { start_date: '2025-07-01', end_date: '2025-07-31' }
   🌐 Request origin: http://localhost:3000
   📱 User agent: Mozilla/5.0...
   🔑 Token present: true

   👨‍🎓 Fetching homework for student: student-id
   📅 Date range: { start_date: '2025-07-01', end_date: '2025-07-31' }
   🔍 Calling get_student_homework function with params: { student_uuid: 'student-id', start_date: '2025-07-01', end_date: '2025-07-31' }
   ✅ [HOMEWORK] Successfully fetched 5 homework items for student
   📊 Response data: [{...}, {...}, {...}, {...}, {...}]
   📈 Response size: 5678 characters
   🕒 Response time: 2025-07-26T15:30:45.123Z
   🎯 Function execution successful
```

## 🚨 **Common Error Logs**

### **1. Authentication Errors**
```
❌ [AUTH] No token provided for homework request
```

### **2. Enrollment Errors**
```
❌ [HOMEWORK] Student not enrolled in grade section
   🔍 Enrollment check details:
     - Student ID: student-id
     - Grade Section ID: grade-section-id
     - Enrollment error: { details: 'No rows returned' }
     - Enrollment data: null
```

### **3. Database Errors**
```
❌ [HOMEWORK] Error fetching homework: { details: 'Database connection failed' }
   🔍 Database error details: { details: 'Database connection failed' }
```

### **4. Function Errors**
```
❌ [HOMEWORK] Error fetching student homework: { details: 'Function not found' }
   🔍 Function error details: { details: 'Function not found' }
```

## 🔧 **How to Use These Logs**

### **Step 1: Monitor Server Logs**
Watch your server console for these log patterns when students make requests.

### **Step 2: Check Authentication**
Look for `🔐 [AUTH]` logs to verify:
- ✅ Token is present
- ✅ Token is valid
- ✅ User role is correct

### **Step 3: Check Enrollment**
Look for `👨‍🎓 Checking student enrollment...` logs to verify:
- ✅ Student is enrolled in the grade section
- ✅ Enrollment status is 'active'

### **Step 4: Check Database Queries**
Look for `🔍 Executing database query...` logs to verify:
- ✅ Query executes successfully
- ✅ Returns expected data

### **Step 5: Check Response**
Look for `✅ [HOMEWORK] Successfully fetched` logs to verify:
- ✅ Correct number of homework items
- ✅ Response data structure
- ✅ Response size and timing

## 🎯 **Frontend Testing Scenarios**

### **Scenario 1: Student Views Grade Section Homework**
```javascript
// Frontend request
const response = await fetch(`/api/homework/grade-section/${gradeSectionId}`, {
  headers: { 'Authorization': `Bearer ${studentToken}` }
});

// Expected logs:
// 🔐 [AUTH] Student homework request detected
// ✅ [AUTH] Token verified successfully
// 🔍 [HOMEWORK] GET /grade-section/:gradeSectionId
// 👨‍🎓 Checking student enrollment...
// ✅ [HOMEWORK] Student enrollment verified
// ✅ [HOMEWORK] Successfully fetched X homework items
```

### **Scenario 2: Student Views All Their Homework**
```javascript
// Frontend request
const response = await fetch('/api/homework/student', {
  headers: { 'Authorization': `Bearer ${studentToken}` }
});

// Expected logs:
// 🔐 [AUTH] Student homework request detected
// ✅ [AUTH] Token verified successfully
// 🔍 [HOMEWORK] GET /student
// 🔍 Calling get_student_homework function
// ✅ [HOMEWORK] Successfully fetched X homework items for student
```

### **Scenario 3: Student with Date Filters**
```javascript
// Frontend request
const response = await fetch('/api/homework/student?start_date=2025-07-01&end_date=2025-07-31', {
  headers: { 'Authorization': `Bearer ${studentToken}` }
});

// Expected logs:
// 📅 Date range: { start_date: '2025-07-01', end_date: '2025-07-31' }
// 🔍 Calling get_student_homework function with params: {...}
```

## 🐛 **Troubleshooting Common Issues**

### **Issue 1: "No token provided"**
**Cause:** Frontend not sending Authorization header
**Solution:** Check frontend code for proper token inclusion

### **Issue 2: "Student not enrolled"**
**Cause:** Student not enrolled in the grade section
**Solution:** Enroll student in grade section first

### **Issue 3: "Function not found"**
**Cause:** Database function missing
**Solution:** Run the migration to create the function

### **Issue 4: "Database connection failed"**
**Cause:** Supabase connection issues
**Solution:** Check environment variables and network

## 📱 **Frontend Code Examples**

### **React Hook for Homework**
```jsx
const useStudentHomework = (gradeSectionId) => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchHomework = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/homework/grade-section/${gradeSectionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setHomework(data.homework);
      } catch (err) {
        setError(err.message);
        console.error('Homework fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (gradeSectionId && token) {
      fetchHomework();
    }
  }, [gradeSectionId, token]);

  return { homework, loading, error };
};
```

## 🎉 **Success Indicators**

When everything works correctly, you should see:
1. ✅ Authentication logs with valid token
2. ✅ Enrollment verification successful
3. ✅ Database query executed
4. ✅ Homework data returned
5. ✅ Response size and timing logged

The debugging logs will help you identify exactly where any issues occur in the student homework flow! 🔍✨ 