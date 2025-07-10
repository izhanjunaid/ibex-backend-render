-- Comprehensive class deletion with cleanup
-- Migration: 20250706000003_comprehensive_class_deletion.sql

-- Create function to delete class and all related data
CREATE OR REPLACE FUNCTION delete_class_comprehensive(class_id UUID, user_id UUID)
RETURNS JSONB AS $$
DECLARE
  class_record RECORD;
  user_record RECORD;
  file_record RECORD;
  deleted_files INTEGER := 0;
  deleted_announcements INTEGER := 0;
  deleted_assignments INTEGER := 0;
  deleted_submissions INTEGER := 0;
  deleted_comments INTEGER := 0;
  deleted_enrollments INTEGER := 0;
  deleted_attendance INTEGER := 0;
  deleted_grades INTEGER := 0;
  temp_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Check if class exists
  SELECT * INTO class_record FROM classes WHERE id = class_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class not found');
  END IF;

  -- Check if user exists and has permission
  SELECT * INTO user_record FROM users WHERE id = user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check authorization: only admin or the class teacher can delete
  IF user_record.role != 'admin' AND class_record.teacher_id != user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to delete this class');
  END IF;

  -- Start transaction
  BEGIN
    -- 1. Delete comments related to class assignments and announcements
    DELETE FROM comments 
    WHERE parent_type = 'assignment' 
      AND parent_id IN (SELECT id FROM assignments WHERE assignments.class_id = class_id);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_comments := deleted_comments + temp_count;

    DELETE FROM comments 
    WHERE parent_type = 'announcement' 
      AND parent_id IN (SELECT id FROM announcements WHERE announcements.class_ids @> ARRAY[class_id]);
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_comments := deleted_comments + temp_count;

    -- 2. Delete assignment submissions and their files
    FOR file_record IN 
      SELECT fu.* FROM file_uploads fu
      JOIN assignment_submissions s ON fu.related_table = 'assignment_submissions' AND fu.related_id = s.id
      WHERE s.assignment_id IN (SELECT id FROM assignments WHERE assignments.class_id = class_id)
    LOOP
      -- Delete from storage (this will be handled by the application layer)
      -- For now, we'll mark them for deletion
      UPDATE file_uploads 
      SET expires_at = NOW() 
      WHERE id = file_record.id;
      deleted_files := deleted_files + 1;
    END LOOP;

    -- Delete assignment submissions
    DELETE FROM assignment_submissions 
    WHERE assignment_id IN (SELECT id FROM assignments WHERE assignments.class_id = class_id);
    GET DIAGNOSTICS deleted_submissions = ROW_COUNT;

    -- 3. Delete assignment files
    FOR file_record IN 
      SELECT fu.* FROM file_uploads fu
      JOIN assignments a ON fu.related_table = 'assignments' AND fu.related_id = a.id
      WHERE a.class_id = class_id
    LOOP
      UPDATE file_uploads 
      SET expires_at = NOW() 
      WHERE id = file_record.id;
      deleted_files := deleted_files + 1;
    END LOOP;

    -- 4. Delete assignments
    DELETE FROM assignments WHERE assignments.class_id = class_id;
    GET DIAGNOSTICS deleted_assignments = ROW_COUNT;

    -- 5. Delete announcement files
    FOR file_record IN 
      SELECT fu.* FROM file_uploads fu
      JOIN announcements a ON fu.related_table = 'announcements' AND fu.related_id = a.id
      WHERE a.class_ids @> ARRAY[class_id]
    LOOP
      UPDATE file_uploads 
      SET expires_at = NOW() 
      WHERE id = file_record.id;
      deleted_files := deleted_files + 1;
    END LOOP;

    -- 6. Delete announcements that target this class
    DELETE FROM announcements WHERE announcements.class_ids @> ARRAY[class_id];
    GET DIAGNOSTICS deleted_announcements = ROW_COUNT;

    -- 7. Delete grades
    DELETE FROM grades WHERE grades.class_id = class_id;
    GET DIAGNOSTICS deleted_grades = ROW_COUNT;

    -- 8. Delete attendance records
    DELETE FROM attendance WHERE attendance.class_id = class_id;
    GET DIAGNOSTICS deleted_attendance = ROW_COUNT;

    -- 9. Delete class enrollments
    DELETE FROM class_enrollments WHERE class_enrollments.class_id = class_id;
    GET DIAGNOSTICS deleted_enrollments = ROW_COUNT;

    -- 10. Finally delete the class
    DELETE FROM classes WHERE classes.id = class_id;

    -- Build result
    result := jsonb_build_object(
      'success', true,
      'message', 'Class and all related data deleted successfully',
      'deleted_data', jsonb_build_object(
        'class_id', class_id,
        'class_name', class_record.name,
        'files_marked_for_deletion', deleted_files,
        'announcements_deleted', deleted_announcements,
        'assignments_deleted', deleted_assignments,
        'submissions_deleted', deleted_submissions,
        'comments_deleted', deleted_comments,
        'enrollments_deleted', deleted_enrollments,
        'attendance_records_deleted', deleted_attendance,
        'grades_deleted', deleted_grades
      )
    );

    RETURN result;

  EXCEPTION WHEN OTHERS THEN
    -- Rollback transaction
    RAISE EXCEPTION 'Error deleting class: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_class_comprehensive TO authenticated;

-- Create a function to clean up expired files from storage
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS INTEGER AS $$
DECLARE
  file_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  FOR file_record IN 
    SELECT * FROM file_uploads 
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
  LOOP
    -- Delete from storage (this will be handled by the application layer)
    -- For now, we'll just delete the database record
    DELETE FROM file_uploads WHERE id = file_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_expired_files TO authenticated;

-- Add comment explaining the functions
COMMENT ON FUNCTION delete_class_comprehensive IS 'Comprehensive class deletion that cleans up all related data including files, announcements, assignments, submissions, comments, grades, attendance, and enrollments';
COMMENT ON FUNCTION cleanup_expired_files IS 'Clean up files that have expired and should be deleted from storage'; 