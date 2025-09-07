const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get all grade sections with their student counts
 */
async function getSectionsWithCounts() {
  console.log('📊 [SECTIONS COUNT] Fetching all grade sections with student counts...\n');
  
  try {
    // Query to get grade sections with student counts
    const { data: sections, error } = await supabase
      .from('grade_sections')
      .select(`
        id,
        name,
        grade_level,
        section,
        academic_year,
        is_active,
        student_enrollments(count)
      `)
      .eq('is_active', true)
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true });

    if (error) {
      console.error('❌ Error fetching sections:', error);
      return;
    }

    if (!sections || sections.length === 0) {
      console.log('📋 No grade sections found');
      return;
    }

    console.log(`✅ Found ${sections.length} grade sections\n`);
    
    // Display results in a formatted table
    console.log('📚 GRADE SECTIONS WITH STUDENT COUNTS:');
    console.log('=' .repeat(70));
    console.log('| Grade | Section    | Name                    | Students |');
    console.log('|-------|------------|-------------------------|----------|');
    
    let totalStudents = 0;
    
    sections.forEach(section => {
      const studentCount = section.student_enrollments[0]?.count || 0;
      totalStudents += studentCount;
      
      const grade = `${section.grade_level}`.padEnd(5);
      const sectionName = (section.section || 'A').padEnd(10);
      const name = (section.name || '').padEnd(23);
      const count = studentCount.toString().padStart(8);
      
      console.log(`| ${grade} | ${sectionName} | ${name} | ${count} |`);
    });
    
    console.log('=' .repeat(70));
    console.log(`📊 SUMMARY: ${sections.length} sections, ${totalStudents} total students`);
    
    // Group by grade level
    console.log('\n📈 BREAKDOWN BY GRADE:');
    const gradeGroups = {};
    
    sections.forEach(section => {
      const grade = section.grade_level;
      if (!gradeGroups[grade]) {
        gradeGroups[grade] = { sections: 0, students: 0 };
      }
      gradeGroups[grade].sections++;
      gradeGroups[grade].students += section.student_enrollments[0]?.count || 0;
    });
    
    Object.keys(gradeGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(grade => {
        const group = gradeGroups[grade];
        console.log(`   Grade ${grade}: ${group.sections} sections, ${group.students} students`);
      });

    return {
      sections,
      totalSections: sections.length,
      totalStudents,
      gradeGroups
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Alternative query using raw SQL for more detailed stats
 */
async function getSectionsWithDetailedCounts() {
  console.log('\n🔍 [DETAILED QUERY] Getting sections with detailed student enrollment data...\n');
  
  try {
    const { data, error } = await supabase.rpc('get_sections_with_student_counts');
    
    if (error) {
      // If the function doesn't exist, use a direct query
      console.log('📝 Using direct SQL query...');
      
      const { data: queryData, error: queryError } = await supabase
        .from('grade_sections')
        .select(`
          id,
          name,
          grade_level,
          section,
          academic_year,
          created_at,
          student_enrollments!inner(
            student_id,
            users!inner(
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('is_active', true);
        
      if (queryError) {
        console.error('❌ Query error:', queryError);
        return;
      }
      
      // Process the data to count students per section
      const sectionCounts = {};
      
      queryData.forEach(section => {
        const sectionId = section.id;
        if (!sectionCounts[sectionId]) {
          sectionCounts[sectionId] = {
            ...section,
            student_count: 0,
            students: []
          };
        }
        
        if (section.student_enrollments && section.student_enrollments.length > 0) {
          sectionCounts[sectionId].student_count = section.student_enrollments.length;
          sectionCounts[sectionId].students = section.student_enrollments.map(enrollment => 
            enrollment.users ? `${enrollment.users.first_name} ${enrollment.users.last_name}`.trim() : 'Unknown'
          );
        }
      });
      
      console.log('📋 DETAILED SECTION BREAKDOWN:');
      Object.values(sectionCounts).forEach(section => {
        console.log(`\n🏫 ${section.name} (Grade ${section.grade_level} ${section.section})`);
        console.log(`   👥 Students: ${section.student_count}`);
        if (section.students.length > 0) {
          console.log(`   📝 Names: ${section.students.slice(0, 5).join(', ')}${section.students.length > 5 ? '...' : ''}`);
        }
      });
      
      return sectionCounts;
    }
    
  } catch (error) {
    console.error('❌ Detailed query error:', error.message);
  }
}

// Run the script if executed directly
if (require.main === module) {
  console.log('🚀 [SECTIONS COUNT] Starting grade sections analysis...\n');
  
  getSectionsWithCounts()
    .then(() => {
      console.log('\n✅ [SECTIONS COUNT] Analysis completed!');
    })
    .catch(console.error);
}

module.exports = {
  getSectionsWithCounts,
  getSectionsWithDetailedCounts
};