const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabaseAdmin } = require('../lib/supabase');

// Middleware to inject Supabase client
router.use((req, res, next) => {
  req.supabase = supabaseAdmin;
  next();
});

// Get school settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    
    // Only admins can access school settings
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Get school information
    const { data: schoolInfo, error: schoolError } = await req.supabase
      .from('school_settings')
      .select('*')
      .single();

    // Get school timings
    const { data: schoolTimings, error: timingsError } = await req.supabase
      .from('school_timings')
      .select('*')
      .order('day_order');

    if (schoolError && schoolError.code !== 'PGRST116') {
      console.error('Error fetching school info:', schoolError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch school information' 
      });
    }

    if (timingsError) {
      console.error('Error fetching school timings:', timingsError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch school timings' 
      });
    }

    res.json({
      success: true,
      data: {
        schoolInfo: schoolInfo || {
          name: '',
          address: '',
          phone: '',
          email: '',
          website: ''
        },
        schoolTimings: schoolTimings || []
      }
    });

  } catch (error) {
    console.error('Error in school settings GET:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Save school settings
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('💾 School settings save request received')
    console.log('👤 User:', { id: req.user.id, role: req.user.role })
    console.log('📥 Request body:', req.body)
    
    const { user } = req;
    const { schoolInfo, schoolTimings } = req.body;
    
    // Only admins can save school settings
    if (user.role !== 'admin') {
      console.log('❌ Access denied - user is not admin')
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }

    // Validate required fields
    if (!schoolInfo || !schoolTimings) {
      console.log('❌ Missing required fields:', { schoolInfo: !!schoolInfo, schoolTimings: !!schoolTimings })
      return res.status(400).json({ 
        success: false, 
        message: 'School information and timings are required' 
      });
    }

    console.log('✅ Validation passed, proceeding with save...')

    // Save school information (upsert)
    console.log('💾 Saving school info...')
    const { error: schoolError } = await req.supabase
      .from('school_settings')
      .upsert({
        id: 1, // Single school record
        name: schoolInfo.name,
        address: schoolInfo.address,
        phone: schoolInfo.phone,
        email: schoolInfo.email,
        website: schoolInfo.website,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      });

    if (schoolError) {
      console.error('❌ Error saving school info:', schoolError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save school information' 
      });
    }
    console.log('✅ School info saved successfully')

    // Clear existing timings and save new ones
    console.log('🗑️ Clearing existing timings...')
    const { error: deleteError } = await req.supabase
      .from('school_timings')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('❌ Error deleting existing timings:', deleteError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to update school timings' 
      });
    }
    console.log('✅ Existing timings cleared')

    // Prepare timings data with day order
    console.log('📝 Preparing timings data...')
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timingsData = schoolTimings.map((timing, index) => {
      const timingData = {
        day: timing.day,
        day_order: dayOrder.indexOf(timing.day),
        start_time: timing.startTime,
        end_time: timing.endTime,
        is_active: timing.isActive,
        breaks: timing.breaks,
        periods: timing.periods || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id
      };
      
      console.log(`📅 Processing timing ${index + 1} - ${timing.day}:`, {
        day: timingData.day,
        start_time: timingData.start_time,
        end_time: timingData.end_time,
        is_active: timingData.is_active,
        breaksCount: timingData.breaks?.length || 0,
        periodsCount: timingData.periods?.length || 0,
        breaks: timingData.breaks,
        periods: timingData.periods
      });
      
      return timingData;
    });

    console.log('📊 Timings data prepared:', timingsData.length, 'records')

    // Insert new timings
    console.log('💾 Inserting new timings...')
    const { data: newTimings, error: timingsError } = await req.supabase
      .from('school_timings')
      .insert(timingsData)
      .select();

    if (timingsError) {
      console.error('❌ Error saving school timings:', timingsError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save school timings' 
      });
    }

    console.log('✅ Timings saved successfully:', newTimings.length, 'records')

    // Verify what was actually saved
    console.log('🔍 Verifying saved data...')
    const { data: verifiedTimings, error: verifyError } = await req.supabase
      .from('school_timings')
      .select('*')
      .order('day_order');

    if (verifyError) {
      console.error('❌ Error verifying saved data:', verifyError);
    } else {
      console.log('✅ Verification successful - saved data:', verifiedTimings)
    }

    const response = {
      success: true,
      message: 'School settings saved successfully',
      data: {
        schoolInfo,
        schoolTimings: newTimings,
        verifiedData: verifiedTimings
      }
    }

    console.log('📤 Sending success response:', response)
    res.json(response);

  } catch (error) {
    console.error('❌ Error in school settings POST:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get school timings for timetable (public endpoint)
router.get('/timings', async (req, res) => {
  try {
    console.log('🔍 Fetching school timings from database...')
    
    const { data: schoolTimings, error } = await req.supabase
      .from('school_timings')
      .select('*')
      .order('day_order');

    console.log('📊 Database response:', { schoolTimings, error })

    if (error) {
      console.error('Error fetching school timings:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch school timings' 
      });
    }

    const response = {
      success: true,
      data: schoolTimings || []
    }
    
    console.log('📤 Sending response:', response)
    res.json(response);

  } catch (error) {
    console.error('Error in school timings GET:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Test endpoint to check database tables
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing database tables...')
    
    // Check if school_timings table exists and has data
    const { data: timingsCount, error: timingsError } = await req.supabase
      .from('school_timings')
      .select('*', { count: 'exact', head: true });
    
    // Check if school_settings table exists and has data
    const { data: settingsCount, error: settingsError } = await req.supabase
      .from('school_settings')
      .select('*', { count: 'exact', head: true });
    
    console.log('📊 Table check results:', {
      timingsCount: timingsCount?.length || 0,
      timingsError,
      settingsCount: settingsCount?.length || 0,
      settingsError
    })
    
    res.json({
      success: true,
      data: {
        timingsTableExists: !timingsError,
        timingsCount: timingsCount?.length || 0,
        settingsTableExists: !settingsError,
        settingsCount: settingsCount?.length || 0,
        timingsError: timingsError?.message,
        settingsError: settingsError?.message
      }
    });
    
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router; 