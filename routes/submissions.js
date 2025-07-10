const express = require('express');
const multer = require('multer');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');
const hybridStorage = require('../lib/hybrid-storage');

// Multer config – keep files in memory (upload to hybrid storage afterwards)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 209715200, // 200 MB default
    files: 10,
  },
});

// Inject Supabase admin client
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

/*
 * POST /api/submissions
 * Student submits or updates their submission for an assignment.
 */
router.post('/', authenticateToken, upload.array('files', 10), async (req, res) => {
  console.log('🔔 Received submission POST');
  try {
    const supabase = req.supabase;
    const { user } = req;

    if (user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit assignments' });
    }

    const { assignmentId, text } = req.body;
    console.log('📥 assignmentId received:', assignmentId);
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }

    // Fetch assignment row for checks (allowLateSubmission, due date)
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('due_date, class_id')
      .eq('id', assignmentId)
      .single();

    if (assignErr || !assignment) {
      console.error('❌ Assignment lookup failed', { assignErr, assignment });
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const now = new Date();
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    // If column missing, default to allowing late submissions
    const allowLate = assignment.allow_late_submission !== false;
    if (dueDate && now > dueDate && !allowLate) {
      return res.status(403).json({ error: 'Late submissions are not allowed for this assignment' });
    }

    // Handle file uploads
    let uploadedFiles = [];
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const uploadRes = await hybridStorage.uploadFile(file, {
            userId: user.id,
            folder: `submissions/${assignmentId}/${user.id}`,
            relatedTable: 'assignment_submissions',
          });
          uploadedFiles.push({
            id: uploadRes.file.id,
            filename: uploadRes.file.filename,
            name: file.originalname,
            url: uploadRes.url,
            provider: uploadRes.provider,
            size: uploadRes.file.file_size,
            contentType: uploadRes.file.content_type,
          });
        } catch (err) {
          console.error('File upload error:', err.message);
        }
      }
    }

    // Upsert submission (unique per assignment+student)
    const { data: submission, error: upsertErr } = await supabase
      .from('assignment_submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: user.id,
        content: text || null,
        attachments: uploadedFiles,
        submitted_at: now.toISOString(),
        status: 'submitted',
      }, { onConflict: 'assignment_id,student_id', ignoreDuplicates: false, defaultToNull: true })
      .select('*')
      .single();

    if (upsertErr) {
      console.error('Submission upsert error:', upsertErr);
      return res.status(500).json({ error: 'Failed to submit assignment' });
    }

    // Real-time updates removed - Socket.IO disabled

    res.status(201).json({ submission });
  } catch (err) {
    console.error('Submissions POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/*
 * GET /api/submissions/:assignmentId  (Teacher/Admin) – list submissions for an assignment
 */
router.get('/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { assignmentId } = req.params;

    // Fetch assignment to check teacher ownership / class for admin
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('teacher_id, class_id')
      .eq('id', assignmentId)
      .single();

    if (assignErr || !assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (user.role === 'teacher' && user.id !== assignment.teacher_id) {
      return res.status(403).json({ error: 'Not authorized to view submissions for this assignment' });
    }

    // TODO: For students the list could be restricted; for now only teacher/admin.

    const { data: submissions, error } = await supabase
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId);

    if (error) {
      console.error('Fetch submissions error:', error);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }

    res.json(submissions || []);
  } catch (err) {
    console.error('Submissions list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/*
 * PUT /api/submissions/:submissionId   (Teacher/Admin) – record grade/feedback
 */
router.put('/:submissionId', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    if (!['teacher', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only teachers or admins can grade submissions' });
    }

    const { data: submissionRow, error: fetchErr } = await supabase
      .from('assignment_submissions')
      .select('assignment_id')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !submissionRow) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify teacher owns assignment; admins bypass
    if (user.role === 'teacher') {
      const { data: assignment, error: assignErr } = await supabase
        .from('assignments')
        .select('teacher_id')
        .eq('id', submissionRow.assignment_id)
        .single();
      if (assignErr || !assignment || assignment.teacher_id !== user.id) {
        return res.status(403).json({ error: 'Not authorized to grade this submission' });
      }
    }

    const { data: updatedSubmission, error: updateErr } = await supabase
      .from('assignment_submissions')
      .update({
        grade,
        feedback,
        graded_by: user.id,
        graded_at: new Date().toISOString(),
        status: 'graded',
      })
      .eq('id', submissionId)
      .select('*')
      .single();

    if (updateErr) {
      console.error('Submission grade error:', updateErr);
      return res.status(500).json({ error: 'Failed to grade submission' });
    }

    res.json({ submission: updatedSubmission });
  } catch (err) {
    console.error('Submissions PUT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/*
 * DELETE /api/submissions/:assignmentId/self
 * Student removes their own submission so they can resubmit.
 */
router.delete('/:assignmentId/self', authenticateToken, async (req, res) => {
  try {
    const supabase = req.supabase;
    const { user } = req;
    const { assignmentId } = req.params;

    if (user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can unsubmit' });
    }

    await supabase
      .from('assignment_submissions')
      .delete()
      .eq('assignment_id', assignmentId)
      .eq('student_id', user.id);

    return res.status(204).send();
  } catch (err) {
    console.error('Unsubmit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 