-- Migration: 20250708000005_remove_attendance_system.sql
-- Remove all attendance-related database objects

-- Step 1: Drop attendance-related functions first (they reference the table)
DROP FUNCTION IF EXISTS get_grade_section_attendance_students(UUID, DATE);
DROP FUNCTION IF EXISTS get_grade_section_attendance_stats(UUID, DATE, DATE);

-- Step 2: Drop the attendance table and all its data
DROP TABLE IF EXISTS attendance CASCADE;

-- Step 3: Remove any attendance-related indexes (they should be dropped with the table, but just in case)
-- Note: Indexes are automatically dropped when the table is dropped

-- Step 4: Remove any attendance-related triggers (they should be dropped with the table, but just in case)
-- Note: Triggers are automatically dropped when the table is dropped

-- Step 5: Remove any attendance-related constraints (they should be dropped with the table, but just in case)
-- Note: Constraints are automatically dropped when the table is dropped

-- Step 6: Clean up any attendance-related sequences (if any were created)
-- Note: Sequences are automatically dropped when the table is dropped

-- Step 7: Remove any attendance-related comments
-- Note: Comments are automatically dropped when the table is dropped

-- Verification: Check if attendance table still exists (should return error if successful)
-- SELECT * FROM attendance LIMIT 1;

COMMENT ON SCHEMA public IS 'Attendance system has been completely removed. Database is clean for fresh attendance implementation.';
