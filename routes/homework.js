const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const multer = require('multer');
const cdnStorage = require('../lib/cdn-storage');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// GET /api/homework/grade-section/:gradeSectionId
// Get homework for a specific grade section
router.get('/grade-section/:gradeSectionId', authenticateToken, async (req, res) => {
  console.log('🔍 [HOMEWORK] GET /grade-section/:gradeSectionId - Fetching grade section homework');
  console.log('   🆔 Grade section ID:', req.params.gradeSectionId);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📅 Query params:', req.query);
  console.log('   🌐 Request origin:', req.headers.origin);
  console.log('   📱 User agent:', req.headers['user-agent']);
  console.log('   🔑 Token present:', !!req.headers.authorization);
  
  try {
    const { user } = req;
    const { gradeSectionId } = req.params;
    const { start_date, end_date } = req.query;
    const supabase = req.supabase;

    // Verify grade section exists and user has access
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', gradeSectionId)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [HOMEWORK] Grade section not found:', gradeSectionId);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section teacher_id:', gradeSection.teacher_id);

    if (user.role === 'teacher' && user.id !== gradeSection.teacher_id) {
      console.log('❌ [HOMEWORK] Access denied - not the assigned teacher');
      return res.status(403).json({ error: 'Not authorized to view homework for this grade section' });
    }

    if (user.role === 'student') {
      console.log('   👨‍🎓 Checking student enrollment...');
      // Check if student is enrolled
      const { data: enrollment, error: enrollError } = await supabase
        .from('grade_section_enrollments')
        .select('*')
        .eq('grade_section_id', gradeSectionId)
        .eq('student_id', user.id)
        .eq('status', 'active')
        .single();

      if (enrollError || !enrollment) {
        console.log('❌ [HOMEWORK] Student not enrolled in grade section');
        console.log('   🔍 Enrollment check details:');
        console.log('     - Student ID:', user.id);
        console.log('     - Grade Section ID:', gradeSectionId);
        console.log('     - Enrollment error:', enrollError);
        console.log('     - Enrollment data:', enrollment);
        return res.status(403).json({ error: 'Not enrolled in this grade section' });
      }
      console.log('✅ [HOMEWORK] Student enrollment verified');
      console.log('   📊 Enrollment details:', enrollment);
    }

    // Build query
    let query = supabase
      .from('homework_announcements')
      .select(`
        *,
        teacher:users!homework_announcements_teacher_id_fkey(id, first_name, last_name, email),
        pdf_file:file_uploads!homework_announcements_pdf_file_id_fkey(id, filename, cdn_url)
      `)
      .eq('grade_section_id', gradeSectionId)
      .order('homework_date', { ascending: false });

    // Add date filters if provided
    if (start_date) {
      console.log('   📅 Filtering from date:', start_date);
      query = query.gte('homework_date', start_date);
    }
    if (end_date) {
      console.log('   📅 Filtering to date:', end_date);
      query = query.lte('homework_date', end_date);
    }

    console.log('   🔍 Executing database query...');
    const { data: homework, error } = await query;

    if (error) {
      console.error('❌ [HOMEWORK] Error fetching homework:', error);
      console.log('   🔍 Database error details:', error);
      return res.status(500).json({ error: 'Failed to fetch homework' });
    }

    console.log('✅ [HOMEWORK] Successfully fetched', homework?.length || 0, 'homework items');
    console.log('   📊 Response data:', JSON.stringify(homework, null, 2));
    console.log('   📈 Response size:', JSON.stringify(homework).length, 'characters');
    console.log('   🕒 Response time:', new Date().toISOString());

    res.json({ success: true, homework: homework || [] });
  } catch (error) {
    console.error('❌ [HOMEWORK] Error fetching homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/homework/student
// Get homework for the current student
router.get('/student', authenticateToken, async (req, res) => {
  console.log('🔍 [HOMEWORK] GET /student - Fetching student homework');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📅 Query params:', req.query);
  console.log('   🌐 Request origin:', req.headers.origin);
  console.log('   📱 User agent:', req.headers['user-agent']);
  console.log('   🔑 Token present:', !!req.headers.authorization);
  
  try {
    const { user } = req;
    const { start_date, end_date } = req.query;
    const supabase = req.supabase;

    if (user.role !== 'student') {
      console.log('❌ [HOMEWORK] Access denied - only students can access this endpoint');
      console.log('   🔍 User role:', user.role);
      return res.status(403).json({ error: 'Only students can access this endpoint' });
    }

    console.log('   👨‍🎓 Fetching homework for student:', user.id);
    console.log('   📅 Date range:', {
      start_date: start_date || 'default (today)',
      end_date: end_date || 'default (+30 days)'
    });

    // Get homework using the function
    const functionParams = {
      student_uuid: user.id,
      start_date: start_date || new Date().toISOString().split('T')[0],
      end_date: end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    console.log('   🔍 Calling get_student_homework function with params:', functionParams);
    
    const { data: homework, error } = await supabase
      .rpc('get_student_homework', functionParams);

    if (error) {
      console.error('❌ [HOMEWORK] Error fetching student homework:', error);
      console.log('   🔍 Function error details:', error);
      return res.status(500).json({ error: 'Failed to fetch homework' });
    }

    console.log('✅ [HOMEWORK] Successfully fetched', homework?.length || 0, 'homework items for student');
    console.log('   📊 Response data:', JSON.stringify(homework, null, 2));
    console.log('   📈 Response size:', JSON.stringify(homework).length, 'characters');
    console.log('   🕒 Response time:', new Date().toISOString());
    console.log('   🎯 Function execution successful');

    res.json(homework || []);
  } catch (error) {
    console.error('❌ [HOMEWORK] Error fetching student homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/homework
// Create a new homework announcement (Teacher/Admin)
router.post('/', [
  authenticateToken,
  upload.single('pdf_file'),
  [
    body('grade_section_id').isUUID().withMessage('Valid grade section ID is required'),
    body('title').optional().isLength({ min: 2, max: 255 }).withMessage('Title must be between 2 and 255 characters if provided'),
    body('homework_date').isISO8601().withMessage('Valid homework date is required'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array if provided')
  ]
], async (req, res) => {
  console.log('🔍 [HOMEWORK] POST / - Creating new homework announcement');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  console.log('   📄 File uploaded:', req.file ? `Yes (${req.file.originalname}, ${req.file.size} bytes)` : 'No');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [HOMEWORK] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const supabase = req.supabase;
    const {
      grade_section_id,
      title,
      content,
      homework_date,
      subjects = [], // Make subjects optional
      is_published = false
    } = req.body;

    if (!['teacher', 'admin'].includes(user.role)) {
      console.log('❌ [HOMEWORK] Access denied - only teachers or admins can create homework');
      return res.status(403).json({ error: 'Only teachers or admins can create homework' });
    }

    // Verify grade section exists and user has access
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', grade_section_id)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [HOMEWORK] Grade section not found:', grade_section_id);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section teacher_id:', gradeSection.teacher_id);

    if (user.role === 'teacher' && user.id !== gradeSection.teacher_id) {
      console.log('❌ [HOMEWORK] Access denied - not authorized to create homework for this grade section');
      return res.status(403).json({ error: 'Not authorized to create homework for this grade section' });
    }

    // PDF file is required for this simplified workflow
    if (!req.file) {
      console.log('❌ [HOMEWORK] PDF file is required but not provided');
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Parse subjects JSON if it's a string
    let subjectsArray = subjects;
    if (typeof subjects === 'string') {
      try {
        subjectsArray = JSON.parse(subjects);
        console.log('   📚 Parsed subjects:', subjectsArray);
      } catch (e) {
        console.log('❌ [HOMEWORK] Invalid subjects format');
        return res.status(400).json({ error: 'Invalid subjects format' });
      }
    }

    // Handle PDF file upload
    let pdfFileId = null;
    try {
      console.log('   📤 Uploading PDF file...');
      const uploadRes = await cdnStorage.uploadFile(req.file, {
        userId: user.id,
        folder: `homework/${grade_section_id}`,
        relatedTable: 'homework_announcements',
      });
      pdfFileId = uploadRes.file.id;
      console.log('✅ [HOMEWORK] PDF uploaded successfully, file ID:', pdfFileId);
    } catch (uploadErr) {
      console.error('❌ [HOMEWORK] PDF upload failed:', uploadErr);
      return res.status(500).json({ error: 'Failed to upload PDF file' });
    }

    console.log('   📝 Creating homework announcement with data:', {
      grade_section_id,
      teacher_id: user.id,
      title,
      content,
      homework_date: new Date(homework_date).toISOString().split('T')[0],
      subjects: subjectsArray,
      pdf_file_id: pdfFileId,
      is_published: is_published === 'true' || is_published === true
    });

    const { data: newHomework, error } = await supabase
      .from('homework_announcements')
      .insert({
        grade_section_id,
        teacher_id: user.id,
        title,
        content,
        homework_date: new Date(homework_date).toISOString().split('T')[0],
        subjects: subjectsArray,
        pdf_file_id: pdfFileId,
        is_published: is_published === 'true' || is_published === true
      })
      .select(`
        *,
        teacher:users!homework_announcements_teacher_id_fkey(id, first_name, last_name, email),
        pdf_file:file_uploads!homework_announcements_pdf_file_id_fkey(id, filename, cdn_url)
      `)
      .single();

    if (error) {
      console.error('❌ [HOMEWORK] Error creating homework:', error);
      return res.status(500).json({ error: 'Failed to create homework' });
    }

    console.log('✅ [HOMEWORK] Homework created successfully');
    console.log('   📊 New homework:', JSON.stringify(newHomework, null, 2));

    res.status(201).json({ success: true, homework: newHomework });
  } catch (error) {
    console.error('❌ [HOMEWORK] Error creating homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/homework/:id
// Get a specific homework announcement
router.get('/:id', authenticateToken, async (req, res) => {
  console.log('🔍 [HOMEWORK] GET /:id - Fetching specific homework');
  console.log('   🆔 Homework ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: homework, error } = await supabase
      .from('homework_announcements')
      .select(`
        *,
        teacher:users!homework_announcements_teacher_id_fkey(id, first_name, last_name, email),
        pdf_file:file_uploads!homework_announcements_pdf_file_id_fkey(id, filename, cdn_url),
        grade_section:grade_sections(id, name, teacher_id)
      `)
      .eq('id', id)
      .single();

    if (error || !homework) {
      console.log('❌ [HOMEWORK] Homework not found:', id);
      console.log('   🔍 Error details:', error);
      return res.status(404).json({ error: 'Homework not found' });
    }

    console.log('✅ [HOMEWORK] Homework found:', homework.title);
    console.log('   📊 Homework data:', JSON.stringify(homework, null, 2));

    // Check access permissions
    if (user.role !== 'admin' && user.id !== homework.teacher_id) {
      if (user.role === 'student') {
        console.log('   👨‍🎓 Checking student enrollment...');
        // Check if student is enrolled in the grade section
        const { data: enrollment, error: enrollError } = await supabase
          .from('grade_section_enrollments')
          .select('*')
          .eq('grade_section_id', homework.grade_section_id)
          .eq('student_id', user.id)
          .eq('status', 'active')
          .single();

        if (enrollError || !enrollment) {
          console.log('❌ [HOMEWORK] Student not enrolled in this grade section');
          return res.status(403).json({ error: 'Not enrolled in this grade section' });
        }
        console.log('✅ [HOMEWORK] Student enrollment verified');
      } else {
        console.log('❌ [HOMEWORK] Access denied - not authorized to view this homework');
        return res.status(403).json({ error: 'Not authorized to view this homework' });
      }
    }

    res.json({ success: true, homework });
  } catch (error) {
    console.error('❌ [HOMEWORK] Error fetching homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/homework/:id
// Update a homework announcement (Teacher/Admin)
router.put('/:id', [
  authenticateToken,
  [
    body('title').optional().isLength({ min: 2, max: 255 }).withMessage('Title must be between 2 and 255 characters'),
    body('content').optional().isLength({ max: 1000 }).withMessage('Content must be less than 1000 characters'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array if provided'),
    body('is_published').optional().isBoolean().withMessage('is_published must be a boolean')
  ]
], async (req, res) => {
  console.log('🔍 [HOMEWORK] PUT /:id - Updating homework announcement');
  console.log('   🆔 Homework ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [HOMEWORK] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    // Check if homework exists and user has access
    const { data: existingHomework, error: fetchError } = await supabase
      .from('homework_announcements')
      .select('teacher_id, grade_section_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingHomework) {
      console.log('❌ [HOMEWORK] Homework not found:', id);
      return res.status(404).json({ error: 'Homework not found' });
    }

    console.log('   📊 Existing homework teacher_id:', existingHomework.teacher_id);

    // Check permissions
    if (user.role !== 'admin' && user.id !== existingHomework.teacher_id) {
      console.log('❌ [HOMEWORK] Access denied - not admin or assigned teacher');
      return res.status(403).json({ error: 'Not authorized to update this homework' });
    }

    const updateData = { ...req.body };
    console.log('   🔄 Update data:', JSON.stringify(updateData, null, 2));

    const { data: updatedHomework, error } = await supabase
      .from('homework_announcements')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        teacher:users!homework_announcements_teacher_id_fkey(id, first_name, last_name, email),
        pdf_file:file_uploads!homework_announcements_pdf_file_id_fkey(id, filename, cdn_url)
      `)
      .single();

    if (error) {
      console.error('❌ [HOMEWORK] Error updating homework:', error);
      return res.status(500).json({ error: 'Failed to update homework' });
    }

    console.log('✅ [HOMEWORK] Homework updated successfully');
    console.log('   📊 Updated homework:', JSON.stringify(updatedHomework, null, 2));

    res.json({ success: true, homework: updatedHomework });
  } catch (error) {
    console.error('❌ [HOMEWORK] Error updating homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/homework/:id
// Delete a homework announcement
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log('🔍 [HOMEWORK] DELETE /:id - Deleting homework announcement');
  console.log('   🆔 Homework ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    // Check if homework exists and user has access
    const { data: existingHomework, error: fetchError } = await supabase
      .from('homework_announcements')
      .select('teacher_id, pdf_file_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingHomework) {
      console.log('❌ [HOMEWORK] Homework not found:', id);
      return res.status(404).json({ error: 'Homework not found' });
    }

    console.log('   📊 Existing homework teacher_id:', existingHomework.teacher_id);
    console.log('   📄 PDF file ID:', existingHomework.pdf_file_id);

    // Check permissions
    if (user.role !== 'admin' && user.id !== existingHomework.teacher_id) {
      console.log('❌ [HOMEWORK] Access denied - not admin or assigned teacher');
      return res.status(403).json({ error: 'Not authorized to delete this homework' });
    }

    // Delete the homework (PDF file will be deleted via cascade)
    const { error } = await supabase
      .from('homework_announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [HOMEWORK] Error deleting homework:', error);
      return res.status(500).json({ error: 'Failed to delete homework' });
    }

    console.log('✅ [HOMEWORK] Homework deleted successfully');

    res.json({ success: true, message: 'Homework deleted successfully' });
  } catch (error) {
    console.error('❌ [HOMEWORK] Error deleting homework:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 