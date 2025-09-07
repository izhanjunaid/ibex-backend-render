const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse Excel file with column-based grade sections
 * Each column represents a grade/section with student names listed vertically
 */
function parseColumnBasedExcel(filePath) {
  console.log('📖 Reading column-based Excel file:', filePath);
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with raw data
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`✅ Read ${rawData.length} rows from Excel file`);
  
  // Parse the column headers to understand grade/section structure
  const headers = rawData[0] || [];
  console.log('📋 Found columns:', headers.length);
  
  const students = [];
  const gradeColumns = [];
  
  // Parse headers to extract grade and section information
  headers.forEach((header, colIndex) => {
    if (header && typeof header === 'string' && header.trim()) {
      const gradeInfo = parseGradeHeader(header.trim());
      if (gradeInfo) {
        gradeColumns.push({
          colIndex,
          header: header.trim(),
          ...gradeInfo
        });
      }
    }
  });
  
  console.log(`✅ Found ${gradeColumns.length} grade/section columns:`);
  gradeColumns.forEach(col => {
    console.log(`  - ${col.header} (Grade ${col.grade_level}, Section: ${col.section})`);
  });
  
  // Extract students from each column
  gradeColumns.forEach(gradeCol => {
    console.log(`\n📚 Processing ${gradeCol.header}...`);
    
    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      const studentName = row[gradeCol.colIndex];
      
      if (studentName && typeof studentName === 'string' && studentName.trim()) {
        const name = studentName.trim();
        const nameParts = parseStudentName(name);
        
        if (nameParts.first_name) {
          const student = {
            first_name: nameParts.first_name,
            last_name: nameParts.last_name,
            grade_level: gradeCol.grade_level,
            section: gradeCol.section,
            academic_year: '2025-2026',
            school_id: null,
            email: generateEmail(nameParts.first_name, nameParts.last_name)
          };
          
          students.push(student);
          console.log(`  ✅ ${student.first_name} ${student.last_name} (${student.email})`);
        }
      }
    }
  });
  
  console.log(`\n🎉 Total students extracted: ${students.length}`);
  return students;
}

/**
 * Parse grade header to extract grade level and section
 */
function parseGradeHeader(header) {
  // Remove empty markers
  if (header.startsWith('__EMPTY')) {
    return null;
  }
  
  // Patterns for different grade formats
  const patterns = [
    // "Grade 8", "Grade 7", etc.
    /^Grade\s+(\d+)$/i,
    // "Grade 6 Crimson", "Grade 5 Teal", etc.
    /^Grade\s+(\d+)\s+(.+)$/i,
    // "Pre-Year III Lilly", "Pre-Year II Buttercup", etc.
    /^Pre-Year\s+(I{1,3})\s+(.+)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = header.match(pattern);
    if (match) {
      let gradeLevel;
      let section;
      
      if (pattern.source.includes('Pre-Year')) {
        // Convert Roman numerals to numbers for Pre-Year
        const romanToNum = { 'I': '1', 'II': '2', 'III': '3' };
        gradeLevel = `Pre-${romanToNum[match[1]] || match[1]}`;
        section = match[2] || 'A';
      } else {
        gradeLevel = match[1];
        section = match[2] || 'A';
      }
      
      return {
        grade_level: gradeLevel,
        section: section
      };
    }
  }
  
  return null;
}

/**
 * Parse student name into first and last name
 */
function parseStudentName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: ''
    };
  } else if (parts.length === 2) {
    return {
      first_name: parts[0],
      last_name: parts[1]
    };
  } else {
    // For names with more than 2 parts, take first as first_name and rest as last_name
    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(' ')
    };
  }
}

/**
 * Generate email from first and last name
 */
function generateEmail(firstName, lastName) {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
  
  if (cleanLast) {
    return `${cleanFirst}.${cleanLast}@school.com`;
  } else {
    return `${cleanFirst}@school.com`;
  }
}

/**
 * Bulk import students from column-based Excel file
 */
async function bulkImportFromColumnExcel(excelFilePath, options = {}) {
  console.log('📚 [BULK IMPORT] Starting column-based Excel student import...\n');
  
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
    // 1. Parse Excel file
    const students = parseColumnBasedExcel(excelFilePath);
    results.total = students.length;
    
    if (dryRun) {
      console.log('\n🔍 [DRY RUN] Would create the following:');
      console.log('\nStudents:');
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.email}) - Grade ${student.grade_level} ${student.section}`);
      });
      
      // Show grade sections that would be created
      const gradeSections = new Set();
      students.forEach(student => {
        gradeSections.add(`Grade ${student.grade_level} ${student.section} - ${student.academic_year}`);
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
        const key = `${student.grade_level}-${student.section}-${student.academic_year}`;
        if (!gradeSections.has(key)) {
          gradeSections.set(key, {
            grade_level: student.grade_level.startsWith('Pre-') ? 0 : parseInt(student.grade_level),
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
    console.log(`   Email: Generated from their name (firstname.lastname@school.com)`);
    console.log(`   Password: ${defaultPassword}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Bulk import error:', error);
    throw error;
  }
}

// Export functions
module.exports = {
  bulkImportFromColumnExcel,
  parseColumnBasedExcel,
  parseGradeHeader,
  parseStudentName,
  generateEmail
};

// Run import if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Find the Excel file argument (first non-flag argument)
  const excelFile = args.find(arg => !arg.startsWith('--')) || 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  
  console.log('🚀 [COLUMN EXCEL IMPORT] Starting...\n');
  console.log(`📁 Excel file: ${excelFile}`);
  console.log(`🔍 Dry run: ${dryRun ? 'Yes' : 'No'}\n`);
  
  bulkImportFromColumnExcel(excelFile, { 
    dryRun: dryRun,
    createGradeSections: true,
    defaultPassword: 'password123'
  }).catch(console.error);
}