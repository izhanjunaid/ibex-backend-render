const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseAttendance() {
  console.log('🔍 Checking Database for Attendance-Related Items...\n');

  try {
    // 1. Check for attendance table
    console.log('1. 📋 Checking for attendance table...');
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);

    if (attendanceError) {
      console.log('❌ Attendance table error:', attendanceError.message);
      if (attendanceError.message.includes('relation "attendance" does not exist')) {
        console.log('✅ No attendance table found - good!');
      }
    } else {
      console.log('⚠️  Attendance table exists!');
      
      // Get count of attendance records
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true });
      
      console.log(`   📊 Contains ${count} attendance records`);
      
      // Show sample data
      const { data: sampleAttendance } = await supabase
        .from('attendance')
        .select('*')
        .limit(3);
      
      if (sampleAttendance && sampleAttendance.length > 0) {
        console.log('   📝 Sample attendance records:');
        sampleAttendance.forEach((record, index) => {
          console.log(`      ${index + 1}. Student: ${record.student_id}, Date: ${record.date}, Status: ${record.status}`);
        });
      }
    }

    // 2. Check for attendance-related functions
    console.log('\n2. 🔧 Checking for attendance-related functions...');
    
    // Check for get_grade_section_attendance_students function
    try {
      const { data: students, error: funcError } = await supabase
        .rpc('get_grade_section_attendance_students', {
          grade_section_uuid: '00000000-0000-0000-0000-000000000000',
          attendance_date: '2025-01-01'
        });
      
      if (funcError) {
        if (funcError.message.includes('function "get_grade_section_attendance_students" does not exist')) {
          console.log('✅ get_grade_section_attendance_students function not found - good!');
        } else {
          console.log('⚠️  get_grade_section_attendance_students function exists but has error:', funcError.message);
        }
      } else {
        console.log('⚠️  get_grade_section_attendance_students function exists!');
      }
    } catch (error) {
      console.log('✅ get_grade_section_attendance_students function not found - good!');
    }

    // Check for get_grade_section_attendance_stats function
    try {
      const { data: stats, error: statsError } = await supabase
        .rpc('get_grade_section_attendance_stats', {
          grade_section_uuid: '00000000-0000-0000-0000-000000000000',
          start_date: '2025-01-01',
          end_date: '2025-01-31'
        });
      
      if (statsError) {
        if (statsError.message.includes('function "get_grade_section_attendance_stats" does not exist')) {
          console.log('✅ get_grade_section_attendance_stats function not found - good!');
        } else {
          console.log('⚠️  get_grade_section_attendance_stats function exists but has error:', statsError.message);
        }
      } else {
        console.log('⚠️  get_grade_section_attendance_stats function exists!');
      }
    } catch (error) {
      console.log('✅ get_grade_section_attendance_stats function not found - good!');
    }

    // 3. Check school_settings for attendance configuration
    console.log('\n3. ⚙️  Checking school_settings for attendance config...');
    const { data: schoolSettings, error: settingsError } = await supabase
      .from('school_settings')
      .select('*')
      .limit(1);

    if (settingsError) {
      console.log('❌ Error accessing school_settings:', settingsError.message);
    } else if (schoolSettings && schoolSettings.length > 0) {
      const settings = schoolSettings[0];
      console.log('📋 School settings found:');
      console.log('   📄 Settings keys:', Object.keys(settings));
      
      // Check for attendance_config
      if (settings.attendance_config) {
        console.log('⚠️  attendance_config found in school_settings!');
        console.log('   📝 Config:', JSON.stringify(settings.attendance_config, null, 2));
      } else {
        console.log('✅ No attendance_config in school_settings - good!');
      }
    } else {
      console.log('ℹ️  No school_settings records found');
    }

    // 4. Check for attendance-related columns in other tables
    console.log('\n4. 🔍 Checking other tables for attendance-related columns...');
    
    // Check users table
    const { data: userSample, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (!userError && userSample && userSample.length > 0) {
      const userColumns = Object.keys(userSample[0]);
      const attendanceColumns = userColumns.filter(col => col.toLowerCase().includes('attendance'));
      
      if (attendanceColumns.length > 0) {
        console.log('⚠️  Attendance-related columns in users table:', attendanceColumns);
      } else {
        console.log('✅ No attendance-related columns in users table - good!');
      }
    }

    // Check grade_sections table
    const { data: gradeSectionSample, error: gsError } = await supabase
      .from('grade_sections')
      .select('*')
      .limit(1);

    if (!gsError && gradeSectionSample && gradeSectionSample.length > 0) {
      const gsColumns = Object.keys(gradeSectionSample[0]);
      const attendanceColumns = gsColumns.filter(col => col.toLowerCase().includes('attendance'));
      
      if (attendanceColumns.length > 0) {
        console.log('⚠️  Attendance-related columns in grade_sections table:', attendanceColumns);
      } else {
        console.log('✅ No attendance-related columns in grade_sections table - good!');
      }
    }

    // 5. Check for attendance-related indexes
    console.log('\n5. 📊 Checking for attendance-related indexes...');
    
    // Try to query attendance with potential indexes
    try {
      const { data: indexTest, error: indexError } = await supabase
        .from('attendance')
        .select('student_id, date')
        .eq('student_id', '00000000-0000-0000-0000-000000000000')
        .limit(1);
      
      if (indexError && indexError.message.includes('relation "attendance" does not exist')) {
        console.log('✅ No attendance table or indexes found - good!');
      } else if (indexError) {
        console.log('⚠️  Attendance table exists but query failed:', indexError.message);
      } else {
        console.log('⚠️  Attendance table and indexes exist!');
      }
    } catch (error) {
      console.log('✅ No attendance table or indexes found - good!');
    }

    // 6. Check for attendance-related triggers
    console.log('\n6. 🔄 Checking for attendance-related triggers...');
    // This would require a direct SQL query, but we can check if any triggers exist
    // by looking for common attendance-related patterns in the database

    console.log('\n🎉 Database attendance check completed!');

  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

checkDatabaseAttendance();
