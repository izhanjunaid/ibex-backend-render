const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchoolSettings() {
  console.log('🔍 Checking school_settings table...\n');

  try {
    // Check if table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('school_settings')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Error accessing school_settings table:', tableError.message);
      return;
    }

    console.log('✅ school_settings table exists');
    console.log('📊 Current data:', tableInfo);

    // Try to insert a test record
    const testConfig = {
      daily_reset_time: "06:00",
      default_status: "unmarked",
      enable_auto_reset: true,
      auto_reset_time: "06:00",
      late_threshold_minutes: 20,
      absent_threshold_minutes: 45
    };

    console.log('\n🧪 Testing config update...');
    
    const { data: insertResult, error: insertError } = await supabase
      .from('school_settings')
      .upsert({
        attendance_config: testConfig,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) {
      console.log('❌ Error inserting config:', insertError.message);
    } else {
      console.log('✅ Successfully updated config:', insertResult);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchoolSettings();

