const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Cloudflare R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Storage thresholds
const STORAGE_THRESHOLDS = {
  SMALL: parseInt(process.env.SMALL_FILE_THRESHOLD) || 2097152,    // 2MB
  MEDIUM: parseInt(process.env.MEDIUM_FILE_THRESHOLD) || 52428800, // 50MB
  LARGE: parseInt(process.env.LARGE_FILE_THRESHOLD) || 104857600,  // 100MB
};

// File type configurations
const FILE_CONFIGS = {
  images: { 
    types: ['jpg', 'jpeg', 'png', 'gif', 'webp'], 
    bucket: 'images',
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  documents: { 
    types: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'], 
    bucket: 'documents',
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  videos: { 
    types: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'], 
    bucket: 'videos',
    maxSize: 200 * 1024 * 1024 // 200MB
  },
  archives: { 
    types: ['zip', 'rar', '7z', 'tar', 'gz'], 
    bucket: 'archives',
    maxSize: 100 * 1024 * 1024 // 100MB
  }
};

class CDNStorageService {
  constructor() {
    this.ensureLocalStorageDir();
  }

  async ensureLocalStorageDir() {
    if (process.env.LOCAL_STORAGE_ENABLED === 'true') {
      const storageDir = process.env.LOCAL_STORAGE_PATH || './storage';
      try {
        await fs.mkdir(storageDir, { recursive: true });
        console.log(`✅ Local storage directory ensured: ${storageDir}`);
      } catch (error) {
        console.error('❌ Failed to create local storage directory:', error);
      }
    }
  }

  /**
   * Determine the best storage provider based on file size and type
   */
  determineStorageProvider(fileSize, fileType) {
    // Use CDN (R2) for all files for better performance and global access
    if (fileSize <= STORAGE_THRESHOLDS.LARGE) {
      return 'r2';
    }
    
    // Files too large - reject
    throw new Error(`File too large: ${fileSize} bytes. Maximum allowed: ${STORAGE_THRESHOLDS.LARGE} bytes`);
  }

  /**
   * Get file configuration based on file extension
   */
  getFileConfig(filename) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    
    for (const [category, config] of Object.entries(FILE_CONFIGS)) {
      if (config.types.includes(ext)) {
        return { category, ...config };
      }
    }
    
    // Default to documents for unknown types
    return { category: 'documents', ...FILE_CONFIGS.documents };
  }

  /**
   * Generate unique filename to prevent conflicts
   */
  generateUniqueFilename(originalName, userId) {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    
    return `${userId}/${timestamp}-${random}-${name}${ext}`;
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadToSupabase(file, filename, bucket, options = {}) {
    try {
      let { data, error } = await supabase.storage
        .from(bucket)
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: options.upsert || false
        });

      // Retry with generic content-type if Supabase rejects MIME type
      if (error && error.statusCode === '415') {
        console.warn(`⚠️  Re-trying upload with generic mime-type for ${file.originalname}`);
        const retry = await supabase.storage
          .from(bucket)
          .upload(filename, file.buffer, {
            contentType: 'application/octet-stream',
            cacheControl: '3600',
            upsert: options.upsert || false
          });
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filename);

      return {
        success: true,
        path: data.path,
        url: urlData.publicUrl,
        provider: 'supabase',
        bucket
      };
    } catch (error) {
      console.error('❌ Supabase upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload file to Cloudflare R2
   */
  async uploadToR2(file, filename, bucket, options = {}) {
    try {
      const key = `${bucket}/${filename}`;
      
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=3600',
        Metadata: {
          originalName: file.originalname,
          uploadedBy: options.userId || 'unknown',
          uploadedAt: new Date().toISOString()
        }
      });

      await r2Client.send(command);

      // Generate a presigned URL (default 7-day expiry)
      const getCmd = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      });
      const url = await getSignedUrl(r2Client, getCmd, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days

      return {
        success: true,
        path: key,
        url,
        provider: 'r2',
        bucket
      };
    } catch (error) {
      console.error('❌ R2 upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload file to local storage
   */
  async uploadToLocal(file, filename, bucket, options = {}) {
    try {
      const storageDir = process.env.LOCAL_STORAGE_PATH || './storage';
      const bucketDir = path.join(storageDir, bucket);
      
      // Ensure bucket directory exists
      await fs.mkdir(bucketDir, { recursive: true });
      
      const filePath = path.join(bucketDir, filename);
      
      // Write file to disk
      await fs.writeFile(filePath, file.buffer);
      
      // Generate public URL
      const baseUrl = process.env.LOCAL_BASE_URL || 'http://localhost:3001';
      const url = `${baseUrl}/storage/${bucket}/${filename}`;

      return {
        success: true,
        path: filePath,
        url,
        provider: 'local',
        bucket
      };
    } catch (error) {
      console.error('❌ Local upload failed:', error);
      throw error;
    }
  }

  /**
   * Main upload method - routes to appropriate storage provider
   */
  async uploadFile(file, options = {}) {
    try {
      const { userId, folder = 'general', isPublic = false, relatedTable, relatedId } = options;
      
      if (!userId) {
        throw new Error('User ID is required for file upload');
      }

      // Validate file
      if (!file || !file.buffer) {
        throw new Error('Invalid file data');
      }

      // Get file configuration
      const fileConfig = this.getFileConfig(file.originalname);
      
      // Check file size against type limits
      if (file.size > fileConfig.maxSize) {
        throw new Error(`File too large for ${fileConfig.category}: ${file.size} bytes. Maximum: ${fileConfig.maxSize} bytes`);
      }

      // Determine storage provider
      const provider = this.determineStorageProvider(file.size, fileConfig.category);
      
      // Generate unique filename
      const uniqueFilename = this.generateUniqueFilename(file.originalname, userId);
      
      // Upload to CDN (R2) for all files
      let uploadResult;
      try {
        uploadResult = await this.uploadToR2(file, uniqueFilename, fileConfig.bucket, options);
      } catch (provErr) {
        console.error('❌ CDN upload failed:', provErr);
        throw provErr;
      }

      // Save file metadata to database
      const fileRecord = {
        user_id: userId,
        filename: uniqueFilename,
        original_name: file.originalname,
        file_path: uploadResult.path,
        file_size: file.size,
        content_type: file.mimetype,
        storage_provider: 'r2', // Always use CDN
        bucket: uploadResult.bucket || fileConfig.bucket,
        folder,
        is_public: isPublic,
        upload_url: uploadResult.url,
        cdn_url: uploadResult.url,
        related_table: relatedTable,
        related_id: relatedId
      };

      const { data: dbResult, error: dbError } = await supabase
        .from('file_uploads')
        .insert(fileRecord)
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database insert failed:', dbError);
        // Try to cleanup uploaded file
        await this.deleteFile(uploadResult.path, uploadResult.provider, uploadResult.bucket);
        throw dbError;
      }

      // Log file access
      await this.logFileAccess(dbResult.id, userId, 'upload', {
        fileSize: file.size,
        provider: uploadResult.provider
      });

      return {
        success: true,
        file: dbResult,
        url: uploadResult.url,
        provider: 'r2',
        message: `File uploaded successfully to CDN`
      };

    } catch (error) {
      console.error('❌ File upload failed:', error);
      throw error;
    }
  }

  /**
   * Delete file from CDN storage
   */
  async deleteFile(filePath, provider, bucket) {
    try {
      // Only handle R2 (CDN) deletions
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath
      });
      await r2Client.send(deleteCommand);
      
      return { success: true };
    } catch (error) {
      console.error('❌ CDN file deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get file download URL
   */
  async getFileUrl(fileId, userId, expiresIn = 3600) {
    try {
      // Get file metadata from database
      const { data: file, error } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error || !file) {
        throw new Error('File not found');
      }

      // Check permissions
      if (file.user_id !== userId && !file.is_public) {
        throw new Error('Access denied');
      }

      // Log file access
      await this.logFileAccess(fileId, userId, 'download');

      // Return CDN URL (R2)
      if (file.is_public) {
        return { url: file.cdn_url, expires: null };
      } else {
        const getCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: file.file_path
        });
        
        const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn });
        return { url: signedUrl, expires: Date.now() + (expiresIn * 1000) };
      }
    } catch (error) {
      console.error('❌ Get file URL failed:', error);
      throw error;
    }
  }

  /**
   * Log file access for analytics
   */
  async logFileAccess(fileId, userId, action, metadata = {}) {
    try {
      const logEntry = {
        file_id: fileId,
        user_id: userId,
        action,
        response_time_ms: metadata.responseTime,
        file_size_bytes: metadata.fileSize
      };

      await supabase
        .from('file_access_logs')
        .insert(logEntry);
    } catch (error) {
      console.error('❌ Failed to log file access:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId = null) {
    try {
      // Use direct query instead of RPC function to avoid type issues
      let query = supabase
        .from('file_uploads')
        .select('storage_provider, file_size');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: files, error } = await query;

      if (error) throw error;

      // Calculate CDN stats
      const stats = {
        total_files: files.length,
        total_size_mb: 0,
        cdn_files: 0,
        cdn_size_mb: 0
      };

      files.forEach(file => {
        const sizeMB = file.file_size / 1024 / 1024;
        stats.total_size_mb += sizeMB;
        stats.cdn_files++;
        stats.cdn_size_mb += sizeMB;
      });

      // Round to 2 decimal places
      stats.total_size_mb = Math.round(stats.total_size_mb * 100) / 100;
      stats.cdn_size_mb = Math.round(stats.cdn_size_mb * 100) / 100;

      return stats;
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles() {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_expired_files');

      if (error) throw error;

      console.log(`✅ Cleaned up ${data} expired files`);
      return data;
    } catch (error) {
      console.error('❌ Failed to cleanup expired files:', error);
      throw error;
    }
  }
}

module.exports = new CDNStorageService(); 