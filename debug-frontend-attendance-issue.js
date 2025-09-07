const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugFrontendAttendanceIssue() {
  console.log('🔍 Debugging Frontend Attendance Issue');
  console.log('=====================================\n');

  // From the screenshot, it looks like "Grade Pre-3 Bellflower"
  // Let's find this grade section first
  console.log('1. 🔍 Finding "Grade Pre-3 Bellflower" grade section...');
  
  const { data: gradeSections, error: gsError } = await supabase
    .from('grade_sections')
    .select('*')
    .ilike('name', '%Grade Pre-3 Bellflower%')
    .eq('is_active', true);

  if (gsError) {
    console.error('❌ Error finding grade section:', gsError);
    return;
  }

  if (!gradeSections || gradeSections.length === 0) {
    console.log('❌ No grade section found matching "Grade Pre-3 Bellflower"');
    
    // Let's see what Pre-3 sections exist
    const { data: pre3Sections } = await supabase
      .from('grade_sections')
      .select('*')
      .ilike('name', '%Pre-3%')
      .eq('is_active', true);
    
    console.log('\n📚 Available Pre-3 grade sections:');
    pre3Sections?.forEach(section => {
      console.log(`   - ${section.name} (ID: ${section.id})`);
    });
    return;
  }

  const gradeSection = gradeSections[0];
  console.log(`✅ Found grade section: ${gradeSection.name}`);
  console.log(`   ID: ${gradeSection.id}`);
  console.log(`   Teacher ID: ${gradeSection.teacher_id}`);

  // Test the exact API call that frontend makes
  const testDate = '2025-09-07'; // From the screenshot
  console.log(`\n2. 🧪 Testing API call: GET /api/attendance?grade_section_id=${gradeSection.id}&date=${testDate}`);

  // Simulate the frontend API call
  try {
    // First, test the database function directly
    const { data: students, error } = await supabase
      .rpc('get_grade_section_attendance', {
        p_grade_section_id: gradeSection.id,
        p_date: testDate
      });

    if (error) {
      console.error('❌ Database function error:', error);
      return;
    }

    console.log(`✅ Database function returned: ${students?.length || 0} students`);
    
    if (students && students.length > 0) {
      console.log('\n📋 First 3 students:');
      students.slice(0, 3).forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name} (${student.status || 'unmarked'})`);
      });

      // Calculate statistics
      const stats = {
        total: students.length,
        present: students.filter(s => s.status === 'present').length,
        absent: students.filter(s => s.status === 'absent').length,
        late: students.filter(s => s.status === 'late').length,
        excused: students.filter(s => s.status === 'excused').length,
        unmarked: students.filter(s => s.status === 'unmarked' || !s.status).length
      };

      console.log('\n📊 Statistics:');
      console.log(`   Total: ${stats.total}`);
      console.log(`   Present: ${stats.present}`);
      console.log(`   Absent: ${stats.absent}`);
      console.log(`   Late: ${stats.late}`);
      console.log(`   Excused: ${stats.excused}`);
      console.log(`   Unmarked: ${stats.unmarked}`);

    } else {
      console.log('❌ No students returned from database function');
      
      // Let's check enrollments directly
      console.log('\n3. 🔍 Checking enrollments directly...');
      const { data: enrollments, error: enrollError } = await supabase
        .from('grade_section_enrollments')
        .select(`
          *,
          student:users!grade_section_enrollments_student_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('grade_section_id', gradeSection.id)
        .eq('status', 'active');

      if (enrollError) {
        console.error('❌ Error checking enrollments:', enrollError);
      } else {
        console.log(`✅ Found ${enrollments?.length || 0} direct enrollments`);
        if (enrollments && enrollments.length > 0) {
          console.log('\n👥 Enrolled students:');
          enrollments.slice(0, 5).forEach((enrollment, index) => {
            console.log(`   ${index + 1}. ${enrollment.student?.first_name} ${enrollment.student?.last_name}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ API test error:', error);
  }

  // Test the grade sections endpoint
  console.log('\n4. 🧪 Testing grade sections endpoint...');
  try {
    const { data: availableSections, error: sectionsError } = await supabase
      .from('grade_sections')
      .select('id, name, grade_level, section, teacher_id')
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    if (sectionsError) {
      console.error('❌ Error getting grade sections:', sectionsError);
    } else {
      console.log(`✅ Grade sections endpoint would return ${availableSections?.length || 0} sections`);
      
      // Find the Pre-3 Bellflower section
      const bellflowerSection = availableSections?.find(s => s.name.includes('Pre-3') && s.name.includes('Bellflower'));
      if (bellflowerSection) {
        console.log(`✅ Pre-3 Bellflower found in sections list: ${bellflowerSection.name}`);
        console.log(`   ID: ${bellflowerSection.id}`);
      } else {
        console.log('❌ Pre-3 Bellflower NOT found in sections list');
        console.log('\n📚 Available Pre-3 sections:');
        availableSections?.filter(s => s.name.includes('Pre-3')).forEach(section => {
          console.log(`   - ${section.name} (ID: ${section.id})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Grade sections test error:', error);
  }

  console.log('\n🎯 DIAGNOSIS:');
  console.log('=============');
  console.log('If the database function returns students but frontend shows 0:');
  console.log('1. ❌ Frontend might be using wrong grade_section_id');
  console.log('2. ❌ Frontend might be using wrong date format');
  console.log('3. ❌ Frontend might have authentication issues');
  console.log('4. ❌ Frontend might be calling wrong endpoint');
  console.log('5. ❌ Frontend might not be parsing response correctly');
  console.log('\n📋 Next Steps:');
  console.log('- Check browser network tab for actual API calls');
  console.log('- Verify the grade_section_id being sent');
  console.log('- Check if JWT token is valid');
  console.log('- Verify response parsing in frontend code');
}

debugFrontendAttendanceIssue().catch(console.error);
