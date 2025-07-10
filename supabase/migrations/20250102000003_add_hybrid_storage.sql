-- Add hybrid storage support and file management tables
-- This migration adds comprehensive file management with multi-provider storage

-- File uploads tracking table
CREATE TABLE file_uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    
    -- Hybrid storage fields
    storage_provider VARCHAR(20) NOT NULL DEFAULT 'supabase', -- 'supabase', 'r2', 'local'
    bucket VARCHAR(50) NOT NULL,
    folder VARCHAR(100) DEFAULT 'general',
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    upload_url TEXT,
    cdn_url TEXT,
    
    -- Metadata
    compression_ratio DECIMAL(3,2), -- For compressed files
    thumbnail_path VARCHAR(500),
    
    -- Relationships
    related_table VARCHAR(50), -- 'assignments', 'submissions', 'messages', etc.
    related_id UUID,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For temporary files
    
    -- Indexing
    UNIQUE(filename, storage_provider, bucket)
);

-- Storage usage tracking for cost optimization
CREATE TABLE storage_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Usage by provider
    supabase_storage_mb BIGINT DEFAULT 0,
    r2_storage_mb BIGINT DEFAULT 0,
    local_storage_mb BIGINT DEFAULT 0,
    
    -- Transfer stats
    upload_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    bandwidth_mb BIGINT DEFAULT 0,
    
    -- Costs (in cents)
    estimated_cost_cents INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- File access logs for analytics
CREATE TABLE file_access_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    file_id UUID REFERENCES file_uploads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    action VARCHAR(20) NOT NULL, -- 'upload', 'download', 'view', 'delete'
    ip_address INET,
    user_agent TEXT,
    
    -- Performance metrics
    response_time_ms INTEGER,
    file_size_bytes BIGINT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_storage_provider ON file_uploads(storage_provider);
CREATE INDEX idx_file_uploads_related ON file_uploads(related_table, related_id);
CREATE INDEX idx_file_uploads_created_at ON file_uploads(created_at);
CREATE INDEX idx_file_uploads_expires_at ON file_uploads(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_storage_usage_user_date ON storage_usage(user_id, date);
CREATE INDEX idx_storage_usage_date ON storage_usage(date);

CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX idx_file_access_logs_created_at ON file_access_logs(created_at);

-- Add RLS policies for file_uploads
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own files
CREATE POLICY "Users can view their own files" ON file_uploads
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own files
CREATE POLICY "Users can upload their own files" ON file_uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "Users can update their own files" ON file_uploads
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "Users can delete their own files" ON file_uploads
    FOR DELETE USING (auth.uid() = user_id);

-- Teachers can view files related to their assignments
CREATE POLICY "Teachers can view assignment files" ON file_uploads
    FOR SELECT USING (
        related_table = 'assignments' AND
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN classes c ON a.class_id = c.id
            WHERE a.id = file_uploads.related_id
            AND c.teacher_id = auth.uid()
        )
    );

-- Add RLS policies for storage_usage
ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own storage usage" ON storage_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own storage usage" ON storage_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage usage" ON storage_usage
    FOR UPDATE USING (auth.uid() = user_id);

-- Add RLS policies for file_access_logs
ALTER TABLE file_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own file access logs" ON file_access_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert access logs" ON file_access_logs
    FOR INSERT WITH CHECK (true);

-- Add foreign key constraints to existing tables for file relationships
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_file_id UUID REFERENCES file_uploads(id);
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_file_id UUID REFERENCES file_uploads(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_file_id UUID REFERENCES file_uploads(id);

-- Create function to update storage usage
CREATE OR REPLACE FUNCTION update_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update storage usage when files are uploaded/deleted
    IF TG_OP = 'INSERT' THEN
        INSERT INTO storage_usage (user_id, date, supabase_storage_mb, r2_storage_mb, local_storage_mb, upload_count)
        VALUES (
            NEW.user_id,
            CURRENT_DATE,
            CASE WHEN NEW.storage_provider = 'supabase' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            CASE WHEN NEW.storage_provider = 'r2' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            CASE WHEN NEW.storage_provider = 'local' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            1
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
            supabase_storage_mb = storage_usage.supabase_storage_mb + 
                CASE WHEN NEW.storage_provider = 'supabase' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            r2_storage_mb = storage_usage.r2_storage_mb + 
                CASE WHEN NEW.storage_provider = 'r2' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            local_storage_mb = storage_usage.local_storage_mb + 
                CASE WHEN NEW.storage_provider = 'local' THEN NEW.file_size / 1024 / 1024 ELSE 0 END,
            upload_count = storage_usage.upload_count + 1;
            
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update storage usage
CREATE TRIGGER trigger_update_storage_usage
    AFTER INSERT ON file_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_storage_usage();

-- Create function to clean up expired files
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired files
    DELETE FROM file_uploads 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get storage statistics
CREATE OR REPLACE FUNCTION get_storage_stats(user_uuid UUID DEFAULT NULL)
RETURNS TABLE (
    total_files BIGINT,
    total_size_mb BIGINT,
    supabase_files BIGINT,
    supabase_size_mb BIGINT,
    r2_files BIGINT,
    r2_size_mb BIGINT,
    local_files BIGINT,
    local_size_mb BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_files,
        SUM(file_size) / 1024 / 1024 as total_size_mb,
        COUNT(*) FILTER (WHERE storage_provider = 'supabase') as supabase_files,
        SUM(file_size) FILTER (WHERE storage_provider = 'supabase') / 1024 / 1024 as supabase_size_mb,
        COUNT(*) FILTER (WHERE storage_provider = 'r2') as r2_files,
        SUM(file_size) FILTER (WHERE storage_provider = 'r2') / 1024 / 1024 as r2_size_mb,
        COUNT(*) FILTER (WHERE storage_provider = 'local') as local_files,
        SUM(file_size) FILTER (WHERE storage_provider = 'local') / 1024 / 1024 as local_size_mb
    FROM file_uploads
    WHERE user_uuid IS NULL OR user_id = user_uuid;
END;
$$ LANGUAGE plpgsql; 