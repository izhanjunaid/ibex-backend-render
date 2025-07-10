-- Replace get_storage_stats function with corrected numeric return columns
-- Up migration

-- 1. Drop old function (if exists)
DROP FUNCTION IF EXISTS get_storage_stats(uuid);

-- 2. Recreate function with NUMERIC size columns
CREATE FUNCTION get_storage_stats(user_uuid UUID DEFAULT NULL)
RETURNS TABLE (
  total_files        BIGINT,
  total_size_mb      NUMERIC,
  supabase_files     BIGINT,
  supabase_size_mb   NUMERIC,
  r2_files           BIGINT,
  r2_size_mb         NUMERIC,
  local_files        BIGINT,
  local_size_mb      NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_files,
    ROUND(COALESCE(SUM(file_size), 0) / 1024.0 / 1024.0, 2) AS total_size_mb,
    COUNT(*) FILTER (WHERE storage_provider = 'supabase') AS supabase_files,
    ROUND(COALESCE(SUM(file_size) FILTER (WHERE storage_provider = 'supabase'), 0) / 1024.0 / 1024.0, 2) AS supabase_size_mb,
    COUNT(*) FILTER (WHERE storage_provider = 'r2') AS r2_files,
    ROUND(COALESCE(SUM(file_size) FILTER (WHERE storage_provider = 'r2'), 0) / 1024.0 / 1024.0, 2) AS r2_size_mb,
    COUNT(*) FILTER (WHERE storage_provider = 'local') AS local_files,
    ROUND(COALESCE(SUM(file_size) FILTER (WHERE storage_provider = 'local'), 0) / 1024.0 / 1024.0, 2) AS local_size_mb
  FROM file_uploads
  WHERE user_uuid IS NULL OR user_id = user_uuid;
END;
$$ LANGUAGE plpgsql; 