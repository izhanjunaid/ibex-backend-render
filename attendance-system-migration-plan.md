# Attendance System Migration Plan: Class-Based → Grade-Section-Based

## Current System Analysis

### Current Structure (Class-Based)
- **Table**: `attendance`
- **Key Fields**: `class_id`, `student_id`, `date`, `status`
- **Unique Constraint**: `(class_id, student_id, date)`
- **Logic**: Attendance marked per subject/class per day
- **Current Data**: 0 records (empty table)

### Target Structure (Grade-Section-Based)
- **Table**: `attendance` (modified)
- **Key Fields**: `grade_section_id`, `student_id`, `date`, `status`
- **Unique Constraint**: `(grade_section_id, student_id, date)`
- **Logic**: Attendance marked per grade section per day (daily roll call)

## Migration Steps

### 1. Database Schema Changes

#### 1.1 Create New Migration File
```sql
-- Migration: 20250708000001_migrate_attendance_to_grade_sections.sql

-- Step 1: Add new column to attendance table
ALTER TABLE attendance ADD COLUMN grade_section_id UUID REFERENCES grade_sections(id) ON DELETE CASCADE;

-- Step 2: Create new unique constraint
ALTER TABLE attendance ADD CONSTRAINT attendance_grade_section_unique 
UNIQUE(grade_section_id, student_id, date);

-- Step 3: Drop old unique constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_student_date_unique;

-- Step 4: Drop old column (after data migration)
-- ALTER TABLE attendance DROP COLUMN class_id; -- Will be done after migration
```

#### 1.2 Update Indexes
```sql
-- Drop old indexes
DROP INDEX IF EXISTS idx_attendance_class_date;
DROP INDEX IF EXISTS idx_attendance_student_date;

-- Create new indexes
CREATE INDEX idx_attendance_grade_section_date ON attendance(grade_section_id, date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
```

### 2. Backend Code Changes

#### 2.1 Update Supabase Edge Function
- **File**: `supabase/functions/attendance/index.ts`
- **Changes**:
  - Replace `class_id` with `grade_section_id` in all queries
  - Update access control logic (teachers can mark attendance for their assigned grade sections)
  - Update statistics calculation
  - Update all API endpoints

#### 2.2 Update API Routes (if any)
- **File**: `routes/attendance.js` (if exists)
- **Changes**: Update all endpoints to use grade sections

#### 2.3 Update Type Definitions
- **File**: `types/supabase.ts`
- **Changes**: Update attendance table type definitions

### 3. Data Migration Strategy

Since the attendance table is currently empty (0 records), we can:
1. **Option A**: Direct schema change (recommended)
   - Simply modify the table structure
   - No data migration needed
   
2. **Option B**: Create new table approach
   - Create `attendance_new` table
   - Migrate any future data
   - Drop old table

### 4. API Endpoint Changes

#### Current Endpoints (to be updated):
- `GET /attendance?class_id=xxx&date=yyyy-mm-dd` → `GET /attendance?grade_section_id=xxx&date=yyyy-mm-dd`
- `GET /attendance?student_id=xxx` → `GET /attendance?student_id=xxx` (no change)
- `GET /attendance/stats?class_id=xxx` → `GET /attendance/stats?grade_section_id=xxx`
- `POST /attendance` → Update request body to use `grade_section_id`
- `PUT /attendance/:id` → No change needed

#### New Endpoints (to be added):
- `GET /attendance/grade-sections` - List all grade sections with attendance data
- `GET /attendance/grade-sections/:id/students` - Get students in a grade section for attendance marking

### 5. Access Control Changes

#### Current Logic:
- Teachers can mark attendance for classes they teach
- Admins can mark attendance for any class

#### New Logic:
- Teachers can mark attendance for grade sections they are assigned to
- Admins can mark attendance for any grade section
- Students can view their own attendance history

### 6. Frontend Impact

#### Changes Required:
1. **Attendance Marking Interface**:
   - Change from class selection to grade section selection
   - Update student list to show grade section students
   
2. **Attendance Reports**:
   - Update filters from class-based to grade-section-based
   - Update statistics display
   
3. **Student Dashboard**:
   - Update attendance history display
   - Update attendance statistics

### 7. Testing Strategy

#### 7.1 Database Testing
- [ ] Verify new schema constraints
- [ ] Test unique constraint enforcement
- [ ] Test foreign key relationships
- [ ] Test index performance

#### 7.2 API Testing
- [ ] Test all attendance endpoints with new structure
- [ ] Test access control for teachers/admins
- [ ] Test data validation
- [ ] Test error handling

#### 7.3 Integration Testing
- [ ] Test attendance marking workflow
- [ ] Test attendance reporting
- [ ] Test student access to their attendance

### 8. Rollback Plan

#### If Issues Arise:
1. **Database Rollback**:
   ```sql
   -- Revert schema changes
   ALTER TABLE attendance DROP COLUMN grade_section_id;
   ALTER TABLE attendance ADD COLUMN class_id UUID REFERENCES classes(id);
   -- Restore old constraints and indexes
   ```

2. **Code Rollback**:
   - Revert all code changes
   - Deploy previous version

### 9. Implementation Order

1. **Phase 1**: Database Schema Changes
   - Create and run migration
   - Update indexes
   - Test schema integrity

2. **Phase 2**: Backend Code Updates
   - Update Supabase Edge Function
   - Update type definitions
   - Test API endpoints

3. **Phase 3**: Frontend Updates
   - Update attendance interfaces
   - Update reports and dashboards
   - Test user workflows

4. **Phase 4**: Final Cleanup
   - Remove old `class_id` column
   - Update documentation
   - Deploy to production

### 10. Benefits of Grade-Section-Based Attendance

1. **Simplified Workflow**: Daily roll call per grade section instead of per subject
2. **Better for Primary/Secondary Schools**: More aligned with traditional attendance systems
3. **Reduced Complexity**: Fewer attendance records per day
4. **Better Reporting**: Easier to track daily attendance by grade section
5. **Teacher Efficiency**: Teachers mark attendance once per day for their grade section

### 11. Potential Challenges

1. **Subject-Specific Attendance**: If subject-specific attendance is needed, may need additional system
2. **Teacher Assignments**: Need to ensure teachers are properly assigned to grade sections
3. **Data Consistency**: Ensure all students are enrolled in grade sections before marking attendance

## Next Steps

1. **Review and Approve Plan**
2. **Create Database Migration**
3. **Update Backend Code**
4. **Test Implementation**
5. **Deploy Changes**
