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
 * POST /api/notifications/register-token
 * Register FCM token for push notifications
 */
router.post('/register-token', authenticateToken, async (req, res) => {
  console.log('🔔 [NOTIFICATIONS] POST /register-token - Registering FCM token');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { token, deviceType = 'android', deviceName } = req.body;
    const supabase = req.supabase;

    if (!token) {
      console.log('❌ [NOTIFICATIONS] Missing FCM token');
      return res.status(400).json({ error: 'FCM token is required' });
    }

    console.log('   📱 Registering token for device:', { deviceType, deviceName });

    // Insert or update FCM token
    const { data: fcmToken, error } = await supabase
      .from('fcm_tokens')
      .upsert({
        user_id: user.id,
        token: token,
        device_type: deviceType,
        device_name: deviceName,
        is_active: true,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,token'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [NOTIFICATIONS] Error registering FCM token:', error);
      return res.status(500).json({ error: 'Failed to register FCM token' });
    }

    console.log('✅ [NOTIFICATIONS] Successfully registered FCM token');
    res.json({
      success: true,
      message: 'FCM token registered successfully',
      fcm_token: fcmToken
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error in register token route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/unregister-token
 * Unregister FCM token
 */
router.post('/unregister-token', authenticateToken, async (req, res) => {
  console.log('🔔 [NOTIFICATIONS] POST /unregister-token - Unregistering FCM token');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { token } = req.body;
    const supabase = req.supabase;

    if (!token) {
      console.log('❌ [NOTIFICATIONS] Missing FCM token');
      return res.status(400).json({ error: 'FCM token is required' });
    }

    console.log('   📱 Unregistering token');

    // Mark token as inactive
    const { data: result, error } = await supabase
      .rpc('deactivate_fcm_token', {
        p_user_id: user.id,
        p_token: token
      });

    if (error) {
      console.error('❌ [NOTIFICATIONS] Error unregistering FCM token:', error);
      return res.status(500).json({ error: 'Failed to unregister FCM token' });
    }

    console.log('✅ [NOTIFICATIONS] Successfully unregistered FCM token');
    res.json({
      success: true,
      message: 'FCM token unregistered successfully',
      deactivated: result
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error in unregister token route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/history
 * Get notification history for the current user
 */
router.get('/history', authenticateToken, async (req, res) => {
  console.log('🔔 [NOTIFICATIONS] GET /history - Fetching notification history');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { limit = 50, offset = 0, type } = req.query;
    const supabase = req.supabase;

    let query = supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('❌ [NOTIFICATIONS] Error fetching notification history:', error);
      return res.status(500).json({ error: 'Failed to fetch notification history' });
    }

    console.log('✅ [NOTIFICATIONS] Successfully fetched', notifications?.length || 0, 'notifications');
    res.json({
      notifications: notifications || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: notifications?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error in notification history route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/tokens
 * Get user's active FCM tokens
 */
router.get('/tokens', authenticateToken, async (req, res) => {
  console.log('🔔 [NOTIFICATIONS] GET /tokens - Fetching user FCM tokens');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const supabase = req.supabase;

    const { data: tokens, error } = await supabase
      .rpc('get_user_fcm_tokens', { p_user_id: user.id });

    if (error) {
      console.error('❌ [NOTIFICATIONS] Error fetching FCM tokens:', error);
      return res.status(500).json({ error: 'Failed to fetch FCM tokens' });
    }

    console.log('✅ [NOTIFICATIONS] Successfully fetched', tokens?.length || 0, 'FCM tokens');
    res.json({
      tokens: tokens || []
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error in tokens route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/send-attendance
 * Send attendance notification to a student (admin/teacher only)
 */
router.post('/send-attendance', authenticateToken, async (req, res) => {
  console.log('🔔 [NOTIFICATIONS] POST /send-attendance - Sending attendance notification');
  console.log('   👤 User:', { id: req.user.id, role: req.user.role, email: req.user.email });
  
  try {
    const { user } = req;
    const { studentId, status, date, gradeSectionName } = req.body;
    const supabase = req.supabase;

    // Only teachers and admins can send notifications
    if (!['teacher', 'admin'].includes(user.role)) {
      console.log('❌ [NOTIFICATIONS] Access denied - only teachers and admins can send notifications');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!studentId || !status || !date) {
      console.log('❌ [NOTIFICATIONS] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: studentId, status, date' });
    }

    console.log('   📱 Sending attendance notification to student:', studentId);

    // Call the push notification function
    const { data: result, error } = await supabase.functions.invoke('push-notifications', {
      body: {
        action: 'send-attendance-notification',
        data: {
          studentId,
          status,
          date,
          gradeSectionName,
          markedBy: user.id
        }
      }
    });

    if (error) {
      console.error('❌ [NOTIFICATIONS] Error sending attendance notification:', error);
      return res.status(500).json({ error: 'Failed to send attendance notification' });
    }

    console.log('✅ [NOTIFICATIONS] Successfully sent attendance notification');
    res.json({
      success: true,
      message: 'Attendance notification sent successfully',
      result
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error in send attendance route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
