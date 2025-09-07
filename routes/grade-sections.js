const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const { stormEndpointMiddleware, standardEndpointMiddleware, staticEndpointMiddleware, smartCache } = require('../middleware/enhanced-middleware');
const cacheManager = require('../lib/cache');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

// GET /api/grade-sections
// Get all grade sections (role-based)
router.get('/', authenticateToken, async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] GET / - Fetching grade sections');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;
    
    let query = supabase
      .from('grade_sections')
      .select(`
        *,
        teacher:users!grade_sections_teacher_id_fkey(id, first_name, last_name, email),
        school:schools(id, name)
      `)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    console.log('   🎯 Query type:', user.role);

    // Role-based filtering
    if (user.role === 'teacher') {
      console.log('   👨‍🏫 Teacher filtering - teacher_id:', user.id);
      query = query.eq('teacher_id', user.id);
    } else if (user.role === 'student') {
      console.log('   👨‍🎓 Student filtering - fetching enrollments for student_id:', user.id);
      // Students see grade sections they're enrolled in
      const { data: enrollments, error: enrollErr } = await supabase
        .from('grade_section_enrollments')
        .select('grade_section_id')
        .eq('student_id', user.id)
        .eq('status', 'active');

      if (enrollErr) {
        console.error('❌ [GRADE-SECTIONS] Error fetching enrollments:', enrollErr);
        return res.status(500).json({ error: 'Failed to fetch grade sections' });
      }

      console.log('   📚 Enrollments found:', enrollments.length);
      const gradeSectionIds = enrollments.map((e) => e.grade_section_id);
      console.log('   🆔 Grade section IDs:', gradeSectionIds);
      
      if (gradeSectionIds.length === 0) {
        console.log('   ⚠️ No enrollments found, returning empty array');
        return res.json([]);
      }

      query = query.in('id', gradeSectionIds);
    } else {
      console.log('   👑 Admin - fetching all grade sections');
    }
    // Admins see all grade sections

    const { data: gradeSections, error } = await query;

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error fetching grade sections:', error);
      return res.status(500).json({ error: 'Failed to fetch grade sections' });
    }

    console.log('✅ [GRADE-SECTIONS] Successfully fetched', gradeSections?.length || 0, 'grade sections');
    console.log('   📊 Response data:', JSON.stringify(gradeSections, null, 2));

    res.json(gradeSections || []);
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error in grade sections route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grade-sections/overview
// Get grade sections overview with today's attendance stats
router.get('/overview', 
  ...stormEndpointMiddleware,
  authenticateToken, 
  smartCache({ ttl: 60, varyByUser: true, varyByDate: true }),
  async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] GET /overview - Fetching grade sections overview');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;
    const today = new Date().toISOString().split('T')[0];

    console.log('   📅 Getting overview for date:', today);

    // Get grade sections with today's attendance stats using optimized function
    const { data: overviewData, error } = await supabase
      .rpc('get_grade_sections_overview', {
        p_user_id: user.id,
        p_user_role: user.role,
        p_date: today
      });

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error fetching overview:', error);
      return res.status(500).json({ error: 'Failed to fetch grade sections overview' });
    }

    // Transform to your exact required format
    const rows = (overviewData || []).map(item => [
      item.id,
      item.name,
      item.total_students || 0,
      item.present_count || 0,
      item.absent_count || 0,
      item.late_count || 0,
      item.excused_count || 0,
      item.unmarked_count || 0
    ]);

    console.log('✅ [GRADE-SECTIONS] Successfully fetched overview for', rows.length, 'grade sections');
    
    res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    res.json({
      date: today,
      fields: ["id", "name", "student_count", "present", "absent", "late", "excused", "unmarked"],
      rows: rows
    });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error in overview route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grade-sections/available-teachers
// Get all teachers available for assignment (MUST be before /:id route)
router.get('/available-teachers', 
  ...staticEndpointMiddleware,
  authenticateToken, 
  async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] GET /available-teachers - Fetching available teachers');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;

    // Only admins can view available teachers
    if (user.role !== 'admin') {
      console.log('❌ [GRADE-SECTIONS] Access denied - not admin');
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Get all active teachers
    const { data: teachers, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'teacher')
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error fetching teachers:', error);
      return res.status(500).json({ error: 'Failed to fetch teachers' });
    }

    console.log('✅ [GRADE-SECTIONS] Successfully fetched', teachers?.length || 0, 'teachers');

    res.json({
      success: true,
      teachers: teachers || []
    });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error fetching available teachers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grade-sections/:id
// Get a specific grade section
router.get('/:id', authenticateToken, async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] GET /:id - Fetching specific grade section');
  console.log('   🆔 Grade section ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: gradeSection, error } = await supabase
      .from('grade_sections')
      .select(`
        *,
        teacher:users!grade_sections_teacher_id_fkey(id, first_name, last_name, email),
        school:schools(id, name)
      `)
      .eq('id', id)
      .single();

    if (error || !gradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', id);
      console.log('   🔍 Error details:', error);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('✅ [GRADE-SECTIONS] Grade section found:', gradeSection.name);
    console.log('   📊 Grade section data:', JSON.stringify(gradeSection, null, 2));

    // Check access permissions
    if (user.role !== 'admin' && user.id !== gradeSection.teacher_id) {
      if (user.role === 'student') {
        console.log('   👨‍🎓 Checking student enrollment...');
        // Check if student is enrolled
        const { data: enrollment, error: enrollError } = await supabase
          .from('grade_section_enrollments')
          .select('*')
          .eq('grade_section_id', id)
          .eq('student_id', user.id)
          .eq('status', 'active')
          .single();

        if (enrollError || !enrollment) {
          console.log('❌ [GRADE-SECTIONS] Student not enrolled in grade section');
          return res.status(403).json({ error: 'Not enrolled in this grade section' });
        }
        console.log('✅ [GRADE-SECTIONS] Student enrollment verified');
      } else {
        console.log('❌ [GRADE-SECTIONS] Access denied - not admin or teacher');
        return res.status(403).json({ error: 'Not authorized to view this grade section' });
      }
    }

    res.json(gradeSection);
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error fetching grade section:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/grade-sections
// Create a new grade section (Admin only)
router.post('/', [
  authenticateToken,
  [
    body('school_id').optional().isUUID().withMessage('School ID must be a valid UUID if provided'),
    body('grade_level').isInt({ min: 1, max: 12 }).withMessage('Grade level must be between 1 and 12'),
    body('section').isLength({ min: 1, max: 10 }).withMessage('Section must be between 1 and 10 characters'),
    body('name').isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('teacher_id').isUUID().withMessage('Valid teacher ID is required'),
    body('academic_year').isLength({ min: 4, max: 20 }).withMessage('Academic year must be between 4 and 20 characters')
  ]
], async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] POST / - Creating new grade section');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [GRADE-SECTIONS] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const supabase = req.supabase;

    if (user.role !== 'admin') {
      console.log('❌ [GRADE-SECTIONS] Access denied - only admins can create grade sections');
      return res.status(403).json({ error: 'Only admins can create grade sections' });
    }

    const {
      school_id,
      grade_level,
      section,
      name,
      description,
      teacher_id,
      academic_year
    } = req.body;

    console.log('   🏫 Creating grade section with data:', {
      school_id,
      grade_level,
      section,
      name,
      description,
      teacher_id,
      academic_year
    });

    // Verify teacher exists and has teacher role
    const { data: teacher, error: teacherError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', teacher_id)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      console.log('❌ [GRADE-SECTIONS] Invalid teacher ID:', teacher_id);
      return res.status(400).json({ error: 'Invalid teacher ID - teacher not found or not a teacher' });
    }

    console.log('✅ [GRADE-SECTIONS] Teacher verified:', teacher.id);

    const { data: newGradeSection, error } = await supabase
      .from('grade_sections')
      .insert({
        school_id: school_id || null, // Allow null if not provided
        grade_level,
        section,
        name,
        description,
        teacher_id,
        academic_year
      })
      .select(`
        *,
        teacher:users!grade_sections_teacher_id_fkey(id, first_name, last_name, email),
        school:schools(id, name)
      `)
      .single();

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error creating grade section:', error);
      return res.status(500).json({ error: 'Failed to create grade section' });
    }

    console.log('✅ [GRADE-SECTIONS] Grade section created successfully');
    console.log('   📊 New grade section:', JSON.stringify(newGradeSection, null, 2));

    res.status(201).json({ success: true, gradeSection: newGradeSection });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error creating grade section:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/grade-sections/:id
// Update a grade section
router.put('/:id', [
  authenticateToken,
  [
    body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('teacher_id').optional().isUUID().withMessage('Valid teacher ID is required'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ]
], async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] PUT /:id - Updating grade section');
  console.log('   🆔 Grade section ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [GRADE-SECTIONS] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    // Check if grade section exists
    const { data: existingGradeSection, error: fetchError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingGradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', id);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Existing grade section teacher_id:', existingGradeSection.teacher_id);

    // Check permissions
    if (user.role !== 'admin' && user.id !== existingGradeSection.teacher_id) {
      console.log('❌ [GRADE-SECTIONS] Access denied - not admin or assigned teacher');
      return res.status(403).json({ error: 'Not authorized to update this grade section' });
    }

    const updateData = { ...req.body };
    console.log('   🔄 Update data:', JSON.stringify(updateData, null, 2));

    const { data: updatedGradeSection, error } = await supabase
      .from('grade_sections')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        teacher:users!grade_sections_teacher_id_fkey(id, first_name, last_name, email),
        school:schools(id, name)
      `)
      .single();

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error updating grade section:', error);
      return res.status(500).json({ error: 'Failed to update grade section' });
    }

    console.log('✅ [GRADE-SECTIONS] Grade section updated successfully');
    console.log('   📊 Updated grade section:', JSON.stringify(updatedGradeSection, null, 2));

    res.json({ success: true, gradeSection: updatedGradeSection });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error updating grade section:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/grade-sections/:id
// Delete a grade section
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] DELETE /:id - Deleting grade section');
  console.log('   🆔 Grade section ID:', req.params.id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { id } = req.params;
    const supabase = req.supabase;

    if (user.role !== 'admin') {
      console.log('❌ [GRADE-SECTIONS] Access denied - only admins can delete grade sections');
      return res.status(403).json({ error: 'Only admins can delete grade sections' });
    }

    // Check if grade section exists
    const { data: existingGradeSection, error: fetchError } = await supabase
      .from('grade_sections')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingGradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', id);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section to delete:', JSON.stringify(existingGradeSection, null, 2));

    const { error } = await supabase
      .from('grade_sections')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error deleting grade section:', error);
      return res.status(500).json({ error: 'Failed to delete grade section' });
    }

    console.log('✅ [GRADE-SECTIONS] Grade section deleted successfully');

    res.json({ success: true, message: 'Grade section deleted successfully' });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error deleting grade section:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/grade-sections/:gradeSectionId/enroll
// Enroll students in a grade section
router.post('/:gradeSectionId/enroll', [
  authenticateToken,
  [
    body('studentIds').isArray({ min: 1 }).withMessage('At least one student ID is required'),
    body('studentIds.*').isUUID().withMessage('All student IDs must be valid UUIDs')
  ]
], async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] POST /:gradeSectionId/enroll - Enrolling students');
  console.log('   🆔 Grade section ID:', req.params.gradeSectionId);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [GRADE-SECTIONS] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const { gradeSectionId } = req.params;
    const { studentIds } = req.body;
    const supabase = req.supabase;

    console.log('   👨‍🎓 Student IDs to enroll:', studentIds);

    // Verify grade section exists and user has access
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', gradeSectionId)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', gradeSectionId);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section teacher_id:', gradeSection.teacher_id);

    if (user.role === 'teacher' && user.id !== gradeSection.teacher_id) {
      console.log('❌ [GRADE-SECTIONS] Access denied - not the assigned teacher');
      return res.status(403).json({ error: 'Not authorized to enroll students in this grade section' });
    }

    if (user.role === 'student') {
      console.log('❌ [GRADE-SECTIONS] Access denied - students cannot enroll others');
      return res.status(403).json({ error: 'Students cannot enroll other students' });
    }

    // Check if students exist and are actually students
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role')
      .in('id', studentIds)
      .eq('role', 'student');

    if (studentsError) {
      console.error('❌ [GRADE-SECTIONS] Error fetching students:', studentsError);
      return res.status(500).json({ error: 'Failed to verify students' });
    }

    console.log('   👨‍🎓 Valid students found:', students.length);
    console.log('   📊 Students data:', JSON.stringify(students, null, 2));

    if (students.length !== studentIds.length) {
      console.log('❌ [GRADE-SECTIONS] Some students not found or not students');
      return res.status(400).json({ error: 'Some students not found or not students' });
    }

    // Enroll students
    const enrollments = studentIds.map(studentId => ({
      grade_section_id: gradeSectionId,
      student_id: studentId,
      status: 'active'
    }));

    console.log('   📝 Enrollments to create:', JSON.stringify(enrollments, null, 2));

    const { data: newEnrollments, error: enrollmentError } = await supabase
      .from('grade_section_enrollments')
      .insert(enrollments)
      .select('*');

    if (enrollmentError) {
      console.error('❌ [GRADE-SECTIONS] Error creating enrollments:', enrollmentError);
      return res.status(500).json({ error: 'Failed to enroll students' });
    }

    console.log('✅ [GRADE-SECTIONS] Students enrolled successfully');
    console.log('   📊 New enrollments:', JSON.stringify(newEnrollments, null, 2));

    res.json({
      success: true,
      message: 'Students enrolled successfully',
      enrolledCount: newEnrollments.length
    });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error enrolling students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/grade-sections/:gradeSectionId/students
// Get enrolled students for a grade section
router.get('/:gradeSectionId/students', authenticateToken, async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] GET /:gradeSectionId/students - Fetching enrolled students');
  console.log('   🆔 Grade section ID:', req.params.gradeSectionId);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { gradeSectionId } = req.params;
    const supabase = req.supabase;

    // Verify grade section exists and user has access
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', gradeSectionId)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', gradeSectionId);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section teacher_id:', gradeSection.teacher_id);

    if (user.role === 'teacher' && user.id !== gradeSection.teacher_id) {
      console.log('❌ [GRADE-SECTIONS] Access denied - not the assigned teacher');
      return res.status(403).json({ error: 'Not authorized to view students in this grade section' });
    }

    // Get enrolled students using the function
    const { data: students, error } = await supabase
      .rpc('get_grade_section_students', {
        grade_section_uuid: gradeSectionId
      });

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error fetching students:', error);
      return res.status(500).json({ error: 'Failed to fetch students' });
    }

    console.log('✅ [GRADE-SECTIONS] Students fetched successfully');
    console.log('   📊 Students data:', JSON.stringify(students, null, 2));

    res.json({ success: true, students: students || [] });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/grade-sections/:gradeSectionId/enroll/:studentId
// Remove a student from a grade section
router.delete('/:gradeSectionId/enroll/:studentId', authenticateToken, async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] DELETE /:gradeSectionId/enroll/:studentId - Removing student');
  console.log('   🆔 Grade section ID:', req.params.gradeSectionId);
  console.log('   👨‍🎓 Student ID:', req.params.studentId);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { gradeSectionId, studentId } = req.params;
    const supabase = req.supabase;

    // Verify grade section exists and user has access
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('teacher_id')
      .eq('id', gradeSectionId)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', gradeSectionId);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Grade section teacher_id:', gradeSection.teacher_id);

    if (user.role === 'teacher' && user.id !== gradeSection.teacher_id) {
      console.log('❌ [GRADE-SECTIONS] Access denied - not the assigned teacher');
      return res.status(403).json({ error: 'Not authorized to remove students from this grade section' });
    }

    if (user.role === 'student') {
      console.log('❌ [GRADE-SECTIONS] Access denied - students cannot remove others');
      return res.status(403).json({ error: 'Students cannot remove other students' });
    }

    // Remove the enrollment
    const { error } = await supabase
      .from('grade_section_enrollments')
      .delete()
      .eq('grade_section_id', gradeSectionId)
      .eq('student_id', studentId);

    if (error) {
      console.error('❌ [GRADE-SECTIONS] Error removing student:', error);
      return res.status(500).json({ error: 'Failed to remove student' });
    }

    console.log('✅ [GRADE-SECTIONS] Student removed successfully');

    res.json({ success: true, message: 'Student removed from grade section' });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error removing student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/grade-sections/students/batch
// Get students for multiple grade sections efficiently
// Body: { ids: [gradeSectionId1, gradeSectionId2, ...] }
// Returns: { [gradeSectionId]: [{studentId, firstName, lastName, ...}] }
router.post('/students/batch', 
  ...stormEndpointMiddleware,
  authenticateToken,
  [
    body('ids').isArray({ min: 1 }).withMessage('At least one grade section ID is required'),
    body('ids.*').isUUID().withMessage('All grade section IDs must be valid UUIDs')
  ],
  async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] POST /students/batch - Fetching students for multiple grade sections');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [GRADE-SECTIONS] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const { ids } = req.body;
    const supabase = req.supabase;

    console.log('   🆔 Grade section IDs to fetch:', ids);

    // Check access permissions for each grade section
    let accessibleIds = ids;
    if (user.role === 'teacher') {
      const { data: teacherSections, error: accessError } = await supabase
        .from('grade_sections')
        .select('id')
        .eq('teacher_id', user.id)
        .in('id', ids);

      if (accessError) {
        console.error('❌ [GRADE-SECTIONS] Error checking teacher access:', accessError);
        return res.status(500).json({ error: 'Failed to verify access' });
      }

      accessibleIds = teacherSections.map(section => section.id);
      console.log('   👨‍🏫 Teacher accessible sections:', accessibleIds);
    } else if (user.role === 'student') {
      // Students can only see their own enrolled sections
      const { data: enrollments, error: enrollError } = await supabase
        .from('grade_section_enrollments')
        .select('grade_section_id')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .in('grade_section_id', ids);

      if (enrollError) {
        console.error('❌ [GRADE-SECTIONS] Error checking student enrollments:', enrollError);
        return res.status(500).json({ error: 'Failed to verify enrollments' });
      }

      accessibleIds = enrollments.map(enrollment => enrollment.grade_section_id);
      console.log('   👨‍🎓 Student accessible sections:', accessibleIds);
    }

    if (accessibleIds.length === 0) {
      console.log('⚠️ [GRADE-SECTIONS] No accessible grade sections found');
      res.set('Cache-Control', 'public, max-age=60'); // Cache empty results
      return res.json({ students: {} });
    }

    // Get students for all accessible sections using existing function
    const students = {};
    
    // Fetch students for each grade section individually (temporary fix until batch function is available)
    for (const gradeSectionId of accessibleIds) {
      try {
        const { data: sectionStudents, error: sectionError } = await supabase
          .rpc('get_grade_section_students', {
            grade_section_uuid: gradeSectionId
          });

        if (sectionError) {
          console.error('❌ [GRADE-SECTIONS] Error fetching students for section:', gradeSectionId, sectionError);
          continue; // Skip this section but continue with others
        }

        if (sectionStudents && sectionStudents.length > 0) {
          students[gradeSectionId] = sectionStudents.map(student => ({
            id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            status: 'active'
          }));
        }
      } catch (err) {
        console.error('❌ [GRADE-SECTIONS] Exception fetching students for section:', gradeSectionId, err);
        continue;
      }
    }

    console.log('✅ [GRADE-SECTIONS] Successfully fetched students for', Object.keys(students).length, 'grade sections');
    
    res.set('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
    res.json({
      students: students
    });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error in batch students route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/grade-sections/:gradeSectionId/assign-teacher
// Assign or update teacher for a grade section
router.put('/:gradeSectionId/assign-teacher', [
  authenticateToken,
  [
    body('teacher_id')
      .optional({ nullable: true })
      .isUUID()
      .withMessage('teacher_id must be a valid UUID or null')
  ]
], async (req, res) => {
  console.log('🔍 [GRADE-SECTIONS] PUT /:gradeSectionId/assign-teacher - Assigning teacher');
  console.log('   🆔 Grade section ID:', req.params.gradeSectionId);
  console.log('   👨‍🏫 Teacher ID:', req.body.teacher_id);
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ [GRADE-SECTIONS] Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { user } = req;
    const { gradeSectionId } = req.params;
    const { teacher_id } = req.body;
    const supabase = req.supabase;

    // Only admins can assign teachers
    if (user.role !== 'admin') {
      console.log('❌ [GRADE-SECTIONS] Access denied - not admin');
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Verify grade section exists
    const { data: gradeSection, error: gradeSectionError } = await supabase
      .from('grade_sections')
      .select('id, name, teacher_id')
      .eq('id', gradeSectionId)
      .single();

    if (gradeSectionError || !gradeSection) {
      console.log('❌ [GRADE-SECTIONS] Grade section not found:', gradeSectionId);
      return res.status(404).json({ error: 'Grade section not found' });
    }

    console.log('   📊 Current grade section:', JSON.stringify(gradeSection, null, 2));

    // If teacher_id is provided, verify the teacher exists and is actually a teacher
    let teacherInfo = null;
    if (teacher_id) {
      const { data: teacher, error: teacherError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('id', teacher_id)
        .eq('role', 'teacher')
        .single();

      if (teacherError || !teacher) {
        console.log('❌ [GRADE-SECTIONS] Teacher not found or not a teacher:', teacher_id);
        return res.status(400).json({ error: 'Teacher not found or user is not a teacher' });
      }

      teacherInfo = teacher;
      console.log('   👨‍🏫 Teacher info:', JSON.stringify(teacherInfo, null, 2));
    }

    // Update the grade section with the new teacher
    const { data: updatedSection, error: updateError } = await supabase
      .from('grade_sections')
      .update({ 
        teacher_id: teacher_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', gradeSectionId)
      .select(`
        *,
        teacher:users!grade_sections_teacher_id_fkey(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('❌ [GRADE-SECTIONS] Error updating teacher assignment:', updateError);
      return res.status(500).json({ error: 'Failed to assign teacher' });
    }

    console.log('✅ [GRADE-SECTIONS] Teacher assignment updated successfully');
    console.log('   📊 Updated section:', JSON.stringify(updatedSection, null, 2));

    const message = teacher_id 
      ? `Teacher ${teacherInfo.first_name} ${teacherInfo.last_name} assigned to ${gradeSection.name}`
      : `Teacher removed from ${gradeSection.name}`;

    res.json({
      success: true,
      message,
      grade_section: updatedSection
    });
  } catch (error) {
    console.error('❌ [GRADE-SECTIONS] Error assigning teacher:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 