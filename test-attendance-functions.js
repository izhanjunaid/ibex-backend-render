const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAttendanceFunctions() {
  console.log('🧪 Testing Attendance Functions Directly...\n');

  try {
    // 1. Get a test grade section
    console.log('1. 📚 Getting test grade section...');
    const { data: gradeSections, error: gsError } = await supabase
      .from('grade_sections')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (gsError || !gradeSections.length) {
      console.log('❌ No grade sections found');
      return;
    }

    const testGradeSection = gradeSections[0];
    console.log('✅ Test grade section:', testGradeSection.name);

    // 2. Test get_grade_section_attendance function
    console.log('\n2. 📚 Testing get_grade_section_attendance function...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data: students, error } = await supabase
        .rpc('get_grade_section_attendance', {
          p_grade_section_id: testGradeSection.id,
          p_date: today
        });

      if (error) {
        console.log('❌ Error:', error.message);
        console.log('Error details:', error);
      } else {
        console.log('✅ Function working! Found', students.length, 'students');
        if (students.length > 0) {
          console.log('Sample student:', students[0]);
        }
      }
    } catch (err) {
      console.log('❌ Exception:', err.message);
    }

    // 3. Test get_attendance_stats function
    console.log('\n3. 📊 Testing get_attendance_stats function...');
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      const { data: stats, error } = await supabase
        .rpc('get_attendance_stats', {
          p_grade_section_id: testGradeSection.id,
          p_start_date: startDate,
          p_end_date: today
        });

      if (error) {
        console.log('❌ Error:', error.message);
        console.log('Error details:', error);
      } else {
        console.log('✅ Function working! Found', stats.length, 'days of stats');
        if (stats.length > 0) {
          console.log('Sample stats:', stats[0]);
        }
      }
    } catch (err) {
      console.log('❌ Exception:', err.message);
    }

    // 4. Test bulk_mark_attendance function
    console.log('\n4. ✅ Testing bulk_mark_attendance function...');
    
    // First get a student
    const { data: enrollments } = await supabase
      .from('grade_section_enrollments')
      .select('student_id')
      .eq('grade_section_id', testGradeSection.id)
      .eq('status', 'active')
      .limit(1);

    if (enrollments && enrollments.length > 0) {
      const testStudentId = enrollments[0].student_id;
      
      try {
        // Get a real user ID for marked_by
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'teacher')
          .limit(1);
        
        const markedBy = users && users.length > 0 ? users[0].id : null;
        
        const { data: result, error } = await supabase
          .rpc('bulk_mark_attendance', {
            p_grade_section_id: testGradeSection.id,
            p_date: today,
            p_attendance_records: [{
              student_id: testStudentId,
              status: 'present',
              notes: 'Test attendance'
            }],
            p_marked_by: markedBy
          });

        if (error) {
          console.log('❌ Error:', error.message);
          console.log('Error details:', error);
        } else {
          console.log('✅ Function working! Result:', result);
        }
      } catch (err) {
        console.log('❌ Exception:', err.message);
      }
    }

    console.log('\n🎉 Function testing completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testAttendanceFunctions();
