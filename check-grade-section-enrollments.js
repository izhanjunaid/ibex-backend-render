const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGradeSectionEnrollments() {
  console.log('🔍 Checking Grade Section Enrollments...\n');

  try {
    // 1. Get all grade sections with teacher info
    console.log('1. 📚 Getting all grade sections...');
    const { data: gradeSections, error: gsError } = await supabase
      .from('grade_sections')
      .select(`
        id, 
        name, 
        grade_level, 
        section, 
        teacher_id,
        users!grade_sections_teacher_id_fkey(first_name, last_name)
      `)
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    if (gsError) {
      console.log('❌ Error fetching grade sections:', gsError.message);
      return;
    }

    console.log(`✅ Found ${gradeSections.length} active grade sections\n`);

    // 2. Get enrollment counts for each grade section
    console.log('2. 📊 Getting enrollment counts...');
    const enrollmentData = [];

    for (const gradeSection of gradeSections) {
      const { data: enrollments, error: enrollError } = await supabase
        .from('grade_section_enrollments')
        .select('student_id')
        .eq('grade_section_id', gradeSection.id)
        .eq('status', 'active');

      if (enrollError) {
        console.log(`❌ Error fetching enrollments for ${gradeSection.name}:`, enrollError.message);
        continue;
      }

      const teacherName = gradeSection.users ? 
        `${gradeSection.users.first_name} ${gradeSection.users.last_name}` : 
        'No teacher assigned';

      enrollmentData.push({
        id: gradeSection.id,
        name: gradeSection.name,
        grade_level: gradeSection.grade_level,
        section: gradeSection.section,
        teacher_name: teacherName,
        student_count: enrollments.length
      });
    }

    // 3. Display results
    console.log('📋 Grade Section Enrollment Summary:\n');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Grade Section                    │ Teacher              │ Students │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    let totalStudents = 0;
    enrollmentData.forEach(gs => {
      const name = gs.name.padEnd(30);
      const teacher = gs.teacher_name.padEnd(20);
      const count = gs.student_count.toString().padStart(8);
      console.log(`│ ${name} │ ${teacher} │ ${count} │`);
      totalStudents += gs.student_count;
    });

    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│ Total Students Enrolled: ${totalStudents.toString().padStart(47)} │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────┘');

    // 4. Get total students in system
    console.log('\n4. 👥 Checking total students in system...');
    const { data: allStudents, error: studentsError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('status', 'active');

    if (studentsError) {
      console.log('❌ Error fetching students:', studentsError.message);
    } else {
      console.log(`✅ Total active students in system: ${allStudents.length}`);
      console.log(`📊 Students enrolled in grade sections: ${totalStudents}`);
      console.log(`📊 Students NOT enrolled: ${allStudents.length - totalStudents}`);
    }

    // 5. Show grade sections with most students
    console.log('\n5. 🏆 Top Grade Sections by Enrollment:');
    const sortedByEnrollment = enrollmentData
      .sort((a, b) => b.student_count - a.student_count)
      .slice(0, 10);

    sortedByEnrollment.forEach((gs, index) => {
      console.log(`   ${index + 1}. ${gs.name} - ${gs.student_count} students (${gs.teacher_name})`);
    });

    // 6. Show grade sections with no students
    console.log('\n6. ⚠️ Grade Sections with No Students:');
    const emptySections = enrollmentData.filter(gs => gs.student_count === 0);
    
    if (emptySections.length === 0) {
      console.log('   ✅ All grade sections have at least one student enrolled');
    } else {
      emptySections.forEach(gs => {
        console.log(`   - ${gs.name} (${gs.teacher_name})`);
      });
    }

    // 7. Show grade sections with no teachers
    console.log('\n7. ⚠️ Grade Sections with No Teachers:');
    const noTeacherSections = enrollmentData.filter(gs => gs.teacher_name === 'No teacher assigned');
    
    if (noTeacherSections.length === 0) {
      console.log('   ✅ All grade sections have teachers assigned');
    } else {
      noTeacherSections.forEach(gs => {
        console.log(`   - ${gs.name} (${gs.student_count} students)`);
      });
    }

    console.log('\n🎯 Summary:');
    console.log(`- Total Grade Sections: ${gradeSections.length}`);
    console.log(`- Total Students Enrolled: ${totalStudents}`);
    console.log(`- Average Students per Section: ${(totalStudents / gradeSections.length).toFixed(1)}`);
    console.log(`- Sections with Students: ${enrollmentData.filter(gs => gs.student_count > 0).length}`);
    console.log(`- Sections with Teachers: ${enrollmentData.filter(gs => gs.teacher_name !== 'No teacher assigned').length}`);

  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

// Run the check
checkGradeSectionEnrollments();

