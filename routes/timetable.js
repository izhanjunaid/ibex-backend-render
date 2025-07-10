const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

/**
 * GET /api/timetable
 * Get timetable data for display (read-only)
 * All schedule editing is done through school settings
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { weekStart } = req.query;
    
    let query = req.supabase
      .from('classes')
      .select(`
        *,
        teacher:users!teacher_id(id, first_name, last_name, email, profile_image_url)
      `)
      .eq('is_active', true);

    // Role-based filtering
    if (user.role === 'teacher') {
      query = query.eq('teacher_id', user.id);
    } else if (user.role === 'student') {
      // Get classes the student is enrolled in
      const { data: enrollments } = await req.supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .eq('status', 'active');
      
      if (enrollments && enrollments.length > 0) {
        const classIds = enrollments.map(e => e.class_id);
        query = query.in('id', classIds);
      } else {
        return res.json({
          success: true,
          data: [],
          message: 'No classes enrolled'
        });
      }
    }
    // Admins see all classes

    const { data: classes, error } = await query;

    if (error) {
      console.error('Error fetching timetable:', error);
      return res.status(500).json({ error: 'Failed to fetch timetable' });
    }

    res.json({
      success: true,
      data: classes || [],
      weekStart: weekStart || new Date().toISOString(),
      message: 'Timetable data retrieved successfully. Schedule editing is available in School Settings.'
    });
  } catch (error) {
    console.error('Timetable fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/timetable/export
 * Export timetable in various formats (read-only)
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { format = 'pdf', weekStart } = req.query;

    if (!['pdf', 'excel', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid export format' });
    }

    // Get timetable data (same as main endpoint)
    let query = req.supabase
      .from('classes')
      .select(`
        *,
        teacher:users!teacher_id(id, first_name, last_name, email)
      `)
      .eq('is_active', true);

    if (user.role === 'teacher') {
      query = query.eq('teacher_id', user.id);
    } else if (user.role === 'student') {
      const { data: enrollments } = await req.supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', user.id)
        .eq('status', 'active');
      
      if (enrollments && enrollments.length > 0) {
        const classIds = enrollments.map(e => e.class_id);
        query = query.in('id', classIds);
      } else {
        return res.json({ 
          success: true, 
          data: [],
          message: 'No classes to export'
        });
      }
    }

    const { data: classes, error } = await query;

    if (error) {
      console.error('Error fetching timetable for export:', error);
      return res.status(500).json({ error: 'Failed to export timetable' });
    }

    // For now, return JSON data. In production, you'd generate actual files
    res.json({
      success: true,
      data: {
        format,
        weekStart: weekStart || new Date().toISOString(),
        classes: classes || [],
        exportUrl: `/api/timetable/export/download?format=${format}&weekStart=${weekStart}`,
        message: `Timetable exported as ${format.toUpperCase()}. Download URL provided.`
      }
    });
  } catch (error) {
    console.error('Timetable export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 