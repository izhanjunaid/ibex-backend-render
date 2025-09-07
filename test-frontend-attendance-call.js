const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFrontendAttendanceCall() {
  console.log('🧪 Testing Frontend Attendance API Call...\n');

  try {
    // 1. Get a teacher user for testing
    console.log('1. 👨‍🏫 Getting a teacher user...');
    const { data: teachers, error: teachersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'teacher')
      .eq('status', 'active')
      .limit(1);

    if (teachersError || !teachers.length) {
      console.log('❌ No teachers found');
      return;
    }

    const teacher = teachers[0];
    console.log(`✅ Using teacher: ${teacher.first_name} ${teacher.last_name}`);

    // 2. Get grade sections assigned to this teacher
    console.log('\n2. 📚 Getting grade sections for teacher...');
    const { data: gradeSections, error: gsError } = await supabase
      .from('grade_sections')
      .select('id, name, grade_level, section')
      .eq('teacher_id', teacher.id)
      .eq('is_active', true);

    if (gsError || !gradeSections.length) {
      console.log('❌ No grade sections found for this teacher');
      return;
    }

    console.log(`✅ Found ${gradeSections.length} grade sections for teacher`);
    gradeSections.forEach((gs, index) => {
      console.log(`   ${index + 1}. ${gs.name} (ID: ${gs.id})`);
    });

    // 3. Test each grade section to see if students are found
    console.log('\n3. 👥 Testing each grade section for students...');
    const today = new Date().toISOString().split('T')[0];
    
    for (const gradeSection of gradeSections) {
      console.log(`\n📚 Testing Grade Section: ${gradeSection.name}`);
      
      // Test the database function directly
      const { data: students, error: studentsError } = await supabase
        .rpc('get_grade_section_attendance_students', {
          grade_section_uuid: gradeSection.id,
          attendance_date: today
        });

      if (studentsError) {
        console.log(`❌ Error for ${gradeSection.name}:`, studentsError.message);
      } else {
        console.log(`✅ ${gradeSection.name}: Found ${students.length} students`);
        if (students.length > 0) {
          console.log('📝 Sample students:');
          students.slice(0, 3).forEach((student, index) => {
            console.log(`   ${index + 1}. ${student.first_name} ${student.last_name} - Status: ${student.attendance_status || 'Not marked'}`);
          });
        } else {
          console.log('⚠️  No students found - this might be the issue!');
          
          // Check if there are any students enrolled in this grade section
          const { data: enrolledStudents, error: enrolledError } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .eq('role', 'student')
            .eq('status', 'active')
            .eq('grade_section_id', gradeSection.id);

          if (enrolledError) {
            console.log(`❌ Error checking enrolled students:`, enrolledError.message);
          } else {
            console.log(`📊 Enrolled students in ${gradeSection.name}: ${enrolledStudents.length}`);
            if (enrolledStudents.length > 0) {
              console.log('📝 Enrolled students:');
              enrolledStudents.slice(0, 3).forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}`);
              });
            }
          }
        }
      }
    }

    // 4. Test the Express.js route simulation
    console.log('\n4. 🌐 Testing Express.js route simulation...');
    console.log('   This simulates what the frontend would call:');
    console.log(`   GET /api/attendance?grade_section_id=${gradeSections[0].id}&date=${today}`);
    
    // Simulate the Express.js route logic
    const testGradeSection = gradeSections[0];
    const { data: routeStudents, error: routeError } = await supabase
      .rpc('get_grade_section_attendance_students', {
        grade_section_uuid: testGradeSection.id,
        attendance_date: today
      });

    if (routeError) {
      console.log('❌ Route simulation error:', routeError.message);
    } else {
      console.log(`✅ Route simulation: Found ${routeStudents.length} students`);
      console.log('📝 Response structure:');
      if (routeStudents.length > 0) {
        console.log(JSON.stringify(routeStudents[0], null, 2));
      }
    }

    console.log('\n🎉 Frontend attendance call test completed!');
    console.log('💡 Check the results above to see if students are being found correctly.');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

// Run the test
testFrontendAttendanceCall();
