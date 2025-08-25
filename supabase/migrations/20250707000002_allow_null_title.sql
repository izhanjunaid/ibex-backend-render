-- Migration: 20250707000002_allow_null_title.sql
-- Allow null values for title field in homework_announcements table

-- Modify the title column to allow NULL values
ALTER TABLE homework_announcements 
ALTER COLUMN title DROP NOT NULL;

-- Add a comment to document the change
COMMENT ON COLUMN homework_announcements.title IS 'Optional title for homework announcement. Can be NULL if not provided.'; 