const express = require('express');
const multer = require('multer');
const router = express.Router();

// Utilities & middleware
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const cdnStorage = require('../lib/cdn-storage');

// Multer config – keep in memory (uploaded to CDN storage afterwards)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 209715200, // 200 MB default
    files: 5,
  },
});

// Inject supabase admin client so we bypass RLS but still respect our own checks
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

/**
 * GET /api/assignments/class/:classId
 * Return assignments for a given class, newest first
 */
router.get('/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { user } = req;
    const supabase = req.supabase;

    // Quick access check → allow admin, teacher of the class or enrolled students
    const { data: classRow, error: classErr } = await supabase
      .from('classes')
      .select('teacher_id, school_id')
      .eq('id', classId)
      .single();

    if (classErr || !classRow) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (
      user.role !== 'admin' &&
      user.id !== classRow.teacher_id
    ) {
      // Check enrollment for students
      if (user.role === 'student') {
        const { count, error: enrollErr } = await supabase
          .from('class_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', classId)
          .eq('student_id', user.id);
        if (enrollErr || !count) {
          return res.status(403).json({ error: 'Not enrolled in this class' });
        }
      } else if (user.role === 'teacher') {
        return res.status(403).json({ error: 'Not authorized for this class' });
      }
    }

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(
        `*,
         class:classes(id, name, subject)
      `
      )
      .eq('class_id', classId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch assignments error:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    res.json(assignments || []);
  } catch (err) {
    console.error('Assignments GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/assignments
 * Create a new assignment. Teacher/Admin only.
 */
router.post('/', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;

    // Only teachers & admins
    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers or admins can create assignments' });
    }

    // Multipart/form-data fields are available via req.body
    const {
      title,
      description,
      instructions,
      classId,
      dueDate,
      totalPoints = 100,
      type = 'individual',
      allowLateSubmission = true,
      gradingRubric,
    } = req.body;

    console.log('🔔 Incoming assignment create:', {
      user: { id: user.id, role: user.role },
      title,
      classId,
      dueDate,
      totalPoints,
      files: (req.files || []).map(f => `${f.originalname} (${f.mimetype}, ${f.size} bytes)`)
    });

    if (!title || !description || !classId || !dueDate) {
      return res.status(400).json({ error: 'Title, description, classId and dueDate are required' });
    }

    // Verify the class exists & teacher owns it (if teacher role)
    const { data: classRow, error: classErr } = await supabase
      .from('classes')
      .select('id, teacher_id, school_id')
      .eq('id', classId)
      .single();

    if (classErr || !classRow) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (user.role === 'teacher' && classRow.teacher_id !== user.id) {
      return res.status(403).json({ error: 'You are not the teacher of this class' });
    }

    // Handle attachment uploads if any
    const attachmentsMeta = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const uploadRes = await cdnStorage.uploadFile(file, {
            userId: user.id,
            folder: `assignments/${classId}`,
            relatedTable: 'assignments',
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

    console.log('📎 Attachments meta prepared:', attachmentsMeta);

    // Insert assignment
    const { data: assignment, error: insertErr } = await supabase
      .from('assignments')
      .insert({
        class_id: classId,
        teacher_id: user.id,
        title,
        description,
        instructions,
        due_date: new Date(dueDate).toISOString(),
        total_points: parseInt(totalPoints, 10),
        status: 'published',
        attachments: attachmentsMeta,
        rubric: (() => {
          if (!gradingRubric) return null;
          try {
            return JSON.parse(gradingRubric);
          } catch (e) {
            console.warn('Invalid gradingRubric JSON – storing as null');
            return null;
          }
        })(),
      })
      .select(
        `*,
         class:classes(id, name, subject)
      `
      )
      .single();

    if (insertErr) {
      console.error('Create assignment error:', insertErr);
      return res.status(500).json({ error: 'Failed to create assignment' });
    }

    console.log('✅ Assignment inserted with id:', assignment.id);

    // Real-time updates removed - Socket.IO disabled

    res.status(201).json({ assignment });
  } catch (err) {
    console.error('Assignments POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/assignments
 * Return assignments list based on user role
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;

    let query = supabase
      .from('assignments')
      .select(`*, class:classes(id, name, subject)`)
      .order('created_at', { ascending: false });

    if (user.role === 'teacher') {
      query = query.eq('teacher_id', user.id);
    } else if (user.role === 'student') {
      // Get classes the student is enrolled in
      const { data: enrollRows, error: enrollErr } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id);

      if (enrollErr) {
        console.error('Enrollment fetch error:', enrollErr);
        return res.status(500).json({ error: 'Failed to fetch enrollments' });
      }

      const classIds = (enrollRows || []).map((e) => e.class_id);
      if (classIds.length === 0) {
        return res.json([]); // No classes, return empty array
      }
      query = query.in('class_id', classIds);
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error('Get assignments error:', error);
      return res.status(500).json({ error: 'Failed to fetch assignments' });
    }

    res.json(assignments || []);
  } catch (err) {
    console.error('Assignments list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/assignments/:id
 * Fetch a single assignment with class & teacher info. Access restricted to:
 *   – Admins (all)
 *   – The teacher who owns the assignment
 *   – Students enrolled in the class
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { id } = req.params;

    // Fetch assignment row with related class & teacher
    const { data: assignment, error } = await supabase
      .from('assignments')
      .select(`*,
        class:classes(id, name, subject, teacher_id),
        teacher:users(id, first_name, last_name, email, profile_image_url)`)
      .eq('id', id)
      .single();

    if (error || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Access control
    if (user.role !== 'admin') {
      // Teacher can view their own assignment
      if (user.role === 'teacher' && assignment.teacher_id !== user.id && assignment.teacher?.id !== user.id) {
        return res.status(403).json({ error: 'Not authorized for this assignment' });
      }

      if (user.role === 'student') {
        // Check enrollment
        const { count, error: enrollErr } = await supabase
          .from('class_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', assignment.class_id || assignment.class?.id)
          .eq('student_id', user.id);

        if (enrollErr || !count) {
          return res.status(403).json({ error: 'Not enrolled in this class' });
        }
      }
    }

    // If the requester is a student, include their submission if exists
    if (user.role === 'student') {
      const { data: submissionRow } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignment.id)
        .eq('student_id', user.id)
        .single();

      if (submissionRow) {
        assignment.userSubmission = submissionRow;
        assignment.submitted = true;
      } else {
        assignment.userSubmission = null;
        assignment.submitted = false;
      }
    }

    // If the requester is a teacher (owner) or admin, include all submissions for grading
    if (user.role === 'admin' || user.role === 'teacher') {
      try {
        const { data: submissions, error: subErr } = await supabase
          .from('assignment_submissions')
          .select(`*, student:users!assignment_submissions_student_id_fkey(id, first_name, last_name, email, profile_image_url)`)
          .eq('assignment_id', assignment.id);

        if (subErr) {
          console.error('Fetch submissions error:', subErr);
        }

        assignment.submissions = submissions || [];
        assignment.gradedSubmissions = (submissions || []).filter((s) => s.grade !== null && s.grade !== undefined);
      } catch (subCatchErr) {
        console.error('Submissions fetch exception:', subCatchErr);
      }
    }

    res.json(assignment);
  } catch (err) {
    console.error('Assignment GET id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/assignments/:id
 * Update an assignment (Teacher/Admin).
 */
router.put('/:id', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { id } = req.params;

    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers or admins can update assignments' });
    }

    // Fetch assignment row to verify ownership and get class_id
    const { data: assignmentRow, error: fetchErr } = await supabase
      .from('assignments')
      .select('teacher_id, class_id, attachments')
      .eq('id', id)
      .single();

    if (fetchErr || !assignmentRow) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (user.role === 'teacher' && assignmentRow.teacher_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to update this assignment' });
    }

    // Fields from body
    const {
      title,
      description,
      instructions,
      dueDate,
      totalPoints,
      status,
      type,
      allowLateSubmission,
      gradingRubric,
    } = req.body;

    // Handle newly uploaded attachments (append to existing)
    const existingAttachments = assignmentRow.attachments || [];
    const newAttachments = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const uploadRes = await cdnStorage.uploadFile(file, {
            userId: user.id,
            folder: `assignments/${assignmentRow.class_id}`,
            relatedTable: 'assignments',
          });
          newAttachments.push({
            id: uploadRes.file.id,
            filename: uploadRes.file.filename,
            name: file.originalname,
            url: uploadRes.url,
            provider: uploadRes.provider,
            size: uploadRes.file.file_size,
            contentType: uploadRes.file.content_type,
          });
        } catch (err) {
          console.error('Attachment upload error:', err.message);
        }
      }
    }

    const updatedFields = {
      ...(title && { title }),
      ...(description && { description }),
      ...(instructions && { instructions }),
      ...(dueDate && { due_date: new Date(dueDate).toISOString() }),
      ...(totalPoints && { total_points: parseInt(totalPoints, 10) }),
      ...(status && { status }),
      ...(type && { type }),
      ...(allowLateSubmission !== undefined && { allow_late_submission: allowLateSubmission === 'true' || allowLateSubmission === true }),
      ...(gradingRubric !== undefined && (() => {
        try {
          return { rubric: gradingRubric ? JSON.parse(gradingRubric) : null };
        } catch (e) {
          console.warn('Invalid gradingRubric JSON – ignoring');
          return {};
        }
      })()),
      ...(newAttachments.length && { attachments: [...existingAttachments, ...newAttachments] }),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedAssignment, error: updateErr } = await supabase
      .from('assignments')
      .update(updatedFields)
      .eq('id', id)
      .select(
        `*,
         class:classes(id, name, subject)`
      )
      .single();

    if (updateErr) {
      console.error('Assignment update error:', updateErr);
      return res.status(500).json({ error: 'Failed to update assignment' });
    }

    res.json({ assignment: updatedAssignment });
  } catch (err) {
    console.error('Assignments PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/assignments/:id
 * Delete an assignment (Teacher/Admin).
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { id } = req.params;

    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers or admins can delete assignments' });
    }

    const { data: assignmentRow, error: fetchErr } = await supabase
      .from('assignments')
      .select('teacher_id')
      .eq('id', id)
      .single();

    if (fetchErr || !assignmentRow) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (user.role === 'teacher' && assignmentRow.teacher_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this assignment' });
    }

    const { error: deleteErr } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('Assignment delete error:', deleteErr);
      return res.status(500).json({ error: 'Failed to delete assignment' });
    }

    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('Assignments DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 