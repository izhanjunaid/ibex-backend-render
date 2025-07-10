const express = require('express');
const multer = require('multer');
const router = express.Router();
const hybridStorage = require('../lib/hybrid-storage');
const { authenticateToken } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 209715200, // 200MB
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Get allowed file types from environment
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 
      'xls', 'xlsx', 'mp4', 'avi', 'mov', 'zip', 'rar'
    ];
    
    const fileExt = file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${fileExt} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

/**
 * Get user's files (main listing route)
 * GET /api/files/
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const folder = req.query.folder;
    const provider = req.query.provider;
    const contentType = req.query.contentType;

    let query = supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (folder) {
      query = query.eq('folder', folder);
    }

    if (provider) {
      query = query.eq('storage_provider', provider);
    }

    if (contentType) {
      query = query.ilike('content_type', `${contentType}%`);
    }

    const { data: files, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('file_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (folder) countQuery = countQuery.eq('folder', folder);
    if (provider) countQuery = countQuery.eq('storage_provider', provider);
    if (contentType) countQuery = countQuery.ilike('content_type', `${contentType}%`);

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    res.json({
      success: true,
      files: (files || []).map(file => ({
        id: file.id,
        filename: file.filename,
        original_name: file.original_name,
        size: file.file_size,
        contentType: file.content_type,
        provider: file.storage_provider,
        bucket: file.bucket,
        folder: file.folder,
        isPublic: file.is_public,
        url: file.cdn_url,
        createdAt: file.created_at
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get files error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get files' 
    });
  }
});

/**
 * Upload single file
 * POST /api/files/upload
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const options = {
      userId: req.user.id,
      folder: req.body.folder || 'general',
      isPublic: req.body.isPublic === 'true',
      relatedTable: req.body.relatedTable,
      relatedId: req.body.relatedId
    };

    const result = await hybridStorage.uploadFile(req.file, options);

    res.json({
      success: true,
      message: result.message,
      file: {
        id: result.file.id,
        filename: result.file.filename,
        originalName: result.file.original_name,
        size: result.file.file_size,
        contentType: result.file.content_type,
        url: result.url,
        provider: result.provider,
        createdAt: result.file.created_at
      }
    });

  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'File upload failed' 
    });
  }
});

/**
 * Upload multiple files
 * POST /api/files/upload-multiple
 */
router.post('/upload-multiple', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    const options = {
      userId: req.user.id,
      folder: req.body.folder || 'general',
      isPublic: req.body.isPublic === 'true',
      relatedTable: req.body.relatedTable,
      relatedId: req.body.relatedId
    };

    const results = [];
    const errors = [];

    // Upload files sequentially to avoid overwhelming the system
    for (const file of req.files) {
      try {
        const result = await hybridStorage.uploadFile(file, options);
        results.push({
          id: result.file.id,
          filename: result.file.filename,
          originalName: result.file.original_name,
          size: result.file.file_size,
          contentType: result.file.content_type,
          url: result.url,
          provider: result.provider,
          createdAt: result.file.created_at
        });
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: errors.length === 0,
      message: `${results.length} files uploaded successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      files: results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Multiple file upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'File upload failed' 
    });
  }
});

/**
 * Get file download URL
 * GET /api/files/:fileId/download
 */
router.get('/:fileId/download', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const expiresIn = parseInt(req.query.expires) || 3600; // 1 hour default

    const result = await hybridStorage.getFileUrl(fileId, req.user.id, expiresIn);

    res.json({
      success: true,
      url: result.url,
      expires: result.expires
    });

  } catch (error) {
    console.error('❌ File download error:', error);
    
    if (error.message === 'File not found') {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }
    
    if (error.message === 'Access denied') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get file URL' 
    });
  }
});

/**
 * Get user's files (main listing route)
 * GET /api/files/
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const folder = req.query.folder;
    const provider = req.query.provider;
    const contentType = req.query.contentType;

    let query = supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (folder) {
      query = query.eq('folder', folder);
    }

    if (provider) {
      query = query.eq('storage_provider', provider);
    }

    if (contentType) {
      query = query.ilike('content_type', `${contentType}%`);
    }

    const { data: files, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('file_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (folder) countQuery = countQuery.eq('folder', folder);
    if (provider) countQuery = countQuery.eq('storage_provider', provider);
    if (contentType) countQuery = countQuery.ilike('content_type', `${contentType}%`);

    const { count, error: countError } = await countQuery;

    if (countError) throw countError;

    res.json({
      success: true,
      files: (files || []).map(file => ({
        id: file.id,
        filename: file.filename,
        original_name: file.original_name,
        size: file.file_size,
        contentType: file.content_type,
        provider: file.storage_provider,
        bucket: file.bucket,
        folder: file.folder,
        isPublic: file.is_public,
        url: file.cdn_url,
        createdAt: file.created_at
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('❌ Get files error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get files' 
    });
  }
});

/**
 * Delete file
 * DELETE /api/files/:fileId
 */
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get file metadata
    const { data: file, error: fetchError } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !file) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }

    // Delete from storage provider
    await hybridStorage.deleteFile(file.file_path, file.storage_provider, file.bucket);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('id', fileId);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ File deletion error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete file' 
    });
  }
});

/**
 * Get storage statistics
 * GET /api/files/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await hybridStorage.getStorageStats(req.user.id);

    res.json({
      success: true,
      stats: {
        totalFiles: stats.total_files,
        totalSizeMB: stats.total_size_mb,
        byProvider: {
          supabase: {
            count: stats.supabase_files,
            totalSize: stats.supabase_size_mb
          },
          r2: {
            count: stats.r2_files,
            totalSize: stats.r2_size_mb
          },
          local: {
            count: stats.local_files,
            totalSize: stats.local_size_mb
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Get storage stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to get storage statistics' 
    });
  }
});

/**
 * Serve local files (for development)
 * GET /api/files/local/:bucket/:filename
 */
router.get('/local/:bucket/:filename', (req, res) => {
  try {
    const { bucket, filename } = req.params;
    const storageDir = process.env.LOCAL_STORAGE_PATH || './storage';
    const filePath = require('path').join(storageDir, bucket, filename);

    // Security check - ensure file is within storage directory
    const resolvedPath = require('path').resolve(filePath);
    const resolvedStorageDir = require('path').resolve(storageDir);
    
    if (!resolvedPath.startsWith(resolvedStorageDir)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.sendFile(resolvedPath);

  } catch (error) {
    console.error('❌ Local file serve error:', error);
    res.status(404).json({ 
      success: false, 
      message: 'File not found' 
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size: ${Math.round(parseInt(process.env.MAX_FILE_SIZE) / 1024 / 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 5 files per request'
      });
    }
  }
  
  res.status(400).json({
    success: false,
    message: error.message || 'File upload error'
  });
});

module.exports = router; 