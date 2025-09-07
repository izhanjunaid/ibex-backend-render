const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSimpleSectionCounts() {
  console.log('📊 Getting Grade Section Student Counts...\n');
  
  try {
    // Get all grade sections
    const { data: sections, error: sectionsError } = await supabase
      .from('grade_sections')
      .select('id, name, grade_level, section')
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    if (sectionsError) {
      console.error('❌ Error fetching sections:', sectionsError);
      return;
    }

    console.log(`Found ${sections.length} grade sections\n`);
    
    // Get student counts for each section
    const results = [];
    
    for (const section of sections) {
      const { count, error: countError } = await supabase
        .from('grade_section_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('grade_section_id', section.id);
        
      if (countError) {
        console.error(`❌ Error counting students for ${section.name}:`, countError);
        continue;
      }
      
      results.push({
        name: section.name,
        grade: section.grade_level,
        section: section.section,
        students: count || 0
      });
    }
    
    // Display results
    console.log('📚 GRADE SECTIONS WITH STUDENT COUNTS:');
    console.log('='.repeat(60));
    
    let totalStudents = 0;
    results.forEach(result => {
      totalStudents += result.students;
      console.log(`${result.name.padEnd(25)} | ${result.students.toString().padStart(3)} students`);
    });
    
    console.log('='.repeat(60));
    console.log(`📊 TOTAL: ${results.length} sections, ${totalStudents} students`);
    
    // Summary by grade
    console.log('\n📈 BY GRADE LEVEL:');
    const gradeGroups = {};
    results.forEach(result => {
      const grade = result.grade;
      if (!gradeGroups[grade]) {
        gradeGroups[grade] = { sections: 0, students: 0 };
      }
      gradeGroups[grade].sections++;
      gradeGroups[grade].students += result.students;
    });
    
    Object.keys(gradeGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(grade => {
        const group = gradeGroups[grade];
        const gradeName = grade == 0 ? 'Pre-School' : `Grade ${grade}`;
        console.log(`   ${gradeName.padEnd(12)} | ${group.sections} sections, ${group.students} students`);
      });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  getSimpleSectionCounts().then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  }).catch(console.error);
}

module.exports = { getSimpleSectionCounts };