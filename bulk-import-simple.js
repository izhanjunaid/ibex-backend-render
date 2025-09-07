const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Simple CSV parser (no external dependencies)
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Bulk import students from CSV file
 */
async function bulkImportStudents(csvFilePath, options = {}) {
  console.log('📚 [BULK IMPORT] Starting student bulk import...\n');
  
  const {
    defaultPassword = 'password123',
    createGradeSections = true,
    dryRun = false
  } = options;
  
  try {
    // 1. Read CSV file
    console.log('1️⃣ Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');
    const students = parseCSV(csvContent);
    
    console.log(`✅ CSV parsed: ${students.length} students`);
    
    if (dryRun) {
      console.log('\n🔍 [DRY RUN] Would create the following students:');
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.email}) - Grade ${student.grade_level}${student.section}`);
      });
      return;
    }
    
    // 2. Create grade sections if needed
    const gradeSections = new Map();
    if (createGradeSections) {
      console.log('\n2️⃣ Creating grade sections...');
      
      // Group students by grade section
      students.forEach(student => {
        const key = `${student.grade_level}-${student.section}-${student.academic_year}`;
        if (!gradeSections.has(key)) {
          gradeSections.set(key, {
            grade_level: parseInt(student.grade_level),
            section: student.section,
            academic_year: student.academic_year,
            school_id: student.school_id || null,
            name: `Grade ${student.grade_level} ${student.section}`,
            description: `Grade ${student.grade_level} Section ${student.section} - ${student.academic_year}`
          });
        }
      });
      
      // Create each grade section
      for (const [key, sectionData] of gradeSections) {
        try {
          // Check if grade section already exists
          const { data: existingSection } = await supabase
            .from('grade_sections')
            .select('id')
            .eq('grade_level', sectionData.grade_level)
            .eq('section', sectionData.section)
            .eq('academic_year', sectionData.academic_year)
            .single();
          
          if (!existingSection) {
            const { data: newSection, error: sectionError } = await supabase
              .from('grade_sections')
              .insert([sectionData])
              .select()
              .single();
            
            if (sectionError) {
              console.log(`❌ Error creating grade section ${sectionData.name}:`, sectionError.message);
            } else {
              console.log(`✅ Created grade section: ${sectionData.name}`);
              gradeSections.set(key, { ...sectionData, id: newSection.id });
            }
          } else {
            console.log(`⏭️ Grade section already exists: ${sectionData.name}`);
            gradeSections.set(key, { ...sectionData, id: existingSection.id });
          }
        } catch (error) {
          console.log(`❌ Error with grade section ${sectionData.name}:`, error.message);
        }
      }
    }
    
    // 3. Import students
    console.log('\n3️⃣ Importing students...');
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      console.log(`\n📝 Processing student ${i + 1}/${students.length}: ${student.first_name} ${student.last_name}`);
      
      try {
        // Check if student already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', student.email)
          .single();
        
        if (existingUser) {
          console.log(`⏭️ Student already exists: ${student.email}`);
          skipped++;
          continue;
        }
        
        // Create new user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: student.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            first_name: student.first_name,
            last_name: student.last_name,
            role: 'student'
          }
        });
        
        if (authError) {
          console.log(`❌ Error creating auth user ${student.email}:`, authError.message);
          errors++;
          continue;
        }
        
        // Create user profile in our users table
        const { data: newUser, error: profileError } = await supabase
          .from('users')
          .insert([{
            id: authUser.user.id,
            email: student.email,
            first_name: student.first_name,
            last_name: student.last_name,
            role: 'student',
            status: 'active'
          }])
          .select()
          .single();
        
        if (profileError) {
          console.log(`❌ Error creating user profile ${student.email}:`, profileError.message);
          errors++;
          continue;
        }
        
        console.log(`✅ Created student: ${student.email}`);
        created++;
        
        // 4. Enroll student in grade section
        if (createGradeSections && student.grade_level && student.section) {
          const gradeKey = `${student.grade_level}-${student.section}-${student.academic_year}`;
          const gradeSection = gradeSections.get(gradeKey);
          
          if (gradeSection && gradeSection.id) {
            try {
              const { error: enrollmentError } = await supabase
                .from('grade_section_enrollments')
                .insert([{
                  grade_section_id: gradeSection.id,
                  student_id: newUser.id,
                  status: 'active'
                }]);
              
              if (enrollmentError) {
                console.log(`❌ Error enrolling student in grade section:`, enrollmentError.message);
              } else {
                console.log(`✅ Enrolled in grade section: ${gradeSection.name}`);
              }
            } catch (error) {
              console.log(`❌ Error checking enrollment:`, error.message);
            }
          }
        }
        
      } catch (error) {
        console.log(`❌ Error processing student ${student.email}:`, error.message);
        errors++;
      }
    }
    
    // 5. Print summary
    console.log('\n📊 [IMPORT SUMMARY]');
    console.log(`Total students in CSV: ${students.length}`);
    console.log(`Students created: ${created}`);
    console.log(`Students skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Grade sections processed: ${gradeSections.size}`);
    
    console.log('\n🎉 Bulk import completed!');
    console.log(`\n💡 Students can now login with:`);
    console.log(`   Email: their email from CSV`);
    console.log(`   Password: ${defaultPassword}`);
    
  } catch (error) {
    console.error('❌ Bulk import error:', error);
  }
}

// Create sample CSV file
function createSampleCSV() {
  const sampleCSV = `email,first_name,last_name,grade_level,section,academic_year,school_id
john.doe@school.com,John,Doe,6,A,2025-2026,
jane.smith@school.com,Jane,Smith,6,A,2025-2026,
mike.johnson@school.com,Mike,Johnson,6,B,2025-2026,
sarah.wilson@school.com,Sarah,Wilson,6,B,2025-2026,
alex.brown@school.com,Alex,Brown,7,A,2025-2026,`;
  
  fs.writeFileSync('students.csv', sampleCSV);
  console.log('✅ Created sample CSV file: students.csv');
  console.log('\n📋 CSV Format:');
  console.log('email,first_name,last_name,grade_level,section,academic_year,school_id');
  console.log('john.doe@school.com,John,Doe,6,A,2025-2026,');
}

// Example usage
async function runExample() {
  console.log('🚀 [EXAMPLE] Creating sample CSV and running dry run...\n');
  
  // Create sample CSV file
  createSampleCSV();
  
  // Run dry run first
  console.log('\n🔍 Running dry run...');
  await bulkImportStudents('students.csv', { dryRun: true });
  
  console.log('\n💡 To run actual import, call:');
  console.log('bulkImportStudents("students.csv", { defaultPassword: "password123" })');
}

// Export functions
module.exports = {
  bulkImportStudents,
  createSampleCSV,
  runExample
};

// Run example if this file is executed directly
if (require.main === module) {
  runExample();
} 