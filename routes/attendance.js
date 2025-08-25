const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

/**
 * GET /api/attendance/grade-sections
 * Get all grade sections for attendance marking (role-based)
 */
router.get('/grade-sections', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] GET /grade-sections - Fetching grade sections');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;
    
    let query = supabase
      .from('grade_sections')
      .select('id, name, grade_level, section, teacher_id')
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    // Role-based filtering
    if (user.role === 'teacher') {
      console.log('   👨‍🏫 Teacher filtering - teacher_id:', user.id);
      query = query.eq('teacher_id', user.id);
    }
    // Admins can see all grade sections

    const { data: gradeSections, error } = await query;

    if (error) {
      console.error('❌ [ATTENDANCE] Error fetching grade sections:', error);
      return res.status(500).json({ error: 'Failed to fetch grade sections' });
    }

    console.log('✅ [ATTENDANCE] Successfully fetched', gradeSections?.length || 0, 'grade sections');
    res.json(gradeSections || []);
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in grade sections route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/attendance?grade_section_id=xxx&date=yyyy-mm-dd
 * Get students with attendance status for a grade section on a specific date
 */
router.get('/', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] GET / - Fetching students with attendance');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Query params:', req.query);
  
  try {
    const { user } = req;
    const { grade_section_id, date } = req.query;
    const supabase = req.supabase;

    if (!grade_section_id || !date) {
      console.log('❌ [ATTENDANCE] Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters: grade_section_id and date' });
    }

    // Check if user has access to this grade section
    if (user.role === 'teacher') {
      const { data: gradeSectionData } = await supabase
        .from('grade_sections')
        .select('teacher_id')
        .eq('id', grade_section_id)
        .single();

      if (gradeSectionData?.teacher_id !== user.id) {
        console.log('❌ [ATTENDANCE] Access denied - teacher not assigned to this grade section');
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    console.log('   📚 Getting students for grade section:', grade_section_id, 'on date:', date);

    // Use the optimized function to get students with attendance status
    const { data: students, error } = await supabase
      .rpc('get_grade_section_attendance', {
        p_grade_section_id: grade_section_id,
        p_date: date
      });

    if (error) {
      console.error('❌ [ATTENDANCE] Error fetching students:', error);
      return res.status(500).json({ error: 'Failed to fetch students' });
    }

    // Calculate statistics for the response
    const stats = {
      total: students.length,
      present: students.filter(s => s.status === 'present').length,
      absent: students.filter(s => s.status === 'absent').length,
      late: students.filter(s => s.status === 'late').length,
      excused: students.filter(s => s.status === 'excused').length,
      unmarked: students.filter(s => s.status === 'unmarked').length
    };

    console.log('✅ [ATTENDANCE] Successfully fetched', students?.length || 0, 'students');
    console.log('   📊 Statistics:', stats);
    
    res.json({
      students: students || [],
      statistics: stats,
      date: date,
      grade_section_id: grade_section_id
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in attendance route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/attendance/bulk-mark
 * Bulk mark attendance for multiple students efficiently
 */
router.post('/bulk-mark', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] POST /bulk-mark - Bulk marking attendance');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { user } = req;
    const { grade_section_id, date, attendance_records } = req.body;
    const supabase = req.supabase;

    // Validate required fields
    if (!grade_section_id || !date || !Array.isArray(attendance_records)) {
      console.log('❌ [ATTENDANCE] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user has access to this grade section
    if (user.role === 'teacher') {
      const { data: gradeSectionData } = await supabase
        .from('grade_sections')
        .select('teacher_id')
        .eq('id', grade_section_id)
        .single();

      if (gradeSectionData?.teacher_id !== user.id) {
        console.log('❌ [ATTENDANCE] Access denied - teacher not assigned to this grade section');
        return res.status(403).json({ error: 'Access denied to this grade section' });
      }
    }

    // Validate attendance records
    const validStatuses = ['present', 'absent', 'late', 'excused', 'unmarked'];
    const invalidRecords = attendance_records.filter(record => 
      !record.student_id || !validStatuses.includes(record.status)
    );

    if (invalidRecords.length > 0) {
      console.log('❌ [ATTENDANCE] Invalid attendance records found');
      return res.status(400).json({ 
        error: 'Invalid attendance records', 
        invalid_records: invalidRecords 
      });
    }

    console.log('   📝 Marking attendance for', attendance_records.length, 'students');

    // Use the bulk mark function for efficient processing
    const { data: result, error } = await supabase
      .rpc('bulk_mark_attendance', {
        p_grade_section_id: grade_section_id,
        p_date: date,
        p_attendance_records: attendance_records,
        p_marked_by: user.id
      });

    if (error) {
      console.error('❌ [ATTENDANCE] Error marking attendance:', error);
      return res.status(500).json({ error: 'Failed to mark attendance' });
    }

    console.log('✅ [ATTENDANCE] Successfully marked attendance:', result);
    
    // Send push notifications to students whose attendance was marked
    try {
      console.log('   📱 Sending push notifications to students...');
      
      // Get grade section name for notifications
      const { data: gradeSection } = await supabase
        .from('grade_sections')
        .select('name')
        .eq('id', grade_section_id)
        .single();
      
      const gradeSectionName = gradeSection?.name || '';
      
      // Send notifications for each student whose attendance was marked
      for (const record of attendance_records) {
        if (record.status !== 'unmarked') {
          console.log(`   📱 Sending notification to student ${record.student_id} for status: ${record.status}`);
          
          // Call the push notification function
          await supabase.functions.invoke('push-notifications', {
            body: {
              action: 'send-attendance-notification',
              data: {
                studentId: record.student_id,
                status: record.status,
                date: date,
                gradeSectionName: gradeSectionName,
                markedBy: user.id
              }
            }
          });
        }
      }
      
      console.log('   ✅ Push notifications sent successfully');
    } catch (notificationError) {
      console.error('   ⚠️ Error sending push notifications:', notificationError);
      // Don't fail the attendance marking if notifications fail
    }
    
    res.json({
      message: 'Attendance marked successfully',
      result: result,
      marked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in bulk mark route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/attendance/reset
 * Reset daily attendance (mark all as unmarked)
 */
router.post('/reset', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] POST /reset - Resetting daily attendance');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { user } = req;
    const { grade_section_id, date } = req.body;
    const supabase = req.supabase;

    // Only admins can reset attendance
    if (user.role !== 'admin') {
      console.log('❌ [ATTENDANCE] Access denied - only admins can reset attendance');
      return res.status(403).json({ error: 'Only admins can reset attendance' });
    }

    if (!grade_section_id || !date) {
      console.log('❌ [ATTENDANCE] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: grade_section_id and date' });
    }

    console.log('   🔄 Resetting attendance for grade section:', grade_section_id, 'on date:', date);

    // Use the reset function
    const { data: result, error } = await supabase
      .rpc('reset_daily_attendance', {
        p_grade_section_id: grade_section_id,
        p_date: date,
        p_reset_by: user.id
      });

    if (error) {
      console.error('❌ [ATTENDANCE] Error resetting attendance:', error);
      return res.status(500).json({ error: 'Failed to reset attendance' });
    }

    console.log('✅ [ATTENDANCE] Successfully reset attendance:', result);
    res.json({
      message: 'Attendance reset successfully',
      result: result
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in reset route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/attendance/stats?grade_section_id=xxx&start_date=yyyy-mm-dd&end_date=yyyy-mm-dd
 * Get attendance statistics for a grade section
 */
router.get('/stats', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] GET /stats - Fetching attendance statistics');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Query params:', req.query);
  
  try {
    const { user } = req;
    const { grade_section_id, start_date, end_date } = req.query;
    const supabase = req.supabase;

    if (!grade_section_id) {
      console.log('❌ [ATTENDANCE] Missing grade_section_id parameter');
      return res.status(400).json({ error: 'Missing grade_section_id parameter' });
    }

    // Check if user has access to this grade section
    if (user.role === 'teacher') {
      const { data: gradeSectionData } = await supabase
        .from('grade_sections')
        .select('teacher_id')
        .eq('id', grade_section_id)
        .single();

      if (gradeSectionData?.teacher_id !== user.id) {
        console.log('❌ [ATTENDANCE] Access denied - teacher not assigned to this grade section');
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    console.log('   📊 Getting stats for grade section:', grade_section_id, 'from', startDate, 'to', endDate);

    const { data: stats, error } = await supabase
      .rpc('get_attendance_stats', {
        p_grade_section_id: grade_section_id,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) {
      console.error('❌ [ATTENDANCE] Error fetching attendance stats:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance statistics' });
    }

    console.log('✅ [ATTENDANCE] Successfully fetched attendance statistics');
    res.json({
      statistics: stats || [],
      date_range: { start_date: startDate, end_date: endDate },
      grade_section_id: grade_section_id
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in attendance stats route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/attendance/history?student_id=xxx&start_date=yyyy-mm-dd&end_date=yyyy-mm-dd
 * Get attendance history for a specific student
 */
router.get('/history', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] GET /history - Fetching student attendance history');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Query params:', req.query);
  
  try {
    const { user } = req;
    const { student_id, start_date, end_date } = req.query;
    const supabase = req.supabase;

    if (!student_id) {
      console.log('❌ [ATTENDANCE] Missing student_id parameter');
      return res.status(400).json({ error: 'Missing student_id parameter' });
    }

    // Check access - students can only see their own, teachers can see their grade section students
    if (user.role === 'student' && student_id !== user.id) {
      console.log('❌ [ATTENDANCE] Access denied - student trying to access another student\'s data');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user.role === 'teacher') {
      // Check if the student is in one of the teacher's grade sections
      const { data: studentEnrollment } = await supabase
        .from('grade_section_enrollments')
        .select('grade_section_id')
        .eq('student_id', student_id)
        .eq('status', 'active')
        .single();

      if (!studentEnrollment) {
        console.log('❌ [ATTENDANCE] Student not found in any grade section');
        return res.status(404).json({ error: 'Student not found' });
      }

      const { data: gradeSection } = await supabase
        .from('grade_sections')
        .select('teacher_id')
        .eq('id', studentEnrollment.grade_section_id)
        .single();

      if (gradeSection?.teacher_id !== user.id) {
        console.log('❌ [ATTENDANCE] Access denied - teacher not assigned to student\'s grade section');
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    console.log('   📊 Getting history for student:', student_id, 'from', startDate, 'to', endDate);

    const { data: history, error } = await supabase
      .rpc('get_student_attendance_history', {
        p_student_id: student_id,
        p_start_date: startDate,
        p_end_date: endDate
      });

    if (error) {
      console.error('❌ [ATTENDANCE] Error fetching student history:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance history' });
    }

    console.log('✅ [ATTENDANCE] Successfully fetched attendance history');
    res.json({
      history: history || [],
      date_range: { start_date: startDate, end_date: endDate },
      student_id: student_id
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in attendance history route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/attendance/config
 * Get attendance configuration
 */
router.get('/config', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] GET /config - Fetching attendance configuration');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;

    // Only admins and teachers can view config
    if (user.role !== 'admin' && user.role !== 'teacher') {
      console.log('❌ [ATTENDANCE] Access denied - insufficient permissions');
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: settings, error } = await supabase
      .from('school_settings')
      .select('attendance_config')
      .limit(1)
      .single();

    if (error) {
      console.error('❌ [ATTENDANCE] Error fetching attendance config:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance configuration' });
    }

    console.log('✅ [ATTENDANCE] Successfully fetched attendance configuration');
    res.json({
      config: settings?.attendance_config || {
        daily_reset_time: "00:00",
        default_status: "unmarked",
        enable_auto_reset: false,
        auto_reset_time: "00:00",
        late_threshold_minutes: 15,
        absent_threshold_minutes: 30
      }
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in config route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/attendance/config
 * Update attendance configuration (admin only)
 */
router.put('/config', authenticateToken, async (req, res) => {
  console.log('🔍 [ATTENDANCE] PUT /config - Updating attendance configuration');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  console.log('   📝 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { user } = req;
    const { config } = req.body;
    const supabase = req.supabase;

    // Only admins can update config
    if (user.role !== 'admin') {
      console.log('❌ [ATTENDANCE] Access denied - only admins can update config');
      return res.status(403).json({ error: 'Only admins can update attendance configuration' });
    }

    if (!config) {
      console.log('❌ [ATTENDANCE] Missing config in request body');
      return res.status(400).json({ error: 'Missing config in request body' });
    }

    // Validate config structure
    const requiredFields = ['daily_reset_time', 'default_status', 'enable_auto_reset'];
    const missingFields = requiredFields.filter(field => !(field in config));
    
    if (missingFields.length > 0) {
      console.log('❌ [ATTENDANCE] Missing required config fields:', missingFields);
      return res.status(400).json({ 
        error: 'Missing required config fields', 
        missing_fields: missingFields 
      });
    }

    console.log('   ⚙️  Updating attendance configuration');

    // Update the existing school_settings record
    const { data, error } = await supabase
      .from('school_settings')
      .update({ 
        attendance_config: config,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1) // Update the existing record
      .select('attendance_config')
      .single();

    if (error) {
      console.error('❌ [ATTENDANCE] Error updating attendance config:', error);
      return res.status(500).json({ error: 'Failed to update attendance configuration' });
    }

    console.log('✅ [ATTENDANCE] Successfully updated attendance configuration');
    res.json({
      message: 'Attendance configuration updated successfully',
      config: data.attendance_config
    });
  } catch (error) {
    console.error('❌ [ATTENDANCE] Error in config update route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
