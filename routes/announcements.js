const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const hybridStorage = require('../lib/hybrid-storage');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  // Use the admin client for all announcement operations to bypass RLS for now
  req.supabase = supabaseAdmin;
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 209715200, files: 5 },
});

// Get all announcements for a class
router.get('/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { user } = req;
    const supabase = req.supabase;

    // Check if user is enrolled in the class or is the teacher
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId)
      .eq('student_id', user.id)
      .single();

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .single();

    if (enrollmentError && classData?.teacher_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to view announcements for this class' });
    }

    // Get announcements for the class
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        *,
        author:users!announcements_author_id_fkey (
          id,
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .contains('class_ids', [classId])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return res.status(500).json({ error: 'Failed to fetch announcements' });
    }

    res.json(announcements || []);
  } catch (error) {
    console.error('Error in announcements route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new announcement
router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { user } = req;
    const supabase = req.supabase;
    const { title, content, classIds, targetAudience, isUrgent } = req.body;

    // Parse classIds as array
    let classIdArr = [];
    if (classIds) {
      try {
        classIdArr = typeof classIds === 'string' ? JSON.parse(classIds) : classIds;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid classIds format' });
      }
    }

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Check if user is a teacher or admin
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can create announcements' });
    }

    // If classIdArr is provided, verify the user has access to those classes
    if (classIdArr && classIdArr.length > 0) {
      if (user.role === 'teacher') {
        const { data: teacherClasses, error: classError } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', user.id)
          .in('id', classIdArr);

        if (classError || teacherClasses.length !== classIdArr.length) {
          return res.status(403).json({ error: 'Not authorized to post announcements to some classes' });
        }
      }
    }

    // Get the school_id from the class if classIdArr is provided
    let schoolId = null;
    if (classIdArr.length > 0) {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('school_id')
        .eq('id', classIdArr[0])
        .single();
      
      if (classError || !classData) {
        console.error('Error fetching class school_id:', classError);
        return res.status(500).json({ error: 'Could not find the school for the specified class.' });
      }
      schoolId = classData.school_id;
    }

    // Handle file uploads if any
    const attachmentsMeta = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const uploadRes = await hybridStorage.uploadFile(file, {
            userId: user.id,
            folder: `announcements/${schoolId || 'general'}`,
            relatedTable: 'announcements',
          });
          attachmentsMeta.push({
            id: uploadRes.file.id,
            filename: uploadRes.file.filename,
            name: file.originalname,
            url: uploadRes.url,
            provider: uploadRes.provider,
            size: uploadRes.file.file_size,
            contentType: uploadRes.file.content_type,
          });
        } catch (uploadErr) {
          console.error('Attachment upload failed:', uploadErr.message);
        }
      }
    }

    // Create the announcement
    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        school_id: schoolId,
        author_id: user.id,
        title,
        content,
        target_audience: targetAudience ? JSON.parse(targetAudience) : ['students', 'teachers'],
        class_ids: classIdArr,
        is_urgent: isUrgent === 'true' || isUrgent === true,
        expires_at: null,
        attachments: attachmentsMeta,
      })
      .select(`
        *,
        author:users!announcements_author_id_fkey (
          id,
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .single();

    if (error) {
      console.error('Error creating announcement:', error);
      return res.status(500).json({ error: 'Failed to create announcement' });
    }

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Error in create announcement route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an announcement
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const supabase = req.supabase;
    const { id } = req.params;
    const { title, content, targetAudience, isUrgent, expiresAt, attachments } = req.body;

    // Check if user is the author or an admin
    const { data: announcement, error: fetchError } = await supabase
      .from('announcements')
      .select('author_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (announcement.author_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this announcement' });
    }

    // Update the announcement
    const { data: updatedAnnouncement, error } = await supabase
      .from('announcements')
      .update({
        title,
        content,
        target_audience: targetAudience,
        is_urgent: isUrgent,
        expires_at: expiresAt,
        attachments,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        author:users!announcements_author_id_fkey (
          id,
          first_name,
          last_name,
          profile_image_url
        )
      `)
      .single();

    if (error) {
      console.error('Error updating announcement:', error);
      return res.status(500).json({ error: 'Failed to update announcement' });
    }

    res.json(updatedAnnouncement);
  } catch (error) {
    console.error('Error in update announcement route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an announcement
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const supabase = req.supabase;
    const { id } = req.params;

    // Check if user is the author or an admin
    const { data: announcement, error: fetchError } = await supabase
      .from('announcements')
      .select('author_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (announcement.author_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this announcement' });
    }

    // Delete the announcement
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting announcement:', error);
      return res.status(500).json({ error: 'Failed to delete announcement' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error in delete announcement route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 