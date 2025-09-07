const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGradeSectionEnrollmentsTable() {
  console.log('🔍 Checking Grade Section Enrollments Table...\n');

  try {
    // 1. Check if the table exists and get its structure
    console.log('1. 📋 Checking table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('grade_section_enrollments')
      .select('*')
      .limit(1);

    if (tableError) {
      console.log('❌ Error accessing grade_section_enrollments table:', tableError.message);
      return;
    }

    console.log('✅ grade_section_enrollments table exists');

    // 2. Get total enrollments
    console.log('\n2. 📊 Getting total enrollments...');
    const { data: allEnrollments, error: enrollError } = await supabase
      .from('grade_section_enrollments')
      .select('*');

    if (enrollError) {
      console.log('❌ Error fetching enrollments:', enrollError.message);
      return;
    }

    console.log(`✅ Total enrollments: ${allEnrollments.length}`);

    // 3. Get enrollments by status
    const activeEnrollments = allEnrollments.filter(e => e.status === 'active');
    const inactiveEnrollments = allEnrollments.filter(e => e.status !== 'active');
    
    console.log(`📈 Active enrollments: ${activeEnrollments.length}`);
    console.log(`📉 Inactive enrollments: ${inactiveEnrollments.length}`);

    // 4. Get enrollments by grade section
    console.log('\n3. 📚 Enrollments by Grade Section:');
    const enrollmentsBySection = {};
    
    activeEnrollments.forEach(enrollment => {
      if (!enrollmentsBySection[enrollment.grade_section_id]) {
        enrollmentsBySection[enrollment.grade_section_id] = [];
      }
      enrollmentsBySection[enrollment.grade_section_id].push(enrollment);
    });

    // Get grade section names
    const { data: gradeSections, error: gsError } = await supabase
      .from('grade_sections')
      .select('id, name, grade_level, section');

    if (gsError) {
      console.log('❌ Error fetching grade sections:', gsError.message);
      return;
    }

    const gradeSectionMap = {};
    gradeSections.forEach(gs => {
      gradeSectionMap[gs.id] = gs;
    });

    Object.keys(enrollmentsBySection).forEach(gradeSectionId => {
      const gradeSection = gradeSectionMap[gradeSectionId];
      const count = enrollmentsBySection[gradeSectionId].length;
      const name = gradeSection ? gradeSection.name : `Unknown (${gradeSectionId})`;
      console.log(`   📚 ${name}: ${count} students`);
    });



    // 5. Check for any orphaned enrollments (students that don't exist)
    console.log('\n4. 🔍 Checking for orphaned enrollments...');
    const studentIds = [...new Set(allEnrollments.map(e => e.student_id))];
    
    const { data: existingStudents, error: studentsError } = await supabase
      .from('users')
      .select('id')
      .in('id', studentIds);

    if (studentsError) {
      console.log('❌ Error checking students:', studentsError.message);
    } else {
      const existingStudentIds = existingStudents.map(s => s.id);
      const orphanedEnrollments = allEnrollments.filter(e => !existingStudentIds.includes(e.student_id));
      
      console.log(`📊 Total unique students in enrollments: ${studentIds.length}`);
      console.log(`📊 Existing students: ${existingStudents.length}`);
      console.log(`⚠️  Orphaned enrollments: ${orphanedEnrollments.length}`);
      
      if (orphanedEnrollments.length > 0) {
        console.log('📝 Orphaned student IDs:');
        orphanedEnrollments.slice(0, 5).forEach((enrollment, index) => {
          console.log(`   ${index + 1}. ${enrollment.student_id}`);
        });
      }
    }

    console.log('\n🎉 Grade section enrollments check completed!');

  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

// Run the check
checkGradeSectionEnrollmentsTable();
