const { createClient } = require('@supabase/supabase-js');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Bulk import students from CSV file
 * CSV format should be:
 * email,first_name,last_name,grade_level,section,academic_year,school_id
 */
async function bulkImportStudents(csvFilePath, options = {}) {
  console.log('📚 [BULK IMPORT] Starting student bulk import...\n');
  
  const {
    createGradeSections = true,  // Auto-create grade sections if they don't exist
    defaultPassword = 'password123',  // Default password for students
    dryRun = false,  // Set to true to see what would be imported without actually importing
    updateExisting = false  // Update existing students instead of skipping
  } = options;
  
  const results = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    gradeSectionsCreated: 0
  };
  
  const students = [];
  const gradeSections = new Map(); // Track grade sections to create
  
  try {
    // 1. Read and parse CSV file
    console.log('1️⃣ Reading CSV file...');
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          students.push(row);
          results.total++;
          
          // Track grade sections
          const gradeKey = `${row.grade_level}-${row.section}-${row.academic_year}`;
          if (!gradeSections.has(gradeKey)) {
            gradeSections.set(gradeKey, {
              grade_level: parseInt(row.grade_level),
              section: row.section,
              academic_year: row.academic_year,
              school_id: row.school_id || null,
              name: `Grade ${row.grade_level} ${row.section}`,
              description: `Grade ${row.grade_level} Section ${row.section} - ${row.academic_year}`
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`✅ CSV parsed: ${students.length} students, ${gradeSections.size} grade sections`);
    
    if (dryRun) {
      console.log('\n🔍 [DRY RUN] Would create the following:');
      console.log('Grade Sections:');
      gradeSections.forEach((section, key) => {
        console.log(`  - ${section.name} (${section.academic_year})`);
      });
      console.log('\nStudents:');
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.email}) - Grade ${student.grade_level}${student.section}`);
      });
      return;
    }
    
    // 2. Create grade sections if needed
    if (createGradeSections) {
      console.log('\n2️⃣ Creating grade sections...');
      for (const [key, sectionData] of gradeSections) {
        try {
          // Check if grade section already exists
          const { data: existingSection } = await supabase
            .from('grade_sections')
            .select('id')
            .eq('grade_level', sectionData.grade_level)
            .eq('section', sectionData.section)
            .eq('academic_year', sectionData.academic_year)
            .eq('school_id', sectionData.school_id)
            .single();
          
          if (!existingSection) {
            const { data: newSection, error: sectionError } = await supabase
              .from('grade_sections')
              .insert([sectionData])
              .select()
              .single();
            
            if (sectionError) {
              console.log(`❌ Error creating grade section ${sectionData.name}:`, sectionError.message);
              results.errors.push(`Grade section ${sectionData.name}: ${sectionError.message}`);
            } else {
              console.log(`✅ Created grade section: ${sectionData.name}`);
              results.gradeSectionsCreated++;
              gradeSections.set(key, { ...sectionData, id: newSection.id });
            }
          } else {
            console.log(`⏭️ Grade section already exists: ${sectionData.name}`);
            gradeSections.set(key, { ...sectionData, id: existingSection.id });
          }
        } catch (error) {
          console.log(`❌ Error checking/creating grade section ${sectionData.name}:`, error.message);
          results.errors.push(`Grade section ${sectionData.name}: ${error.message}`);
        }
      }
    }
    
    // 3. Import students
    console.log('\n3️⃣ Importing students...');
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const gradeKey = `${student.grade_level}-${student.section}-${student.academic_year}`;
      const gradeSection = gradeSections.get(gradeKey);
      
      try {
        console.log(`\n📝 Processing student ${i + 1}/${students.length}: ${student.first_name} ${student.last_name}`);
        
        // Check if student already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', student.email)
          .single();
        
        if (existingUser && !updateExisting) {
          console.log(`⏭️ Student already exists: ${student.email}`);
          results.skipped++;
          continue;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Prepare user data
        const userData = {
          email: student.email,
          first_name: student.first_name,
          last_name: student.last_name,
          role: 'student',
          status: 'active',
          password_hash: hashedPassword
        };
        
        let userId;
        
        if (existingUser && updateExisting) {
          // Update existing user
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(userData)
            .eq('id', existingUser.id)
            .select()
            .single();
          
          if (updateError) {
            console.log(`❌ Error updating student ${student.email}:`, updateError.message);
            results.errors.push(`Update ${student.email}: ${updateError.message}`);
            continue;
          }
          
          userId = updatedUser.id;
          console.log(`✅ Updated student: ${student.email}`);
          results.updated++;
        } else {
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
            results.errors.push(`Auth ${student.email}: ${authError.message}`);
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
            results.errors.push(`Profile ${student.email}: ${profileError.message}`);
            continue;
          }
          
          userId = newUser.id;
          console.log(`✅ Created student: ${student.email}`);
          results.created++;
        }
        
        // 4. Enroll student in grade section
        if (gradeSection && gradeSection.id) {
          try {
            // Check if enrollment already exists
            const { data: existingEnrollment } = await supabase
              .from('grade_section_enrollments')
              .select('id')
              .eq('grade_section_id', gradeSection.id)
              .eq('student_id', userId)
              .single();
            
            if (!existingEnrollment) {
              const { error: enrollmentError } = await supabase
                .from('grade_section_enrollments')
                .insert([{
                  grade_section_id: gradeSection.id,
                  student_id: userId,
                  status: 'active'
                }]);
              
              if (enrollmentError) {
                console.log(`❌ Error enrolling student in grade section:`, enrollmentError.message);
                results.errors.push(`Enrollment ${student.email}: ${enrollmentError.message}`);
              } else {
                console.log(`✅ Enrolled in grade section: ${gradeSection.name}`);
              }
            } else {
              console.log(`⏭️ Already enrolled in grade section: ${gradeSection.name}`);
            }
          } catch (error) {
            console.log(`❌ Error checking enrollment:`, error.message);
            results.errors.push(`Enrollment check ${student.email}: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Error processing student ${student.email}:`, error.message);
        results.errors.push(`Processing ${student.email}: ${error.message}`);
      }
    }
    
    // 5. Print summary
    console.log('\n📊 [IMPORT SUMMARY]');
    console.log(`Total students in CSV: ${results.total}`);
    console.log(`Students created: ${results.created}`);
    console.log(`Students updated: ${results.updated}`);
    console.log(`Students skipped: ${results.skipped}`);
    console.log(`Grade sections created: ${results.gradeSectionsCreated}`);
    console.log(`Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎉 Bulk import completed!');
    
  } catch (error) {
    console.error('❌ Bulk import error:', error);
  }
}

// Example usage
async function runExample() {
  console.log('🚀 [EXAMPLE] Running bulk import example...\n');
  
  // Create sample CSV file
  const sampleCSV = `email,first_name,last_name,grade_level,section,academic_year,school_id
john.doe@school.com,John,Doe,6,A,2025-2026,
jane.smith@school.com,Jane,Smith,6,A,2025-2026,
mike.johnson@school.com,Mike,Johnson,6,B,2025-2026,
sarah.wilson@school.com,Sarah,Wilson,6,B,2025-2026,
alex.brown@school.com,Alex,Brown,7,A,2025-2026,`;
  
  fs.writeFileSync('sample-students.csv', sampleCSV);
  console.log('✅ Created sample CSV file: sample-students.csv');
  
  // Run dry run first
  console.log('\n🔍 Running dry run...');
  await bulkImportStudents('sample-students.csv', { dryRun: true });
  
  console.log('\n💡 To run actual import, call:');
  console.log('bulkImportStudents("your-file.csv", { createGradeSections: true, defaultPassword: "password123" })');
}

// Export functions
module.exports = {
  bulkImportStudents,
  runExample
};

// Run example if this file is executed directly
if (require.main === module) {
  runExample();
} 