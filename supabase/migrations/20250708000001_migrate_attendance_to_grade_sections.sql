-- Migration: 20250708000001_migrate_attendance_to_grade_sections.sql
-- Change attendance system from class-based to grade-section-based

-- Step 1: Add new column to attendance table
ALTER TABLE attendance ADD COLUMN grade_section_id UUID REFERENCES grade_sections(id) ON DELETE CASCADE;

-- Step 2: Create new unique constraint for grade-section-based attendance
ALTER TABLE attendance ADD CONSTRAINT attendance_grade_section_unique 
UNIQUE(grade_section_id, student_id, date);

-- Step 3: Drop old unique constraint (if it exists)
-- Note: The original constraint name might be different, so we'll check and drop it safely
DO $$
BEGIN
    -- Drop the old unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_class_id_student_id_date_key'
    ) THEN
        ALTER TABLE attendance DROP CONSTRAINT attendance_class_id_student_id_date_key;
    END IF;
    
    -- Also try the alternative constraint name
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_class_student_date_unique'
    ) THEN
        ALTER TABLE attendance DROP CONSTRAINT attendance_class_student_date_unique;
    END IF;
END $$;

-- Step 4: Drop old indexes
DROP INDEX IF EXISTS idx_attendance_class_date;
DROP INDEX IF EXISTS idx_attendance_student_date;

-- Step 5: Create new indexes for grade-section-based attendance
CREATE INDEX idx_attendance_grade_section_date ON attendance(grade_section_id, date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);

-- Step 6: Add comment to document the change
COMMENT ON TABLE attendance IS 'Attendance records now based on grade sections instead of classes. Each record represents daily attendance for a student in their grade section.';

-- Step 7: Create a function to get students in a grade section for attendance marking
CREATE OR REPLACE FUNCTION get_grade_section_attendance_students(grade_section_uuid UUID, attendance_date DATE)
RETURNS TABLE (
    student_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    attendance_status attendance_status,
    attendance_id UUID,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as student_id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(a.status, NULL) as attendance_status,
        a.id as attendance_id,
        a.notes
    FROM users u
    JOIN grade_section_enrollments gse ON u.id = gse.student_id
    LEFT JOIN attendance a ON u.id = a.student_id 
        AND a.grade_section_id = grade_section_uuid 
        AND a.date = attendance_date
    WHERE gse.grade_section_id = grade_section_uuid
    AND gse.status = 'active'
    AND u.role = 'student'
    AND u.status = 'active'
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create a function to get attendance statistics for a grade section
CREATE OR REPLACE FUNCTION get_grade_section_attendance_stats(grade_section_uuid UUID, start_date DATE, end_date DATE)
RETURNS TABLE (
    total_days INTEGER,
    present_days INTEGER,
    absent_days INTEGER,
    late_days INTEGER,
    excused_days INTEGER,
    attendance_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_summary AS (
        SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN status = 'excused' THEN 1 END) as excused_count
        FROM attendance
        WHERE grade_section_id = grade_section_uuid
        AND date BETWEEN start_date AND end_date
    )
    SELECT 
        total_records::INTEGER as total_days,
        present_count::INTEGER as present_days,
        absent_count::INTEGER as absent_days,
        late_count::INTEGER as late_days,
        excused_count::INTEGER as excused_days,
        CASE 
            WHEN total_records > 0 THEN 
                ROUND((present_count::DECIMAL / total_records::DECIMAL) * 100, 2)
            ELSE 0 
        END as attendance_rate
    FROM attendance_summary;
END;
$$ LANGUAGE plpgsql;
