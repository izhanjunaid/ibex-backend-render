-- Migration: 20250707000001_add_grade_sections_and_homework.sql
-- Add grade sections and collective homework announcements (ADDITIVE FEATURE)
-- This does NOT modify any existing tables or logic

-- Create grade sections table
CREATE TABLE grade_sections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    grade_level INTEGER NOT NULL,
    section VARCHAR(10) NOT NULL, -- A, B, C, etc.
    name VARCHAR(100) NOT NULL, -- e.g., "Grade 6B"
    description TEXT,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    academic_year VARCHAR(20) NOT NULL, -- e.g., "2024-2025"
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(school_id, grade_level, section, academic_year)
);

-- Create homework announcements table
CREATE TABLE homework_announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    grade_section_id UUID REFERENCES grade_sections(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    homework_date DATE NOT NULL,
    subjects JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of subjects with homework
    -- Format: [{"subject": "Math", "homework": "Complete exercises 1-10", "due_date": "2025-01-08"}, ...]
    pdf_file_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create grade section enrollments table
CREATE TABLE grade_section_enrollments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    grade_section_id UUID REFERENCES grade_sections(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    UNIQUE(grade_section_id, student_id)
);

-- Add indexes for performance
CREATE INDEX idx_grade_sections_school_grade ON grade_sections(school_id, grade_level, section);
CREATE INDEX idx_grade_sections_teacher ON grade_sections(teacher_id);
CREATE INDEX idx_homework_announcements_grade_section ON homework_announcements(grade_section_id);
CREATE INDEX idx_homework_announcements_date ON homework_announcements(homework_date);
CREATE INDEX idx_homework_announcements_teacher ON homework_announcements(teacher_id);
CREATE INDEX idx_grade_section_enrollments_grade_section ON grade_section_enrollments(grade_section_id);
CREATE INDEX idx_grade_section_enrollments_student ON grade_section_enrollments(student_id);

-- Add triggers for updated_at
CREATE TRIGGER update_grade_sections_updated_at BEFORE UPDATE ON grade_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homework_announcements_updated_at BEFORE UPDATE ON homework_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to get students in a grade section
CREATE OR REPLACE FUNCTION get_grade_section_students(grade_section_uuid UUID)
RETURNS TABLE (
    student_id UUID,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as student_id,
        u.first_name,
        u.last_name,
        u.email
    FROM users u
    JOIN grade_section_enrollments gse ON u.id = gse.student_id
    WHERE gse.grade_section_id = grade_section_uuid
    AND gse.status = 'active'
    AND u.role = 'student'
    AND u.status = 'active'
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get homework for a student
CREATE OR REPLACE FUNCTION get_student_homework(student_uuid UUID, start_date DATE, end_date DATE)
RETURNS TABLE (
    homework_id UUID,
    title VARCHAR(255),
    content TEXT,
    homework_date DATE,
    subjects JSONB,
    pdf_url TEXT,
    teacher_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ha.id as homework_id,
        ha.title,
        ha.content,
        ha.homework_date,
        ha.subjects,
        fu.cdn_url as pdf_url,
        CONCAT(u.first_name, ' ', u.last_name) as teacher_name
    FROM homework_announcements ha
    JOIN grade_sections gs ON ha.grade_section_id = gs.id
    JOIN grade_section_enrollments gse ON gs.id = gse.grade_section_id
    JOIN users u ON ha.teacher_id = u.id
    LEFT JOIN file_uploads fu ON ha.pdf_file_id = fu.id
    WHERE gse.student_id = student_uuid
    AND gse.status = 'active'
    AND ha.is_published = true
    AND ha.homework_date BETWEEN start_date AND end_date
    ORDER BY ha.homework_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON grade_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON homework_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON grade_section_enrollments TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_section_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_homework(UUID, DATE, DATE) TO authenticated; 