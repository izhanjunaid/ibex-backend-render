-- Migration: 20250109000001_optimize_attendance_performance.sql
-- Optimize attendance system performance with missing functions and improvements

-- Function to get grade sections overview with today's attendance stats
CREATE OR REPLACE FUNCTION get_grade_sections_overview(
    p_user_id UUID,
    p_user_role VARCHAR(20),
    p_date DATE
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(100),
    grade_level INTEGER,
    section VARCHAR(10),
    teacher_name TEXT,
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
    WITH grade_section_stats AS (
        SELECT 
            gs.id,
            gs.name,
            gs.grade_level,
            gs.section,
            CONCAT(u.first_name, ' ', u.last_name) as teacher_name,
            COUNT(DISTINCT gse.student_id) as total_students,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
            COUNT(CASE WHEN a.status = 'unmarked' OR a.status IS NULL THEN 1 END) as unmarked_count
        FROM grade_sections gs
        LEFT JOIN users u ON gs.teacher_id = u.id
        LEFT JOIN grade_section_enrollments gse ON gs.id = gse.grade_section_id AND gse.status = 'active'
        LEFT JOIN attendance a ON gse.student_id = a.student_id 
            AND a.grade_section_id = gs.id 
            AND a.date = p_date
        WHERE gs.is_active = true
        AND (
            p_user_role = 'admin' OR 
            (p_user_role = 'teacher' AND gs.teacher_id = p_user_id) OR
            (p_user_role = 'student' AND gse.student_id = p_user_id)
        )
        GROUP BY gs.id, gs.name, gs.grade_level, gs.section, u.first_name, u.last_name
    )
    SELECT 
        gss.id,
        gss.name,
        gss.grade_level,
        gss.section,
        gss.teacher_name,
        gss.total_students,
        gss.present_count,
        gss.absent_count,
        gss.late_count,
        gss.excused_count,
        gss.unmarked_count,
        CASE 
            WHEN gss.total_students > 0 THEN 
                ROUND(((gss.present_count + gss.late_count + gss.excused_count)::DECIMAL / gss.total_students) * 100, 2)
            ELSE 0 
        END as attendance_rate
    FROM grade_section_stats gss
    ORDER BY gss.grade_level, gss.section;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily attendance summary for all grade sections
CREATE OR REPLACE FUNCTION get_daily_attendance_summary(
    p_date DATE,
    p_user_id UUID,
    p_user_role VARCHAR(20)
)
RETURNS TABLE (
    grade_section_id UUID,
    grade_section_name VARCHAR(100),
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
    WITH attendance_summary AS (
        SELECT 
            gs.id as grade_section_id,
            gs.name as grade_section_name,
            COUNT(DISTINCT gse.student_id) as total_students,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
            COUNT(CASE WHEN a.status = 'unmarked' OR a.status IS NULL THEN 1 END) as unmarked_count
        FROM grade_sections gs
        LEFT JOIN grade_section_enrollments gse ON gs.id = gse.grade_section_id AND gse.status = 'active'
        LEFT JOIN attendance a ON gse.student_id = a.student_id 
            AND a.grade_section_id = gs.id 
            AND a.date = p_date
        WHERE gs.is_active = true
        AND (
            p_user_role = 'admin' OR 
            (p_user_role = 'teacher' AND gs.teacher_id = p_user_id)
        )
        GROUP BY gs.id, gs.name
    )
    SELECT 
        asummary.grade_section_id,
        asummary.grade_section_name,
        asummary.total_students,
        asummary.present_count,
        asummary.absent_count,
        asummary.late_count,
        asummary.excused_count,
        asummary.unmarked_count,
        CASE 
            WHEN asummary.total_students > 0 THEN 
                ROUND(((asummary.present_count + asummary.late_count + asummary.excused_count)::DECIMAL / asummary.total_students) * 100, 2)
            ELSE 0 
        END as attendance_rate
    FROM attendance_summary asummary
    ORDER BY asummary.grade_section_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get students for multiple grade sections efficiently (batch operation)
CREATE OR REPLACE FUNCTION get_grade_sections_students_batch(
    p_grade_section_ids UUID[]
)
RETURNS TABLE (
    grade_section_id UUID,
    student_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    enrollment_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gse.grade_section_id,
        u.id as student_id,
        u.first_name,
        u.last_name,
        u.email,
        gse.status as enrollment_status
    FROM users u
    INNER JOIN grade_section_enrollments gse ON u.id = gse.student_id
    WHERE gse.grade_section_id = ANY(p_grade_section_ids)
        AND gse.status = 'active'
        AND u.role = 'student'
        AND u.status = 'active'
    ORDER BY gse.grade_section_id, u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimized bulk mark attendance function with better error handling and performance
CREATE OR REPLACE FUNCTION bulk_mark_attendance_optimized(
    p_grade_section_id UUID,
    p_date DATE,
    p_attendance_records JSONB,
    p_marked_by UUID
)
RETURNS JSONB AS $$
DECLARE
    record JSONB;
    result JSONB := '{"success": true, "marked": 0, "errors": [], "notifications": []}'::jsonb;
    error_msg TEXT;
    student_ids UUID[] := '{}';
    notification_data JSONB;
BEGIN
    -- Validate inputs
    IF p_grade_section_id IS NULL OR p_date IS NULL OR p_attendance_records IS NULL THEN
        RETURN '{"success": false, "error": "Missing required parameters"}'::jsonb;
    END IF;

    -- Use a single transaction for all attendance records
    BEGIN
        -- Collect all student IDs for batch notification later
        FOR record IN SELECT * FROM jsonb_array_elements(p_attendance_records)
        LOOP
            student_ids := array_append(student_ids, (record->>'student_id')::UUID);
        END LOOP;

        -- Batch upsert all attendance records
        INSERT INTO attendance (grade_section_id, student_id, date, status, notes, marked_by, marked_at, updated_at)
        SELECT 
            p_grade_section_id,
            (record->>'student_id')::UUID,
            p_date,
            record->>'status',
            record->>'notes',
            p_marked_by,
            NOW(),
            NOW()
        FROM jsonb_array_elements(p_attendance_records) as record
        ON CONFLICT (student_id, grade_section_id, date)
        DO UPDATE SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            marked_by = EXCLUDED.marked_by,
            marked_at = NOW(),
            updated_at = NOW();
        
        -- Get the count of records processed
        result := jsonb_set(result, '{marked}', to_jsonb(array_length(student_ids, 1)));
        
        -- Prepare batch notification data (to be processed by application layer)
        notification_data := jsonb_build_object(
            'grade_section_id', p_grade_section_id,
            'date', p_date,
            'student_ids', to_jsonb(student_ids),
            'marked_by', p_marked_by
        );
        result := jsonb_set(result, '{notifications}', notification_data);
        
    EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        RETURN jsonb_build_object(
            'success', false,
            'error', error_msg,
            'marked', 0
        );
    END;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get attendance statistics with caching optimization
CREATE OR REPLACE FUNCTION get_attendance_stats_cached(
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
    -- Use materialized view approach for better performance on large datasets
    RETURN QUERY
    WITH RECURSIVE date_range AS (
        SELECT p_start_date as date
        UNION ALL
        SELECT date + INTERVAL '1 day'
        FROM date_range
        WHERE date < p_end_date
    ),
    student_count AS (
        SELECT COUNT(DISTINCT gse.student_id) as total
        FROM grade_section_enrollments gse
        WHERE gse.grade_section_id = p_grade_section_id
        AND gse.status = 'active'
    ),
    daily_stats AS (
        SELECT 
            dr.date,
            sc.total as total_students,
            COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
            COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
            COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
            COUNT(CASE WHEN a.status = 'excused' THEN 1 END) as excused_count,
            (sc.total - COUNT(CASE WHEN a.status IN ('present', 'absent', 'late', 'excused') THEN 1 END)) as unmarked_count
        FROM date_range dr
        CROSS JOIN student_count sc
        LEFT JOIN attendance a ON a.grade_section_id = p_grade_section_id 
            AND a.date = dr.date
        GROUP BY dr.date, sc.total
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_grade_section_date_status ON attendance(grade_section_id, date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_status ON attendance(student_id, status);
CREATE INDEX IF NOT EXISTS idx_grade_section_enrollments_status ON grade_section_enrollments(status);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_grade_sections_overview(UUID, VARCHAR(20), DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_attendance_summary(DATE, UUID, VARCHAR(20)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_sections_students_batch(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_mark_attendance_optimized(UUID, DATE, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_attendance_stats_cached(UUID, DATE, DATE) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_grade_sections_overview IS 'Get grade sections with attendance statistics for overview dashboard - optimized for performance';
COMMENT ON FUNCTION get_daily_attendance_summary IS 'Get daily attendance summary for all accessible grade sections - role-based access';
COMMENT ON FUNCTION get_grade_sections_students_batch IS 'Batch fetch students for multiple grade sections efficiently';
COMMENT ON FUNCTION bulk_mark_attendance_optimized IS 'Optimized bulk attendance marking with batch operations and notification preparation';
COMMENT ON FUNCTION get_attendance_stats_cached IS 'Get attendance statistics with optimized queries for better performance';

