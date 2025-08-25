-- Migration: 20250708000007_fix_attendance_functions.sql
-- Fix attendance functions with correct data types

-- Step 1: Drop existing functions first
DROP FUNCTION IF EXISTS get_grade_section_attendance(UUID, DATE);
DROP FUNCTION IF EXISTS get_attendance_stats(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_student_attendance_history(UUID, DATE, DATE);

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
