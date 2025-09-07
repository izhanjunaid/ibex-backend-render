require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAttendanceAPI() {
  console.log('🔍 Testing attendance API call that frontend would make...\n');
  
  try {
    // Test the exact same call the frontend would make
    const gradeSectionId = '64d9297d-939a-40d3-ab39-65144f7e4abe'; // Grade 2 Crimson
    const date = new Date().toISOString().split('T')[0]; // Today's date
    
    console.log('Testing with:');
    console.log('  Grade Section ID:', gradeSectionId);
    console.log('  Date:', date);
    console.log();
    
    // Simulate the API call that would happen in routes/attendance.js
    console.log('1. Checking grade section exists...');
    const { data: gradeSection, error: gsError } = await supabase
      .from('grade_sections')
      .select('*')
      .eq('id', gradeSectionId)
      .single();
    
    if (gsError || !gradeSection) {
      console.error('❌ Grade section not found:', gsError);
      return;
    }
    
    console.log('✅ Grade section found:', gradeSection.name);
    console.log('   Teacher ID:', gradeSection.teacher_id);
    console.log('   Is Active:', gradeSection.is_active);
    console.log();
    
    // Check enrollments
    console.log('2. Checking enrollments...');
    const { data: enrollments, error: enrollError } = await supabase
      .from('grade_section_enrollments')
      .select('student_id, status')
      .eq('grade_section_id', gradeSectionId)
      .eq('status', 'active');
    
    if (enrollError) {
      console.error('❌ Error checking enrollments:', enrollError);
      return;
    }
    
    console.log('✅ Found', enrollments?.length || 0, 'active enrollments');
    console.log();
    
    // Call the database function directly
    console.log('3. Calling get_grade_section_attendance function...');
    const { data: students, error: studentsError } = await supabase
      .rpc('get_grade_section_attendance', {
        p_grade_section_id: gradeSectionId,
        p_date: date
      });
    
    if (studentsError) {
      console.error('❌ Error calling function:', studentsError);
      return;
    }
    
    console.log('✅ Function returned:', students?.length || 0, 'students');
    
    if (students?.length > 0) {
      console.log('   First 3 students:');
      students.slice(0, 3).forEach(student => {
        console.log(`     - ${student.first_name} ${student.last_name} (${student.status})`);
      });
      
      // Calculate stats like the API does
      const stats = students.reduce((acc, student) => {
        acc.total++;
        acc[student.status] = (acc[student.status] || 0) + 1;
        return acc;
      }, {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        unmarked: 0
      });
      
      console.log();
      console.log('📊 Statistics that would be returned:');
      console.log('   Total:', stats.total);
      console.log('   Present:', stats.present);
      console.log('   Absent:', stats.absent);
      console.log('   Late:', stats.late);
      console.log('   Excused:', stats.excused);
      console.log('   Unmarked:', stats.unmarked);
      
      console.log();
      console.log('🎯 CONCLUSION: The API should work correctly!');
      console.log('   The issue might be:');
      console.log('   1. Frontend is calling with wrong grade_section_id');
      console.log('   2. Frontend is calling with wrong date');
      console.log('   3. User authentication/permission issue');
      console.log('   4. Frontend is calling wrong endpoint');
      
    } else {
      console.log('❌ No students returned despite enrollments existing');
      console.log('   This suggests an issue with the database function logic');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAttendanceAPI();


