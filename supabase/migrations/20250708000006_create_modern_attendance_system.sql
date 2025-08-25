-- Migration: 20250708000006_create_modern_attendance_system.sql
-- Create a modern, efficient attendance system

-- Step 1: Drop old attendance system (if exists)
DROP FUNCTION IF EXISTS get_grade_section_attendance_students(UUID, DATE);
DROP FUNCTION IF EXISTS get_grade_section_attendance_stats(UUID, DATE, DATE);
DROP TABLE IF EXISTS attendance CASCADE;

-- Step 2: Create new attendance table with optimized structure
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_section_id UUID NOT NULL REFERENCES grade_sections(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'unmarked')),
    notes TEXT,
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create optimized indexes for fast queries
CREATE INDEX idx_attendance_grade_section_date ON attendance(grade_section_id, date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_date_status ON attendance(date, status);
CREATE UNIQUE INDEX idx_attendance_unique_student_date ON attendance(student_id, grade_section_id, date);

-- Step 4: Add attendance configuration to school_settings
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS attendance_config JSONB DEFAULT '{
    "daily_reset_time": "00:00",
    "default_status": "unmarked",
    "enable_auto_reset": false,
    "auto_reset_time": "00:00",
    "late_threshold_minutes": 15,
    "absent_threshold_minutes": 30
}'::jsonb;

-- Step 5: Create efficient functions for attendance operations

-- Function to get students with attendance status for a grade section on a specific date
CREATE OR REPLACE FUNCTION get_grade_section_attendance(
    p_grade_section_id UUID,
    p_date DATE
)
RETURNS TABLE (
    student_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    attendance_id UUID,
    status VARCHAR(20),
    notes TEXT,
    marked_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as student_id,
        u.first_name,
        u.last_name,
        u.email,
        a.id as attendance_id,
        COALESCE(a.status, 'unmarked') as status,
        a.notes,
        a.marked_at
    FROM users u
    INNER JOIN grade_section_enrollments gse ON u.id = gse.student_id
    LEFT JOIN attendance a ON u.id = a.student_id 
        AND a.grade_section_id = p_grade_section_id 
        AND a.date = p_date
    WHERE gse.grade_section_id = p_grade_section_id
        AND gse.status = 'active'
        AND u.role = 'student'
        AND u.status = 'active'
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk mark attendance
CREATE OR REPLACE FUNCTION bulk_mark_attendance(
    p_grade_section_id UUID,
    p_date DATE,
    p_attendance_records JSONB,
    p_marked_by UUID
)
RETURNS JSONB AS $$
DECLARE
    record JSONB;
    result JSONB := '{"success": true, "marked": 0, "errors": []}'::jsonb;
    error_msg TEXT;
BEGIN
    -- Validate inputs
    IF p_grade_section_id IS NULL OR p_date IS NULL OR p_attendance_records IS NULL THEN
        RETURN '{"success": false, "error": "Missing required parameters"}'::jsonb;
    END IF;

    -- Process each attendance record
    FOR record IN SELECT * FROM jsonb_array_elements(p_attendance_records)
    LOOP
        BEGIN
            -- Upsert attendance record
            INSERT INTO attendance (grade_section_id, student_id, date, status, notes, marked_by)
            VALUES (
                p_grade_section_id,
                (record->>'student_id')::UUID,
                p_date,
                record->>'status',
                record->>'notes',
                p_marked_by
            )
            ON CONFLICT (student_id, grade_section_id, date)
            DO UPDATE SET
                status = EXCLUDED.status,
                notes = EXCLUDED.notes,
                marked_by = EXCLUDED.marked_by,
                marked_at = NOW(),
                updated_at = NOW();
            
            result := jsonb_set(result, '{marked}', to_jsonb((result->>'marked')::int + 1));
        EXCEPTION WHEN OTHERS THEN
            error_msg := SQLERRM;
            result := jsonb_set(result, '{errors}', result->'errors' || jsonb_build_object(
                'student_id', record->>'student_id',
                'error', error_msg
            ));
        END;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get attendance statistics for a grade section
CREATE OR REPLACE FUNCTION get_attendance_stats(
    p_grade_section_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    date DATE,
    total_students BIGINT,
    present_count BIGINT,
    absent_count BIGINT,
    late_count BIGINT,
    excused_count BIGINT,
    unmarked_count BIGINT,
    attendance_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_stats AS (
        SELECT 
            d.date,
            COUNT(DISTINCT gse.student_id) as total_students,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
            COUNT(CASE WHEN a.status = 'unmarked' OR a.status IS NULL THEN 1 END) as unmarked_count
        FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') d
        CROSS JOIN grade_section_enrollments gse
        LEFT JOIN attendance a ON gse.student_id = a.student_id 
            AND a.grade_section_id = p_grade_section_id 
            AND a.date = d.date
        WHERE gse.grade_section_id = p_grade_section_id
            AND gse.status = 'active'
        GROUP BY d.date
    )
    SELECT 
        ds.date,
        ds.total_students,
        ds.present_count,
        ds.absent_count,
        ds.late_count,
        ds.excused_count,
        ds.unmarked_count,
        CASE 
            WHEN ds.total_students > 0 THEN 
                ROUND(((ds.present_count + ds.late_count + ds.excused_count)::DECIMAL / ds.total_students) * 100, 2)
            ELSE 0 
        END as attendance_rate
    FROM daily_stats ds
    ORDER BY ds.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset daily attendance (mark all as unmarked)
CREATE OR REPLACE FUNCTION reset_daily_attendance(
    p_grade_section_id UUID,
    p_date DATE,
    p_reset_by UUID
)
RETURNS JSONB AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Update all attendance records for the grade section and date to 'unmarked'
    UPDATE attendance 
    SET 
        status = 'unmarked',
        notes = NULL,
        marked_by = p_reset_by,
        marked_at = NOW(),
        updated_at = NOW()
    WHERE grade_section_id = p_grade_section_id 
        AND date = p_date;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Daily attendance reset successfully',
        'affected_rows', affected_rows,
        'date', p_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get student attendance history
CREATE OR REPLACE FUNCTION get_student_attendance_history(
    p_student_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    date DATE,
    grade_section_name VARCHAR(100),
    status VARCHAR(20),
    notes TEXT,
    marked_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.date,
        gs.name as grade_section_name,
        a.status,
        a.notes,
        a.marked_at
    FROM attendance a
    INNER JOIN grade_sections gs ON a.grade_section_id = gs.id
    WHERE a.student_id = p_student_id
        AND a.date BETWEEN p_start_date AND p_end_date
    ORDER BY a.date DESC, a.marked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create RLS policies for security
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attendance for their grade sections
CREATE POLICY "Users can view attendance for their grade sections" ON attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM grade_sections gs
            WHERE gs.id = attendance.grade_section_id
            AND (
                gs.teacher_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() AND u.role = 'admin'
                )
            )
        )
    );

-- Policy: Teachers and admins can insert/update attendance
CREATE POLICY "Teachers and admins can modify attendance" ON attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM grade_sections gs
            WHERE gs.id = attendance.grade_section_id
            AND (
                gs.teacher_id = auth.uid() OR 
                EXISTS (
                    SELECT 1 FROM users u 
                    WHERE u.id = auth.uid() AND u.role = 'admin'
                )
            )
        )
    );

-- Step 7: Add comments for documentation
COMMENT ON TABLE attendance IS 'Modern attendance system with optimized performance and clean design';
COMMENT ON COLUMN attendance.status IS 'Attendance status: present, absent, late, excused, unmarked';
COMMENT ON COLUMN attendance.notes IS 'Optional notes for attendance record';
COMMENT ON FUNCTION get_grade_section_attendance IS 'Get students with attendance status for a grade section on a specific date';
COMMENT ON FUNCTION bulk_mark_attendance IS 'Bulk mark attendance for multiple students efficiently';
COMMENT ON FUNCTION get_attendance_stats IS 'Get attendance statistics for a grade section over a date range';
COMMENT ON FUNCTION reset_daily_attendance IS 'Reset daily attendance by marking all students as unmarked';
COMMENT ON FUNCTION get_student_attendance_history IS 'Get attendance history for a specific student';

-- Step 8: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_updated_at();
