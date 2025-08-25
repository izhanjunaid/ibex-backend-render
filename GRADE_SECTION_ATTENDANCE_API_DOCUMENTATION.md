# Grade Section Attendance API Documentation

## Overview

The attendance system has been migrated from class-based to grade-section-based attendance. This change provides a more streamlined approach for primary and secondary schools where daily attendance is marked per grade section rather than per subject/class.

## Key Changes

### Before (Class-Based)
- Attendance marked per subject/class per day
- Students could have multiple attendance records per day
- Complex for daily roll call

### After (Grade-Section-Based)
- Attendance marked per grade section per day
- One attendance record per student per day
- Simplified daily roll call process

## Database Schema

### Attendance Table Structure
```sql
CREATE TABLE attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    grade_section_id UUID REFERENCES grade_sections(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status NOT NULL, -- 'present', 'absent', 'late', 'excused'
    notes TEXT,
    marked_by UUID REFERENCES users(id),
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(grade_section_id, student_id, date)
);
```

### Helper Functions

#### `get_grade_section_attendance_students(grade_section_uuid, attendance_date)`
Returns all students in a grade section with their attendance status for a specific date.

#### `get_grade_section_attendance_stats(grade_section_uuid, start_date, end_date)`
Returns attendance statistics for a grade section within a date range.

## API Endpoints

### Base URL
```
https://your-project.supabase.co/functions/v1/attendance
```

### Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 1. Get Grade Sections for Attendance

**GET** `/attendance/grade-sections`

Returns all grade sections that the user can mark attendance for.

### Access Control
- **Admins**: Can see all grade sections
- **Teachers**: Can only see grade sections they are assigned to
- **Students/Parents**: Access denied

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Grade 6A",
      "grade_level": 6,
      "section": "A",
      "teacher_id": "uuid"
    }
  ]
}
```

---

## 2. Get Students for Attendance Marking

**GET** `/attendance?grade_section_id=uuid&date=yyyy-mm-dd`

Returns all students in a grade section with their attendance status for a specific date.

### Parameters
- `grade_section_id` (required): UUID of the grade section
- `date` (required): Date in YYYY-MM-DD format

### Access Control
- **Admins**: Can access any grade section
- **Teachers**: Can only access grade sections they are assigned to
- **Students/Parents**: Access denied

### Response
```json
{
  "data": [
    {
      "student_id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@school.com",
      "attendance_status": "present",
      "attendance_id": "uuid",
      "notes": "On time"
    },
    {
      "student_id": "uuid",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@school.com",
      "attendance_status": null,
      "attendance_id": null,
      "notes": null
    }
  ]
}
```

---

## 3. Mark Attendance

**POST** `/attendance`

Marks attendance for multiple students in a grade section.

### Request Body
```json
{
  "grade_section_id": "uuid",
  "date": "2025-01-08",
  "attendance_records": [
    {
      "student_id": "uuid",
      "status": "present",
      "notes": "On time"
    },
    {
      "student_id": "uuid",
      "status": "late",
      "notes": "Arrived 10 minutes late"
    },
    {
      "student_id": "uuid",
      "status": "absent",
      "notes": "Called in sick"
    }
  ]
}
```

### Access Control
- **Admins**: Can mark attendance for any grade section
- **Teachers**: Can only mark attendance for grade sections they are assigned to
- **Students/Parents**: Access denied

### Response
```json
{
  "message": "Attendance marked successfully",
  "data": [
    {
      "id": "uuid",
      "grade_section_id": "uuid",
      "student_id": "uuid",
      "date": "2025-01-08",
      "status": "present",
      "notes": "On time",
      "marked_by": "uuid",
      "marked_at": "2025-01-08T09:00:00Z"
    }
  ]
}
```

---

## 4. Update Attendance Record

**PUT** `/attendance`

Updates an existing attendance record.

### Request Body
```json
{
  "attendance_id": "uuid",
  "status": "excused",
  "notes": "Medical appointment"
}
```

### Access Control
- **Admins**: Can update any attendance record
- **Teachers**: Can only update records they marked or for their grade sections
- **Students/Parents**: Access denied

### Response
```json
{
  "message": "Attendance updated successfully",
  "data": {
    "id": "uuid",
    "grade_section_id": "uuid",
    "student_id": "uuid",
    "date": "2025-01-08",
    "status": "excused",
    "notes": "Medical appointment",
    "marked_by": "uuid",
    "marked_at": "2025-01-08T09:00:00Z"
  }
}
```

---

## 5. Get Attendance Statistics

**GET** `/attendance/stats?grade_section_id=uuid&start_date=yyyy-mm-dd&end_date=yyyy-mm-dd`

Returns attendance statistics for a grade section within a date range.

### Parameters
- `grade_section_id` (required): UUID of the grade section
- `start_date` (optional): Start date in YYYY-MM-DD format (defaults to today)
- `end_date` (optional): End date in YYYY-MM-DD format (defaults to today)

### Access Control
- **Admins**: Can access statistics for any grade section
- **Teachers**: Can only access statistics for grade sections they are assigned to
- **Students/Parents**: Access denied

### Response
```json
{
  "data": {
    "total_days": 5,
    "present_days": 4,
    "absent_days": 1,
    "late_days": 0,
    "excused_days": 0,
    "attendance_rate": 80.00
  }
}
```

---

## 6. Get Student Attendance History

**GET** `/attendance?student_id=uuid`

Returns attendance history for a specific student.

### Parameters
- `student_id` (required): UUID of the student

### Access Control
- **Admins**: Can access any student's attendance history
- **Teachers**: Can access attendance history for students in their grade sections
- **Students**: Can only access their own attendance history
- **Parents**: Can access their children's attendance history

### Response
```json
{
  "data": [
    {
      "id": "uuid",
      "grade_section_id": "uuid",
      "student_id": "uuid",
      "date": "2025-01-08",
      "status": "present",
      "notes": "On time",
      "marked_by": "uuid",
      "marked_at": "2025-01-08T09:00:00Z",
      "grade_sections": {
        "name": "Grade 6A",
        "grade_level": 6,
        "section": "A"
      }
    }
  ]
}
```

---

## Usage Examples

### Frontend Implementation

#### 1. Mark Daily Attendance
```javascript
// Get students for attendance marking
const response = await fetch(
  `${supabaseUrl}/functions/v1/attendance?grade_section_id=${gradeSectionId}&date=${today}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data: students } = await response.json();

// Mark attendance
const attendanceData = {
  grade_section_id: gradeSectionId,
  date: today,
  attendance_records: students.map(student => ({
    student_id: student.student_id,
    status: student.status || 'present',
    notes: student.notes || ''
  }))
};

await fetch(`${supabaseUrl}/functions/v1/attendance`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(attendanceData)
});
```

#### 2. Get Attendance Statistics
```javascript
const response = await fetch(
  `${supabaseUrl}/functions/v1/attendance/stats?grade_section_id=${gradeSectionId}&start_date=${startDate}&end_date=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data: stats } = await response.json();
console.log(`Attendance Rate: ${stats.attendance_rate}%`);
```

#### 3. Student Dashboard
```javascript
// Get student's own attendance history
const response = await fetch(
  `${supabaseUrl}/functions/v1/attendance?student_id=${studentId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { data: history } = await response.json();
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "error": "No authorization header"
}
```

#### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

#### 400 Bad Request
```json
{
  "error": "Missing required fields"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Migration Notes

### From Class-Based to Grade-Section-Based

1. **Database Changes**:
   - Added `grade_section_id` column to attendance table
   - Updated unique constraint to `(grade_section_id, student_id, date)`
   - Created new indexes for performance
   - Added helper functions for attendance operations

2. **API Changes**:
   - All endpoints now use `grade_section_id` instead of `class_id`
   - New endpoint for listing grade sections
   - Updated access control logic

3. **Frontend Changes Required**:
   - Update attendance marking interface to select grade sections
   - Update attendance reports to filter by grade sections
   - Update student dashboard to show grade section attendance

### Benefits of the New System

1. **Simplified Workflow**: Daily roll call per grade section
2. **Better for Schools**: Aligned with traditional attendance systems
3. **Reduced Complexity**: Fewer attendance records per day
4. **Better Reporting**: Easier to track daily attendance
5. **Teacher Efficiency**: Mark attendance once per day

---

## Testing

Use the provided test script to verify the system:
```bash
node test-grade-section-attendance.js
```

This script will:
1. Test grade section retrieval
2. Test student listing
3. Test attendance marking
4. Test statistics calculation
5. Test attendance history
6. Clean up test data
