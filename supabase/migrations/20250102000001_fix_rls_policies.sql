-- Fix RLS policies to prevent infinite recursion
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can manage all data" ON users;
DROP POLICY IF EXISTS "View invites based on role" ON invites;
DROP POLICY IF EXISTS "Admins and Teachers can create invites" ON invites;

-- Create simpler, non-recursive policies
-- Allow service role to bypass RLS entirely for backend operations
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile  
CREATE POLICY "Users can update own profile" ON users FOR UPDATE 
    USING (auth.uid() = id);

-- Service role can do everything (backend operations)
CREATE POLICY "Service role full access" ON users FOR ALL 
    USING (auth.role() = 'service_role');

-- Authenticated users can read basic user info (for dropdowns, etc)
CREATE POLICY "Authenticated users can read user list" ON users FOR SELECT 
    USING (auth.role() = 'authenticated');

-- RLS for invites table
CREATE POLICY "Service role can manage invites" ON invites FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "Users can view invites sent to them" ON invites FOR SELECT 
    USING (auth.email() = email);

-- Ensure service role can bypass RLS on all tables
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY; 