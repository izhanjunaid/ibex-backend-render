const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupDatabaseAttendance() {
  console.log('🧹 Cleaning up Database Attendance Items...\n');

  try {
    // 1. First, let's see what we're dealing with
    console.log('1. 📊 Current attendance data...');
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*');

    if (attendanceError) {
      console.log('❌ Error accessing attendance table:', attendanceError.message);
      return;
    }

    console.log(`   📊 Found ${attendanceData.length} attendance records`);
    
    if (attendanceData.length > 0) {
      console.log('   📝 Sample records:');
      attendanceData.slice(0, 3).forEach((record, index) => {
        console.log(`      ${index + 1}. Student: ${record.student_id}, Date: ${record.date}, Status: ${record.status}`);
      });
    }

    // 2. Delete all attendance records
    console.log('\n2. 🗑️  Deleting all attendance records...');
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (deleteError) {
      console.log('❌ Error deleting attendance records:', deleteError.message);
    } else {
      console.log('✅ All attendance records deleted successfully');
    }

    // 3. Drop the attendance table
    console.log('\n3. 🗑️  Dropping attendance table...');
    const { error: dropTableError } = await supabase
      .rpc('drop_attendance_table');

    if (dropTableError) {
      console.log('❌ Error dropping attendance table:', dropTableError.message);
      console.log('   💡 This might be because the function doesn\'t exist or we need to drop it manually');
    } else {
      console.log('✅ Attendance table dropped successfully');
    }

    // 4. Drop attendance-related functions
    console.log('\n4. 🗑️  Dropping attendance functions...');
    
    // Drop get_grade_section_attendance_students function
    const { error: dropStudentsFuncError } = await supabase
      .rpc('drop_attendance_students_function');

    if (dropStudentsFuncError) {
      console.log('❌ Error dropping get_grade_section_attendance_students function:', dropStudentsFuncError.message);
    } else {
      console.log('✅ get_grade_section_attendance_students function dropped');
    }

    // Drop get_grade_section_attendance_stats function
    const { error: dropStatsFuncError } = await supabase
      .rpc('drop_attendance_stats_function');

    if (dropStatsFuncError) {
      console.log('❌ Error dropping get_grade_section_attendance_stats function:', dropStatsFuncError.message);
    } else {
      console.log('✅ get_grade_section_attendance_stats function dropped');
    }

    // 5. Verify cleanup
    console.log('\n5. ✅ Verifying cleanup...');
    
    // Check if attendance table still exists
    const { data: verifyTable, error: verifyTableError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);

    if (verifyTableError && verifyTableError.message.includes('relation "attendance" does not exist')) {
      console.log('✅ Attendance table successfully removed');
    } else if (verifyTableError) {
      console.log('⚠️  Attendance table still exists but has error:', verifyTableError.message);
    } else {
      console.log('⚠️  Attendance table still exists!');
    }

    // Check if functions still exist
    try {
      const { error: funcError } = await supabase
        .rpc('get_grade_section_attendance_students', {
          grade_section_uuid: '00000000-0000-0000-0000-000000000000',
          attendance_date: '2025-01-01'
        });
      
      if (funcError && funcError.message.includes('function "get_grade_section_attendance_students" does not exist')) {
        console.log('✅ get_grade_section_attendance_students function successfully removed');
      } else {
        console.log('⚠️  get_grade_section_attendance_students function still exists');
      }
    } catch (error) {
      console.log('✅ get_grade_section_attendance_students function successfully removed');
    }

    try {
      const { error: statsError } = await supabase
        .rpc('get_grade_section_attendance_stats', {
          grade_section_uuid: '00000000-0000-0000-0000-000000000000',
          start_date: '2025-01-01',
          end_date: '2025-01-31'
        });
      
      if (statsError && statsError.message.includes('function "get_grade_section_attendance_stats" does not exist')) {
        console.log('✅ get_grade_section_attendance_stats function successfully removed');
      } else {
        console.log('⚠️  get_grade_section_attendance_stats function still exists');
      }
    } catch (error) {
      console.log('✅ get_grade_section_attendance_stats function successfully removed');
    }

    console.log('\n🎉 Database attendance cleanup completed!');

  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

cleanupDatabaseAttendance();
