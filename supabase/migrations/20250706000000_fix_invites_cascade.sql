-- Fix invites table to cascade delete when users are deleted
-- Migration: 20250706000000_fix_invites_cascade.sql

-- Drop existing foreign key constraints
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_invited_by_fkey;
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_accepted_by_fkey;

-- Recreate with CASCADE delete
ALTER TABLE invites 
ADD CONSTRAINT invites_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE invites 
ADD CONSTRAINT invites_accepted_by_fkey 
FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE CASCADE;

-- Add comment explaining the change
COMMENT ON TABLE invites IS 'Invites table with CASCADE delete - when a user is deleted, all their invites are also deleted'; 