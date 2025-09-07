const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Read Excel file and convert to student data format
 */
function readExcelFile(filePath) {
  console.log('📖 Reading Excel file:', filePath);
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ Read ${rawData.length} rows from Excel file`);
  console.log('📋 Column headers found:', Object.keys(rawData[0] || {}));
  
  return rawData;
}

/**
 * Map Excel data to our expected format
 * This function tries to intelligently map common column names
 */
function mapStudentData(rawData) {
  console.log('🗺️ Mapping student data...');
  
  const mappedStudents = rawData.map((row, index) => {
    // Common variations of column names we might encounter
    const getField = (possibleNames) => {
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return String(row[name]).trim();
        }
      }
      return '';
    };
    
    const student = {
      email: getField(['email', 'Email', 'EMAIL', 'Email Address', 'email_address']),
      first_name: getField(['first_name', 'First Name', 'FirstName', 'first name', 'First', 'Name', 'Student Name']),
      last_name: getField(['last_name', 'Last Name', 'LastName', 'last name', 'Last', 'Surname']),
      grade_level: getField(['grade_level', 'grade', 'Grade', 'Grade Level', 'Class', 'Year', 'Standard']),
      section: getField(['section', 'Section', 'Division', 'Class Section', 'Sec']),
      academic_year: getField(['academic_year', 'Academic Year', 'Year', 'Session', 'Term']) || '2025-2026',
      school_id: getField(['school_id', 'School ID', 'SchoolID']) || null
    };
    
    // If no explicit email, try to generate one from name
    if (!student.email && student.first_name && student.last_name) {
      const cleanFirst = student.first_name.toLowerCase().replace(/[^a-z]/g, '');
      const cleanLast = student.last_name.toLowerCase().replace(/[^a-z]/g, '');
      student.email = `${cleanFirst}.${cleanLast}@school.com`;
      console.log(`⚠️ Generated email for ${student.first_name} ${student.last_name}: ${student.email}`);
    }
    
    // Extract grade number from grade text (e.g., "Grade 5" -> "5", "Class VII" -> "7")
    if (student.grade_level) {
      const gradeMatch = student.grade_level.match(/(\d+)/);
      if (gradeMatch) {
        student.grade_level = gradeMatch[1];
      }
      // Convert roman numerals if needed
      const romanToNum = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
      };
      if (romanToNum[student.grade_level.toUpperCase()]) {
        student.grade_level = romanToNum[student.grade_level.toUpperCase()];
      }
    }
    
    // Default section if not provided
    if (!student.section) {
      student.section = 'A';
    }
    
    // Validate required fields
    if (!student.email || !student.first_name || !student.grade_level) {
      console.log(`⚠️ Row ${index + 2} missing required data:`, student);
    }
    
    return student;
  });
  
  console.log(`✅ Mapped ${mappedStudents.length} students`);
  return mappedStudents;
}

/**
 * Bulk import students from Excel file
 */
async function bulkImportFromExcel(excelFilePath, options = {}) {
  console.log('📚 [BULK IMPORT] Starting Excel-based student bulk import...\n');
  
  const {
    createGradeSections = true,
    defaultPassword = 'password123',
    dryRun = false,
    updateExisting = false
  } = options;
  
  const results = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    gradeSectionsCreated: 0
  };
  
  try {
    // 1. Read Excel file
    const rawData = readExcelFile(excelFilePath);
    const students = mapStudentData(rawData);
    results.total = students.length;
    
    if (dryRun) {
      console.log('\n🔍 [DRY RUN] Would create the following:');
      console.log('\nStudents:');
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.email}) - Grade ${student.grade_level}${student.section}`);
      });
      
      // Show grade sections that would be created
      const gradeSections = new Set();
      students.forEach(student => {
        if (student.grade_level && student.section) {
          gradeSections.add(`Grade ${student.grade_level} ${student.section} - ${student.academic_year}`);
        }
      });
      console.log('\nGrade Sections:');
      Array.from(gradeSections).forEach(section => {
        console.log(`  - ${section}`);
      });
      
      return results;
    }
    
    // 2. Create grade sections
    const gradeSections = new Map();
    if (createGradeSections) {
      console.log('\n2️⃣ Creating grade sections...');
      
      students.forEach(student => {
        if (student.grade_level && student.section) {
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
      
      // Skip if missing required fields
      if (!student.email || !student.first_name || !student.grade_level) {
        console.log(`⏭️ Skipping student ${i + 1}: Missing required fields`);
        results.skipped++;
        continue;
      }
      
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
        
        let userId;
        
        if (existingUser && updateExisting) {
          // Update existing user
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
              first_name: student.first_name,
              last_name: student.last_name,
              role: 'student',
              status: 'active'
            })
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
    console.log(`Total students in Excel: ${results.total}`);
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
    console.log(`\n💡 Students can now login with:`);
    console.log(`   Email: their email (generated if not in Excel)`);
    console.log(`   Password: ${defaultPassword}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Bulk import error:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  bulkImportFromExcel,
  readExcelFile,
  mapStudentData
};

// Run import if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Find the Excel file argument (first non-flag argument)
  const excelFile = args.find(arg => !arg.startsWith('--')) || 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  
  console.log('🚀 [EXCEL IMPORT] Starting...\n');
  console.log(`📁 Excel file: ${excelFile}`);
  console.log(`🔍 Dry run: ${dryRun ? 'Yes' : 'No'}\n`);
  
  bulkImportFromExcel(excelFile, { 
    dryRun: dryRun,
    createGradeSections: true,
    defaultPassword: 'password123'
  }).catch(console.error);
}