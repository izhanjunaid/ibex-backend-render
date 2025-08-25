# 📊 **Database Structure Guide**

## 🏗️ **Overview**

Your database has **TWO SYSTEMS** running in parallel:

1. **🔄 OLD SYSTEM**: Individual classes and assignments (unchanged)
2. **🆕 NEW SYSTEM**: Grade sections and collective homework (additive)

---

## 📋 **Core Tables**

### **1. Users Table** (`users`)
**Purpose**: All users in the system (students, teachers, admins, parents)

```sql
-- Key fields:
id UUID (Primary Key)
email VARCHAR(255) UNIQUE
role ENUM ('admin', 'teacher', 'student', 'parent')
first_name VARCHAR(100)
last_name VARCHAR(100)
status ENUM ('active', 'inactive', 'suspended')
```

**Example Data**:
```
id: 272fce50-d4c1-44ef-bb10-57ea44da2dc5
email: student@example.com
role: student
first_name: John
last_name: Doe
status: active
```

---

### **2. Schools Table** (`schools`)
**Purpose**: Multi-tenant support (if you have multiple schools)

```sql
-- Key fields:
id UUID (Primary Key)
name VARCHAR(255)
code VARCHAR(50) UNIQUE
```

---

## 🔄 **OLD SYSTEM (Individual Classes)**

### **3. Classes Table** (`classes`)
**Purpose**: Individual subject classes (Math, English, Science, etc.)

```sql
-- Key fields:
id UUID (Primary Key)
school_id UUID (References schools)
name VARCHAR(255) -- "Advanced Mathematics"
subject VARCHAR(100) -- "Mathematics"
grade_level INTEGER -- 6, 7, 8, etc.
teacher_id UUID (References users)
```

**Example Data**:
```
id: abc123...
name: "Advanced Mathematics"
subject: "Mathematics"
grade_level: 6
teacher_id: teacher-uuid...
```

### **4. Class Enrollments** (`class_enrollments`)
**Purpose**: Which students are in which individual classes

```sql
-- Key fields:
class_id UUID (References classes)
student_id UUID (References users)
status VARCHAR(20) -- 'active'
```

### **5. Assignments Table** (`assignments`)
**Purpose**: Individual assignments for specific classes

```sql
-- Key fields:
class_id UUID (References classes)
teacher_id UUID (References users)
title VARCHAR(255)
due_date TIMESTAMP
status ENUM ('draft', 'published', 'closed')
```

---

## 🆕 **NEW SYSTEM (Grade Sections)**

### **6. Grade Sections Table** (`grade_sections`)
**Purpose**: Whole grade sections (Grade 6A, Grade 6B, etc.)

```sql
-- Key fields:
id UUID (Primary Key)
school_id UUID (References schools)
grade_level INTEGER -- 6, 7, 8, etc.
section VARCHAR(10) -- 'A', 'B', 'C', etc.
name VARCHAR(100) -- "Grade 6A"
teacher_id UUID (References users) -- Main teacher for this section
academic_year VARCHAR(20) -- "2025-2026"
```

**Example Data**:
```
id: 7d454a73-9af2-4a4e-89f3-9d385f69cefb
grade_level: 6
section: "charlie"
name: "grae 6 charlie"
teacher_id: teacher-uuid...
academic_year: "2025-2026"
```

### **7. Grade Section Enrollments** (`grade_section_enrollments`)
**Purpose**: Which students are in which grade sections

```sql
-- Key fields:
grade_section_id UUID (References grade_sections)
student_id UUID (References users)
status VARCHAR(20) -- 'active'
```

**Example Data**:
```
grade_section_id: 7d454a73-9af2-4a4e-89f3-9d385f69cefb
student_id: 272fce50-d4c1-44ef-bb10-57ea44da2dc5
status: active
```

### **8. Homework Announcements** (`homework_announcements`)
**Purpose**: Collective daily homework for entire grade sections

```sql
-- Key fields:
id UUID (Primary Key)
grade_section_id UUID (References grade_sections)
teacher_id UUID (References users)
title VARCHAR(255) -- Can be NULL
content TEXT
homework_date DATE
subjects JSONB -- Array of subjects with homework
pdf_file_id UUID (References file_uploads)
is_published BOOLEAN
```

**Example Data**:
```
id: homework-uuid...
grade_section_id: 7d454a73-9af2-4a4e-89f3-9d385f69cefb
title: "Daily Homework - July 26, 2025"
homework_date: 2025-07-26
subjects: [{"subject": "Math", "homework": "Complete exercises 1-10"}]
is_published: true
```

---

## 🔗 **How Everything Connects**

### **Student Journey Example**:

1. **Student Created**: `users` table
   ```
   id: 272fce50-d4c1-44ef-bb10-57ea44da2dc5
   email: student@example.com
   role: student
   ```

2. **Enrolled in Grade Section**: `grade_section_enrollments` table
   ```
   student_id: 272fce50-d4c1-44ef-bb10-57ea44da2dc5
   grade_section_id: 7d454a73-9af2-4a4e-89f3-9d385f69cefb
   ```

3. **Can See Homework**: `homework_announcements` table
   ```
   grade_section_id: 7d454a73-9af2-4a4e-89f3-9d385f69cefb
   is_published: true
   ```

---

## 🎯 **Manual Import Process**

### **Step 1: Create Students**
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" for each student
3. Fill: Email, Password, Auto-confirm ✅

### **Step 2: Create Student Profiles**
1. Go to Table Editor → `users` table
2. Click "Insert Row" for each student
3. Fill:
   - `id`: Copy UUID from Auth user
   - `email`: Student email
   - `first_name`: Student first name
   - `last_name`: Student last name
   - `role`: `student`
   - `status`: `active`

### **Step 3: Create Grade Sections**
1. Go to Table Editor → `grade_sections` table
2. Click "Insert Row" for each grade section
3. Fill:
   - `grade_level`: 6, 7, 8, etc.
   - `section`: A, B, C, etc.
   - `name`: "Grade 6A", "Grade 6B", etc.
   - `academic_year`: "2025-2026"
   - `teacher_id`: UUID of assigned teacher (optional)

### **Step 4: Enroll Students**
1. Go to Table Editor → `grade_section_enrollments` table
2. Click "Insert Row" for each student
3. Fill:
   - `grade_section_id`: Copy UUID from grade section
   - `student_id`: Copy UUID from student user
   - `status`: `active`

---

## 🔍 **How to Check Data**

### **Check Student Enrollments**:
```sql
SELECT 
    u.first_name, u.last_name, u.email,
    gs.name as grade_section
FROM users u
JOIN grade_section_enrollments gse ON u.id = gse.student_id
JOIN grade_sections gs ON gse.grade_section_id = gs.id
WHERE u.role = 'student';
```

### **Check Homework for Student**:
```sql
SELECT 
    ha.title, ha.homework_date, ha.subjects
FROM homework_announcements ha
JOIN grade_sections gs ON ha.grade_section_id = gs.id
JOIN grade_section_enrollments gse ON gs.id = gse.grade_section_id
WHERE gse.student_id = '272fce50-d4c1-44ef-bb10-57ea44da2dc5'
AND ha.is_published = true;
```

---

## ⚠️ **Important Notes**

1. **Two Systems**: Old (classes) and New (grade sections) work independently
2. **No Conflicts**: Students can be in both systems simultaneously
3. **Homework**: Only exists in the NEW grade section system
4. **UUIDs**: Always copy UUIDs exactly - they're case-sensitive
5. **Status**: Make sure students have `status = 'active'`

---

## 🚀 **Quick Start**

1. **Create 1 teacher** in `users` table
2. **Create 1 grade section** in `grade_sections` table
3. **Create 1 student** in `users` table
4. **Enroll student** in `grade_section_enrollments` table
5. **Create homework** in `homework_announcements` table
6. **Test student login** and homework fetching

This gives you a working system to build upon! 🎯 