# 📚 **Bulk Import Students Using CSV**

## 🚀 **Quick Start**

### **Step 1: Create Your CSV File**

Create a file called `students.csv` with this format:

```csv
email,first_name,last_name,grade_level,section,academic_year,school_id
john.doe@school.com,John,Doe,6,A,2025-2026,
jane.smith@school.com,Jane,Smith,6,A,2025-2026,
mike.johnson@school.com,Mike,Johnson,6,B,2025-2026,
sarah.wilson@school.com,Sarah,Wilson,6,B,2025-2026,
alex.brown@school.com,Alex,Brown,7,A,2025-2026,
```

**Column Details:**
- `email`: Student's email address (required)
- `first_name`: Student's first name (required)
- `last_name`: Student's last name (required)
- `grade_level`: Grade number (6, 7, 8, etc.)
- `section`: Section letter (A, B, C, etc.)
- `academic_year`: Academic year (2025-2026, etc.)
- `school_id`: School ID (can be empty)

### **Step 2: Run the Import Script**

```bash
# First, create a sample CSV and see what would be imported
node bulk-import-simple.js

# Then run the actual import
node -e "
const { bulkImportStudents } = require('./bulk-import-simple.js');
bulkImportStudents('students.csv', { defaultPassword: 'password123' });
"
```

---

## 📋 **CSV File Examples**

### **Example 1: Simple Import**
```csv
email,first_name,last_name,grade_level,section,academic_year,school_id
student1@school.com,Alice,Johnson,6,A,2025-2026,
student2@school.com,Bob,Smith,6,A,2025-2026,
student3@school.com,Charlie,Brown,6,B,2025-2026,
```

### **Example 2: Multiple Grade Sections**
```csv
email,first_name,last_name,grade_level,section,academic_year,school_id
john@school.com,John,Doe,6,A,2025-2026,
jane@school.com,Jane,Smith,6,A,2025-2026,
mike@school.com,Mike,Johnson,6,B,2025-2026,
sarah@school.com,Sarah,Wilson,6,B,2025-2026,
alex@school.com,Alex,Brown,7,A,2025-2026,
emma@school.com,Emma,Davis,7,A,2025-2026,
```

---

## ⚙️ **Script Options**

```javascript
bulkImportStudents('students.csv', {
  defaultPassword: 'password123',    // Default password for all students
  createGradeSections: true,         // Auto-create grade sections
  dryRun: false                      // Set to true to see what would be imported
});
```

---

## 🔍 **What the Script Does**

1. **Reads CSV file** and parses student data
2. **Creates grade sections** automatically (if they don't exist)
3. **Creates students** in Supabase Auth
4. **Creates student profiles** in the users table
5. **Enrolls students** in their grade sections
6. **Shows summary** of what was created

---

## 📊 **Expected Output**

```
📚 [BULK IMPORT] Starting student bulk import...

1️⃣ Reading CSV file...
✅ CSV parsed: 5 students

2️⃣ Creating grade sections...
✅ Created grade section: Grade 6A
✅ Created grade section: Grade 6B
✅ Created grade section: Grade 7A

3️⃣ Importing students...
📝 Processing student 1/5: John Doe
✅ Created student: john.doe@school.com
✅ Enrolled in grade section: Grade 6A

📝 Processing student 2/5: Jane Smith
✅ Created student: jane.smith@school.com
✅ Enrolled in grade section: Grade 6A

...

📊 [IMPORT SUMMARY]
Total students in CSV: 5
Students created: 5
Students skipped: 0
Errors: 0
Grade sections processed: 3

🎉 Bulk import completed!

💡 Students can now login with:
   Email: their email from CSV
   Password: password123
```

---

## 🎯 **After Import**

Students can now:
1. **Login** with their email and password
2. **See homework** for their grade section
3. **Access the system** normally

---

## ⚠️ **Important Notes**

1. **No duplicate emails**: Script skips existing students
2. **Auto-grade sections**: Creates grade sections automatically
3. **Same password**: All students get the same default password
4. **Backup your data**: Always backup before bulk operations
5. **Test first**: Use `dryRun: true` to see what would be imported

---

## 🛠️ **Troubleshooting**

### **Error: "Student already exists"**
- This is normal - the script skips existing students
- Check if the email is already in your system

### **Error: "Invalid CSV format"**
- Make sure your CSV has the correct headers
- Check for extra commas or quotes

### **Error: "Grade section creation failed"**
- Check if grade section already exists
- Verify grade_level and section values

---

## 🚀 **Ready to Import?**

1. Create your `students.csv` file
2. Run the script
3. Students can login immediately!

The script handles everything automatically! 🎉 