const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse Excel and find duplicate students
 */
function findDuplicateStudents(excelFilePath) {
  console.log('📖 Reading Excel file to find duplicates...');
  
  // Read the Excel file
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  const headers = rawData[0] || [];
  const gradeColumns = [];
  
  // Find grade headers
  headers.forEach((header, colIndex) => {
    if (header && typeof header === 'string' && header.trim()) {
      const gradeInfo = parseGradeHeader(header.trim());
      if (gradeInfo) {
        gradeColumns.push({
          gradeHeaderCol: colIndex,
          studentNameCol: colIndex + 1,
          fatherNameCol: colIndex + 2,
          header: header.trim(),
          ...gradeInfo
        });
      }
    }
  });
  
  // Extract all students first
  const allStudents = [];
  const emailCounts = new Map();
  
  gradeColumns.forEach(gradeCol => {
    for (let rowIndex = 3; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      const studentName = row[gradeCol.studentNameCol];
      const fatherName = row[gradeCol.fatherNameCol];
      
      if (studentName && typeof studentName === 'string' && studentName.trim()) {
        const name = studentName.trim();
        if (name.toLowerCase() === 'student name' || name === 'Sr.#' || name === '#') {
          continue;
        }
        
        const nameParts = parseStudentName(name);
        if (nameParts.first_name) {
          const originalEmail = generateOriginalEmail(nameParts.first_name, nameParts.last_name);
          
          const student = {
            first_name: nameParts.first_name,
            last_name: nameParts.last_name,
            father_name: fatherName ? fatherName.trim() : '',
            grade_level: gradeCol.grade_level,
            section: gradeCol.section,
            academic_year: '2025-2026',
            school_id: null,
            originalEmail: originalEmail,
            row_number: rowIndex + 1
          };
          
          allStudents.push(student);
          
          // Count email occurrences
          const count = emailCounts.get(originalEmail) || 0;
          emailCounts.set(originalEmail, count + 1);
        }
      }
    }
  });
  
  // Find duplicates (emails that appear more than once)
  const duplicateEmails = new Set();
  emailCounts.forEach((count, email) => {
    if (count > 1) {
      duplicateEmails.add(email);
    }
  });
  
  // Get only the duplicate students (skip the first occurrence)
  const duplicateStudents = [];
  const processedEmails = new Map();
  
  allStudents.forEach(student => {
    if (duplicateEmails.has(student.originalEmail)) {
      const count = processedEmails.get(student.originalEmail) || 0;
      
      if (count > 0) { // Skip first occurrence, only add duplicates
        // Generate unique email for this duplicate
        student.email = generateUniqueEmail(student.originalEmail, count + 1);
        duplicateStudents.push(student);
      }
      
      processedEmails.set(student.originalEmail, count + 1);
    }
  });
  
  console.log(`\n🔍 Found ${duplicateStudents.length} duplicate students:`);
  duplicateStudents.forEach((student, index) => {
    console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} → ${student.email} (was: ${student.originalEmail})`);
  });
  
  return duplicateStudents;
}

function parseGradeHeader(header) {
  if (header.startsWith('__EMPTY')) return null;
  
  const patterns = [
    /^Grade\s+(\d+)$/i,
    /^Grade\s+(\d+)\s+(.+)$/i,
    /^Pre-Year\s+(I{1,3})\s+(.+)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = header.match(pattern);
    if (match) {
      let gradeLevel, section;
      
      if (pattern.source.includes('Pre-Year')) {
        const romanToNum = { 'I': '1', 'II': '2', 'III': '3' };
        gradeLevel = `Pre-${romanToNum[match[1]] || match[1]}`;
        section = match[2] || 'A';
      } else {
        gradeLevel = match[1];
        section = match[2] || 'A';
      }
      
      return { grade_level: gradeLevel, section: section };
    }
  }
  return null;
}

function parseStudentName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' };
  } else if (parts.length === 2) {
    return { first_name: parts[0], last_name: parts[1] };
  } else {
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
  }
}

function generateOriginalEmail(firstName, lastName) {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
  
  if (cleanLast) {
    return `${cleanFirst}.${cleanLast}@ibex`;
  } else {
    return `${cleanFirst}@ibex`;
  }
}

function generateUniqueEmail(originalEmail, duplicateNumber) {
  // Remove @ibex and add number
  const emailPart = originalEmail.replace('@ibex', '');
  return `${emailPart}${duplicateNumber}@ibex`;
}

/**
 * Import only the duplicate students with unique emails
 */
async function importDuplicateStudents(excelFilePath) {
  console.log('🚀 [DUPLICATE IMPORT] Starting import of duplicate students...\n');
  
  const duplicateStudents = findDuplicateStudents(excelFilePath);
  
  if (duplicateStudents.length === 0) {
    console.log('✅ No duplicate students found to import!');
    return;
  }
  
  const results = {
    total: duplicateStudents.length,
    created: 0,
    errors: []
  };
  
  // Get existing grade sections
  const { data: gradeSections } = await supabase
    .from('grade_sections')
    .select('*');
  
  const gradeSectionMap = new Map();
  gradeSections.forEach(section => {
    const key = `${section.grade_level}-${section.section}-${section.academic_year}`;
    gradeSectionMap.set(key, section);
  });
  
  console.log('\n📚 Importing duplicate students...\n');
  
  for (let i = 0; i < duplicateStudents.length; i++) {
    const student = duplicateStudents[i];
    const gradeKey = `${student.grade_level}-${student.section}-${student.academic_year}`;
    const gradeSection = gradeSectionMap.get(gradeKey);
    
    try {
      console.log(`📝 Processing duplicate ${i + 1}/${duplicateStudents.length}: ${student.first_name} ${student.last_name}`);
      
      // Check if this unique email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', student.email)
        .single();
      
      if (existingUser) {
        console.log(`⏭️ Student already exists: ${student.email}`);
        continue;
      }
      
      // Create new user in Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: student.email,
        password: 'ibex123',
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
      
      // Create user profile
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
      
      console.log(`✅ Created student: ${student.email}`);
      results.created++;
      
      // Enroll in grade section
      if (gradeSection) {
        const { error: enrollmentError } = await supabase
          .from('grade_section_enrollments')
          .insert([{
            grade_section_id: gradeSection.id,
            student_id: newUser.id,
            status: 'active'
          }]);
        
        if (enrollmentError) {
          console.log(`❌ Error enrolling student:`, enrollmentError.message);
          results.errors.push(`Enrollment ${student.email}: ${enrollmentError.message}`);
        } else {
          console.log(`✅ Enrolled in grade section: ${gradeSection.name}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Error processing student ${student.email}:`, error.message);
      results.errors.push(`Processing ${student.email}: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n📊 [DUPLICATE IMPORT SUMMARY]');
  console.log(`Total duplicates processed: ${results.total}`);
  console.log(`Students created: ${results.created}`);
  console.log(`Errors: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    results.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  console.log('\n🎉 Duplicate import completed!');
  console.log(`💡 All duplicate students can login with their unique emails and password: ibex123`);
}

// Run if executed directly
if (require.main === module) {
  const excelFile = process.argv[2] || 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  importDuplicateStudents(excelFile).catch(console.error);
}

module.exports = { importDuplicateStudents, findDuplicateStudents };