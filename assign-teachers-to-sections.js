const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function assignTeachersToSections() {
  console.log('👨‍🏫 Assigning Teachers to Grade Sections...\n');

  try {
    // 1. Get all teachers
    console.log('1. 📚 Getting teachers...');
    const { data: teachers, error: teachersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'teacher')
      .eq('status', 'active');

    if (teachersError) {
      console.log('❌ Error getting teachers:', teachersError.message);
      return;
    }

    console.log(`✅ Found ${teachers.length} teachers`);
    if (teachers.length === 0) {
      console.log('❌ No teachers found. Please create teacher accounts first.');
      return;
    }

    console.log('📝 Teachers:', teachers.map(t => `${t.first_name} ${t.last_name} (${t.email})`));

    // 2. Get all grade sections
    console.log('\n2. 📚 Getting grade sections...');
    const { data: gradeSections, error: gsError } = await supabase
      .from('grade_sections')
      .select('id, name, grade_level, section, teacher_id')
      .eq('is_active', true);

    if (gsError) {
      console.log('❌ Error getting grade sections:', gsError.message);
      return;
    }

    console.log(`✅ Found ${gradeSections.length} grade sections`);
    console.log('📝 Grade sections:', gradeSections.map(gs => `${gs.name} (Teacher: ${gs.teacher_id ? 'Assigned' : 'None'})`));

    // 3. Assign teachers to grade sections
    console.log('\n3. 🔗 Assigning teachers...');
    
    const assignments = [];
    
    // Simple assignment: assign teachers in order to grade sections
    for (let i = 0; i < gradeSections.length; i++) {
      const gradeSection = gradeSections[i];
      const teacher = teachers[i % teachers.length]; // Cycle through teachers
      
      if (!gradeSection.teacher_id) {
        assignments.push({
          gradeSectionId: gradeSection.id,
          gradeSectionName: gradeSection.name,
          teacherId: teacher.id,
          teacherName: `${teacher.first_name} ${teacher.last_name}`
        });
      }
    }

    if (assignments.length === 0) {
      console.log('✅ All grade sections already have teachers assigned');
      return;
    }

    console.log(`📝 Will assign ${assignments.length} teachers to grade sections:`);
    assignments.forEach(assignment => {
      console.log(`   ${assignment.gradeSectionName} → ${assignment.teacherName}`);
    });

    // 4. Update grade sections with teacher assignments
    console.log('\n4. 💾 Updating grade sections...');
    
    for (const assignment of assignments) {
      const { error: updateError } = await supabase
        .from('grade_sections')
        .update({ teacher_id: assignment.teacherId })
        .eq('id', assignment.gradeSectionId);

      if (updateError) {
        console.log(`❌ Error assigning ${assignment.teacherName} to ${assignment.gradeSectionName}:`, updateError.message);
      } else {
        console.log(`✅ Assigned ${assignment.teacherName} to ${assignment.gradeSectionName}`);
      }
    }

    // 5. Verify assignments
    console.log('\n5. ✅ Verifying assignments...');
    const { data: updatedGradeSections, error: verifyError } = await supabase
      .from('grade_sections')
      .select('id, name, teacher_id, users!grade_sections_teacher_id_fkey(first_name, last_name)')
      .eq('is_active', true);

    if (verifyError) {
      console.log('❌ Error verifying assignments:', verifyError.message);
    } else {
      console.log('📝 Current assignments:');
      updatedGradeSections.forEach(gs => {
        const teacherName = gs.users ? `${gs.users.first_name} ${gs.users.last_name}` : 'None';
        console.log(`   ${gs.name} → ${teacherName}`);
      });
    }

    console.log('\n🎉 Teacher assignment completed!');
    console.log('💡 Teachers can now mark attendance for their assigned grade sections.');

  } catch (error) {
    console.error('❌ Script error:', error.message);
  }
}

// Run the assignment
assignTeachersToSections();

