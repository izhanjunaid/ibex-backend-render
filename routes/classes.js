const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../lib/supabase');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  // Use the admin client for all class operations to bypass RLS for now
  // This simplifies permissions for admins creating/managing classes
  req.supabase = supabaseAdmin;
  next();
});

// Use proper auth middleware
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/classes
// @desc    Get all classes for user (role-based)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    let query = supabase
      .from('classes')
      .select(`
        *,
        teacher:users!teacher_id(id, first_name, last_name, email)
      `);

    // Role-based filtering
    if (req.user.role === 'student') {
      // Students only see classes they're enrolled in
      const { data: enrollments, error: enrollErr } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', req.user.id)
        .eq('status', 'active');

      if (enrollErr) {
        console.error('Error fetching enrollments:', enrollErr);
        return res.status(500).json({ error: 'Failed to fetch classes' });
      }

      const classIds = enrollments.map((e) => e.class_id);
      if (classIds.length === 0) {
        return res.json([]); // student not in any classes
      }

      query = query.in('id', classIds);
    } else if (req.user.role === 'teacher') {
      // Teachers see classes they teach
      query = query.eq('teacher_id', req.user.id);
    }
    // Admins see all classes (no additional filter)

    const { data: classes, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching classes:', error);
      return res.status(500).json({ error: 'Failed to fetch classes' });
    }

    // Enrich each class with students and assignments arrays (for counts)
    const enriched = await Promise.all((classes || []).map(async (cls) => {
      const [{ data: studentRows }, { data: assignmentRows }] = await Promise.all([
        supabase
          .from('class_enrollments')
          .select('student_id')
          .eq('class_id', cls.id)
          .eq('status', 'active'),
        supabase
          .from('assignments')
          .select('id')
          .eq('class_id', cls.id),
      ]);

      return {
        ...cls,
        classCode: cls.code,
        students: studentRows || [],
        assignments: assignmentRows || [],
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// @route   GET /api/classes/:id
// @desc    Get class by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { id } = req.params;

    // Fetch class with teacher info
    const { data: classData, error } = await supabase
      .from('classes')
      .select(`*, teacher:users!teacher_id(id, first_name, last_name, email, profile_image_url)`)
      .eq('id', id)
      .single();

    if (error || !classData) {
      console.error('Error fetching class:', error);
      return res.status(404).json({ error: 'Class not found' });
    }

    // Fetch active enrollments + student info
    const { data: enrollRows, error: enrollErr } = await supabase
      .from('class_enrollments')
      .select(`enrolled_at, student:users!student_id(id, first_name, last_name, email, profile_image_url)`)
      .eq('class_id', id)
      .eq('status', 'active');

    if (enrollErr) {
      console.error('Error fetching students for class:', enrollErr);
      return res.status(500).json({ error: 'Failed to fetch students' });
    }

    // Util: convert snake_case keys to camelCase for frontend consistency
    const toCamel = (str) =>
      str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    const camelize = (obj) =>
      Object.entries(obj).reduce((acc, [key, val]) => {
        acc[toCamel(key)] = val;
        return acc;
      }, {});

    const students = (enrollRows || []).map((row) => {
      const studentCamel = camelize(row.student || {});
      return {
        ...studentCamel,
        _id: studentCamel.id,
        enrollmentDate: row.enrolled_at,
      };
    });

    // Camelize teacher as well
    const teacherCamelRaw = camelize(classData.teacher || {});
    const teacherCamel = {
      ...teacherCamelRaw,
      _id: teacherCamelRaw.id,
    };

    // Build payload with camelCased keys where needed
    const responsePayload = {
      ...classData,
      classCode: classData.code,
      teacher: teacherCamel,
      students,
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// @route   POST /api/classes
// @desc    Create a new class
// @access  Private/Teacher/Admin
router.post('/', [
  authenticateToken,
  [
    body('name').trim().isLength({ min: 2 }).withMessage('Class name must be at least 2 characters'),
    body('subject').trim().isLength({ min: 2 }).withMessage('Subject must be at least 2 characters'),
    body('description').optional().trim()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const supabase = req.supabase;
    const { name, subject, description, grade_level, max_students, teacher_id, room_number, schedule } = req.body;

    // Generate a unique class code
    const generateClassCode = (length = 6) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // For admins, allow assigning to any teacher. For teachers, assign to themselves.
    const assignedTeacherId = req.user.role === 'admin' && teacher_id ? teacher_id : req.user.id;

    const { data: newClass, error } = await supabase
      .from('classes')
      .insert({
        name,
        subject,
        description,
        code: generateClassCode(),
        grade_level: grade_level || 10,
        max_students: max_students || 30,
        teacher_id: assignedTeacherId,
        room_number: room_number || null,
        schedule: schedule || null,
        is_active: true
      })
      .select(`
        *,
        teacher:users!teacher_id(id, first_name, last_name, email)
      `)
      .single();

    if (error) {
      console.error('Error creating class:', error);
      return res.status(500).json({ error: 'Failed to create class' });
    }

    res.status(201).json({
      message: 'Class created successfully',
      class: newClass
    });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// @route   PUT /api/classes/:id
// @desc    Update class
// @access  Private/Teacher/Admin
router.put('/:id', [
  authenticateToken,
  [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Class name must be at least 2 characters'),
    body('subject').optional().trim().isLength({ min: 2 }).withMessage('Subject must be at least 2 characters'),
    body('description').optional().trim()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const supabase = req.supabase;
    const { id } = req.params;
    const { name, subject, description, grade_level, max_students, room_number, schedule } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (subject) updateData.subject = subject;
    if (description !== undefined) updateData.description = description;
    if (grade_level) updateData.grade_level = grade_level;
    if (max_students) updateData.max_students = max_students;
    if (room_number !== undefined) updateData.room_number = room_number;
    if (schedule !== undefined) updateData.schedule = schedule;

    const { data: updatedClass, error } = await supabase
      .from('classes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating class:', error);
      return res.status(500).json({ error: 'Failed to update class' });
    }

    res.json({
      message: 'Class updated successfully',
      class: updatedClass
    });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// @route   DELETE /api/classes/:id
// @desc    Delete class and all related data (comprehensive cleanup)
// @access  Private/Teacher/Admin
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { id: classId } = req.params;

    // Check if user is admin or teacher
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only admins and teachers can delete classes' });
    }

    // Get class details to verify ownership
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name, teacher_id, school_id')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if teacher owns the class (unless admin)
    if (user.role === 'teacher' && classData.teacher_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this class' });
    }

    // Get all files that need to be deleted from storage
    // First, get assignment IDs for this class
    const { data: assignmentIds, error: assignmentError } = await supabase
      .from('assignments')
      .select('id')
      .eq('class_id', classId);

    if (assignmentError) {
      console.error('Error fetching assignment IDs:', assignmentError);
    }

    // Get submission IDs for these assignments
    let submissionIds = [];
    if (assignmentIds && assignmentIds.length > 0) {
      const assignmentIdList = assignmentIds.map(a => a.id);
      const { data: submissions, error: submissionError } = await supabase
        .from('assignment_submissions')
        .select('id')
        .in('assignment_id', assignmentIdList);

      if (submissionError) {
        console.error('Error fetching submission IDs:', submissionError);
      } else {
        submissionIds = submissions.map(s => s.id);
      }
    }

    // Get announcement IDs for this class
    const { data: announcementIds, error: announcementError } = await supabase
      .from('announcements')
      .select('id')
      .contains('class_ids', [classId]);

    if (announcementError) {
      console.error('Error fetching announcement IDs:', announcementError);
    }

    // Now get all files related to these records
    let filesToDelete = [];
    const assignmentIdList = assignmentIds ? assignmentIds.map(a => a.id) : [];
    const announcementIdList = announcementIds ? announcementIds.map(a => a.id) : [];

    if (assignmentIdList.length > 0) {
      const { data: assignmentFiles, error: assignmentFilesError } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('related_table', 'assignments')
        .in('related_id', assignmentIdList);

      if (assignmentFilesError) {
        console.error('Error fetching assignment files:', assignmentFilesError);
      } else {
        filesToDelete = filesToDelete.concat(assignmentFiles || []);
      }
    }

    if (submissionIds.length > 0) {
      const { data: submissionFiles, error: submissionFilesError } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('related_table', 'assignment_submissions')
        .in('related_id', submissionIds);

      if (submissionFilesError) {
        console.error('Error fetching submission files:', submissionFilesError);
      } else {
        filesToDelete = filesToDelete.concat(submissionFiles || []);
      }
    }

    if (announcementIdList.length > 0) {
      const { data: announcementFiles, error: announcementFilesError } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('related_table', 'announcements')
        .in('related_id', announcementIdList);

      if (announcementFilesError) {
        console.error('Error fetching announcement files:', announcementFilesError);
      } else {
        filesToDelete = filesToDelete.concat(announcementFiles || []);
      }
    }

    // Check if the function exists first
    console.log('Checking if delete_class_comprehensive function exists...');
    const { data: functions, error: funcCheckError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_name', 'delete_class_comprehensive');
    
    if (funcCheckError) {
      console.error('Error checking function existence:', funcCheckError);
    } else {
      console.log('Function exists:', functions.length > 0);
    }
    
    // Call the comprehensive deletion function
    console.log('Calling delete_class_comprehensive with:', { p_class_id: classId, p_user_id: user.id });
    
    const { data: result, error: deleteError } = await supabase
      .rpc('delete_class_comprehensive', {
        p_class_id: classId,
        p_user_id: user.id
      });

    if (deleteError) {
      console.error('Error in comprehensive class deletion:', deleteError);
      console.error('Error details:', JSON.stringify(deleteError, null, 2));
      return res.status(500).json({ 
        error: 'Failed to delete class and related data',
        details: deleteError.message || deleteError
      });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Delete files from storage after successful database cleanup
    if (filesToDelete && filesToDelete.length > 0) {
      const cdnStorage = require('../lib/cdn-storage');
      let storageDeletionErrors = [];

      for (const file of filesToDelete) {
        try {
          await cdnStorage.deleteFile(file.file_path, file.storage_provider, file.bucket);
        } catch (storageError) {
          console.error(`Failed to delete file ${file.id} from storage:`, storageError);
          storageDeletionErrors.push({
            file_id: file.id,
            filename: file.filename,
            error: storageError.message
          });
        }
      }

      // Add storage deletion results to response
      if (storageDeletionErrors.length > 0) {
        result.storage_deletion_errors = storageDeletionErrors;
      }
    }

    // Clean up expired files
    try {
      await supabase.rpc('cleanup_expired_files');
    } catch (cleanupError) {
      console.error('Error cleaning up expired files:', cleanupError);
    }

    res.json({
      message: 'Class and all related data deleted successfully',
      details: result.deleted_data,
      storage_cleanup: {
        files_deleted: filesToDelete ? filesToDelete.length : 0,
        errors: result.storage_deletion_errors || []
      }
    });

  } catch (error) {
    console.error('Error in comprehensive class deletion:', error);
    res.status(500).json({ error: 'Failed to delete class and related data' });
  }
});

// @route   POST /api/classes/:id/enroll
// @desc    Enroll students in a class (Admin/Teacher only)
// @access  Private/Admin/Teacher
router.post('/:id/enroll', [
  authenticateToken,
  [
    body('student_ids').isArray().withMessage('Student IDs must be an array'),
    body('student_ids.*').isUUID().withMessage('Each student ID must be a valid UUID')
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const supabase = req.supabase;
    const { id: classId } = req.params;
    const { student_ids } = req.body;

    // Check if class exists
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Verify all students exist and have student role
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', student_ids)
      .eq('role', 'student');

    if (studentsError || students.length !== student_ids.length) {
      return res.status(400).json({ error: 'Some student IDs are invalid' });
    }

    // Create enrollment records
    const enrollments = student_ids.map(student_id => ({
      class_id: classId,
      student_id,
      status: 'active'
    }));

    const { data: newEnrollments, error: enrollError } = await supabase
      .from('class_enrollments')
      .upsert(enrollments, { onConflict: 'class_id,student_id' })
      .select();

    if (enrollError) {
      console.error('Error enrolling students:', enrollError);
      return res.status(500).json({ error: 'Failed to enroll students' });
    }

    res.json({
      message: `${students.length} students enrolled successfully`,
      enrollments: newEnrollments
    });
  } catch (error) {
    console.error('Error enrolling students:', error);
    res.status(500).json({ error: 'Failed to enroll students' });
  }
});

// @route   DELETE /api/classes/:id/enroll/:studentId
// @desc    Remove student from class (Admin/Teacher only)
// @access  Private/Admin/Teacher
router.delete('/:id/enroll/:studentId', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { id: classId, studentId } = req.params;

    const { error } = await supabase
      .from('class_enrollments')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId);

    if (error) {
      console.error('Error removing student:', error);
      return res.status(500).json({ error: 'Failed to remove student' });
    }

    res.json({ message: 'Student removed from class successfully' });
  } catch (error) {
    console.error('Error removing student:', error);
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

// @route   PUT /api/classes/:id/teacher
// @desc    Assign teacher to class (Admin only)
// @access  Private/Admin
router.put('/:id/teacher', [
  authenticateToken,
  [
    body('teacher_id').isUUID().withMessage('Valid teacher ID is required')
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  try {
    const supabase = req.supabase;
    const { id: classId } = req.params;
    const { teacher_id } = req.body;

    // Verify teacher exists and has teacher role
    const { data: teacher, error: teacherError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, profile_image_url')
      .eq('id', teacher_id)
      .eq('role', 'teacher')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Update class with new teacher
    const { data: updatedClass, error } = await supabase
      .from('classes')
      .update({ teacher_id })
      .eq('id', classId)
      .select(`*, teacher:users!teacher_id(id, first_name, last_name, email, profile_image_url)`)
      .single();

    if (error) {
      console.error('Error assigning teacher:', error);
      return res.status(500).json({ error: 'Failed to assign teacher' });
    }

    res.json({
      message: `Teacher ${teacher.first_name} ${teacher.last_name} assigned successfully`,
      class: updatedClass
    });
  } catch (error) {
    console.error('Error assigning teacher:', error);
    res.status(500).json({ error: 'Failed to assign teacher' });
  }
});

// @route   GET /api/classes/:id/students
// @desc    Get students enrolled in a class
// @access  Private
router.get('/:id/students', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { id: classId } = req.params;

    const { data: students, error } = await supabase
      .from('class_enrollments')
      .select(`
        *,
        student:users!student_id(id, first_name, last_name, email, created_at)
      `)
      .eq('class_id', classId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching students:', error);
      return res.status(500).json({ error: 'Failed to fetch students' });
    }

    res.json(students || []);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// @route   GET /api/classes/available-students
// @desc    Get all students not enrolled in a specific class
// @access  Private/Admin/Teacher
router.get('/available-students/:classId', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { classId } = req.params;

    // Get ids of students already enrolled
    const { data: enrollRows, error: enrollErr } = await supabase
      .from('class_enrollments')
      .select('student_id')
      .eq('class_id', classId)
      .eq('status', 'active');

    if (enrollErr) {
      console.error('Error fetching enrollments:', enrollErr);
      return res.status(500).json({ error: 'Failed to fetch available students' });
    }

    const enrolledIds = (enrollRows || []).map((r) => r.student_id);

    let query = supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'student')
      .eq('status', 'active');

    if (enrolledIds.length > 0) {
      query = query.not('id', 'in', `(${enrolledIds.join(',')})`);
    }

    const { data: availableStudents, error } = await query;

    if (error) {
      console.error('Error fetching available students:', error);
      return res.status(500).json({ error: 'Failed to fetch available students' });
    }

    res.json(availableStudents || []);
  } catch (error) {
    console.error('Error fetching available students:', error);
    res.status(500).json({ error: 'Failed to fetch available students' });
  }
});

// @route   GET /api/classes/teachers
// @desc    Get all teachers for class assignment
// @access  Private/Admin
router.get('/teachers', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;

    const { data: teachers, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'teacher')
      .eq('status', 'active')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching teachers:', error);
      return res.status(500).json({ error: 'Failed to fetch teachers' });
    }

    res.json(teachers || []);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// @route   POST /api/classes/join
// @desc    Student joins a class via class code
// @access  Private/Student
router.post('/join', [
  authenticateToken,
  [
    body('classCode')
      .trim()
      .isLength({ min: 4 })
      .withMessage('Valid class code is required'),
  ],
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Only students can self-join classes
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can join classes using a code' });
  }

  try {
    const supabase = req.supabase;
    const { classCode } = req.body;

    // Find the class by code
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('code', classCode)
      .eq('is_active', true)
      .single();

    if (classError || !classData) {
      return res.status(404).json({ error: 'Class not found or inactive' });
    }

    // Check if student already enrolled
    const { data: existingEnrollment, error: enrollLookupErr } = await supabase
      .from('class_enrollments')
      .select('id')
      .eq('class_id', classData.id)
      .eq('student_id', req.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (enrollLookupErr) {
      console.error('Error checking enrollment:', enrollLookupErr);
      return res.status(500).json({ error: 'Failed to check enrollment' });
    }

    if (existingEnrollment) {
      return res.status(400).json({ error: 'You are already enrolled in this class' });
    }

    // Optionally: check capacity
    const { count: currentCount, error: countErr } = await supabase
      .from('class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classData.id)
      .eq('status', 'active');

    if (countErr) {
      console.error('Error counting enrollments:', countErr);
      return res.status(500).json({ error: 'Failed to enroll in class' });
    }

    if (classData.max_students && currentCount >= classData.max_students) {
      return res.status(400).json({ error: 'This class is already full' });
    }

    // Insert enrollment record
    const { data: newEnrollment, error: enrollErr } = await supabase
      .from('class_enrollments')
      .insert({
        class_id: classData.id,
        student_id: req.user.id,
        status: 'active',
      })
      .select()
      .single();

    if (enrollErr) {
      console.error('Error enrolling student:', enrollErr);
      return res.status(500).json({ error: 'Failed to enroll in class' });
    }

    // Fetch full class with teacher details to return
    const { data: classWithTeacher, error: fetchErr } = await supabase
      .from('classes')
      .select(`*, teacher:users!teacher_id(id, first_name, last_name, email, profile_image_url)`)
      .eq('id', classData.id)
      .single();

    if (fetchErr) {
      console.error('Error fetching class after enroll:', fetchErr);
    }

    return res.status(201).json({
      message: 'Enrolled successfully',
      class: classWithTeacher || classData,
      enrollment: newEnrollment,
    });
  } catch (error) {
    console.error('Error joining class:', error);
    return res.status(500).json({ error: 'Failed to join class' });
  }
});

module.exports = router; 