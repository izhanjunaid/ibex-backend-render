const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStudentData() {
  console.log('🔍 Checking Student Data and Enrollments...\n');
  
  try {
    // Check total users with student role
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');
      
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }
    
    console.log(`👥 Total students in users table: ${userCount || 0}`);
    
    // Check student_enrollments table
    const { count: enrollmentCount, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('*', { count: 'exact', head: true });
      
    if (enrollmentError) {
      console.error('❌ Error fetching enrollments:', enrollmentError);
      return;
    }
    
    console.log(`📝 Total records in student_enrollments: ${enrollmentCount || 0}`);
    
    // Get a few sample students
    const { data: sampleStudents, error: sampleError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .eq('role', 'student')
      .limit(5);
      
    if (sampleError) {
      console.error('❌ Error fetching sample students:', sampleError);
      return;
    }
    
    console.log('\n👨‍🎓 Sample students:');
    sampleStudents?.forEach(student => {
      console.log(`   ${student.first_name} ${student.last_name} (${student.email})`);
    });
    
    // Check if there are any enrollment records
    const { data: sampleEnrollments, error: enrollmentSampleError } = await supabase
      .from('student_enrollments')
      .select('student_id, grade_section_id')
      .limit(5);
      
    if (enrollmentSampleError) {
      console.error('❌ Error fetching sample enrollments:', enrollmentSampleError);
      return;
    }
    
    console.log(`\n📋 Sample enrollments: ${sampleEnrollments?.length || 0} records`);
    
    // Check the structure of the student_enrollments table
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'student_enrollments' })
      .limit(1);
      
    if (tableError) {
      console.log('📊 Unable to get table structure, checking with a sample query...');
      
      // Try to see what columns exist by selecting one record
      const { data: oneRecord, error: oneError } = await supabase
        .from('student_enrollments')
        .select('*')
        .limit(1);
        
      if (oneError) {
        console.error('❌ Error checking table structure:', oneError);
      } else {
        console.log('📊 student_enrollments table columns:', Object.keys(oneRecord?.[0] || {}));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  checkStudentData().then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  }).catch(console.error);
}

module.exports = { checkStudentData };