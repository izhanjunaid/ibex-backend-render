const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse Excel file to get expected student counts per section
 */
function parseExcelExpectedCounts(excelFilePath) {
  console.log('📖 Re-parsing Excel file to get expected counts...');
  
  // Read the Excel file
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  const headers = rawData[0] || [];
  const gradeColumns = [];
  
  // Find grade headers - they are in columns 0, 3, 6, 9, etc. (every 3rd column starting from 0)
  for (let colIndex = 0; colIndex < headers.length; colIndex += 3) {
    const header = headers[colIndex];
    if (header && typeof header === 'string' && header.trim()) {
      const gradeInfo = parseGradeHeader(header.trim());
      if (gradeInfo) {
        // Student names are in the next column (1, 4, 7, 10, etc.)
        const studentNameCol = colIndex + 1;
        
        gradeColumns.push({
          header: header.trim(),
          grade: gradeInfo.grade,
          section: gradeInfo.section,
          studentNameCol: studentNameCol
        });
      }
    }
  }
  
  console.log(`✅ Found ${gradeColumns.length} grade sections in Excel`);
  
  // Count students in each section
  const expectedCounts = {};
  
  gradeColumns.forEach(gradeCol => {
    let studentCount = 0;
    
    // Count non-empty student names starting from row 4 (index 3)
    for (let rowIndex = 3; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      const studentName = row[gradeCol.studentNameCol];
      
      if (studentName && typeof studentName === 'string' && studentName.trim()) {
        const name = studentName.trim();
        
        // Skip header rows
        if (name.toLowerCase() === 'student name' || name === 'Sr.#' || name === '#') {
          continue;
        }
        
        studentCount++;
      }
    }
    
    expectedCounts[gradeCol.header] = {
      grade: gradeCol.grade,
      section: gradeCol.section,
      expectedCount: studentCount
    };
  });
  
  return expectedCounts;
}

/**
 * Parse grade header to extract grade and section info
 */
function parseGradeHeader(header) {
  // Handle different grade formats from Excel
  const gradePatterns = [
    /^Grade\s+(\d+)\s+(.+)$/i,         // "Grade 6 Crimson"
    /^Grade\s+(\d+)$/i,                // "Grade 8"  
    /^Pre-Year\s+III\s+(.+)$/i,        // "Pre-Year III Lilly"
    /^Pre-Year\s+II\s+(.+)$/i,         // "Pre-Year II Buttercup"
    /^Pre-Year\s+I\s+(.+)$/i,          // "Pre-Year I Rose"
    /^(\d+)\s+(.+)$/i                  // "8 A"
  ];
  
  for (const pattern of gradePatterns) {
    const match = header.match(pattern);
    if (match) {
      if (header.includes('Pre-Year')) {
        return { grade: 0, section: match[1] };
      } else {
        return { 
          grade: parseInt(match[1]), 
          section: match[2] || 'A' 
        };
      }
    }
  }
  
  return null;
}

/**
 * Get actual counts from database
 */
async function getDatabaseCounts() {
  console.log('🗄️ Getting actual counts from database...');
  
  // Get all grade sections
  const { data: sections, error: sectionsError } = await supabase
    .from('grade_sections')
    .select('id, name, grade_level, section')
    .eq('is_active', true)
    .order('grade_level', { ascending: true })
    .order('section', { ascending: true });

  if (sectionsError) {
    console.error('❌ Error fetching sections:', sectionsError);
    return {};
  }

  const databaseCounts = {};
  
  // Get student counts for each section
  for (const section of sections) {
    const { count, error: countError } = await supabase
      .from('grade_section_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('grade_section_id', section.id);
      
    if (countError) {
      console.error(`❌ Error counting students for ${section.name}:`, countError);
      continue;
    }
    
    databaseCounts[section.name] = {
      grade: section.grade_level,
      section: section.section,
      actualCount: count || 0
    };
  }
  
  return databaseCounts;
}

/**
 * Compare Excel expected vs Database actual counts
 */
async function compareExcelVsDatabase() {
  console.log('🔍 [VERIFICATION] Comparing Excel data with Database...\n');
  
  try {
    const excelFile = 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
    
    // Get expected counts from Excel
    const expectedCounts = parseExcelExpectedCounts(excelFile);
    
    // Get actual counts from database  
    const databaseCounts = await getDatabaseCounts();
    
    console.log('\n📊 COMPARISON RESULTS:');
    console.log('='.repeat(80));
    console.log('| Section Name              | Expected | Actual | Status    |');
    console.log('|---------------------------|----------|--------|-----------|');
    
    let totalExpected = 0;
    let totalActual = 0;
    let matchingCount = 0;
    
    // Compare by matching section names
    Object.keys(expectedCounts).forEach(excelSectionName => {
      const expected = expectedCounts[excelSectionName];
      totalExpected += expected.expectedCount;
      
      // Try to find matching database section
      let matchedDbSection = null;
      let actualCount = 0;
      
      // Look for exact match first
      if (databaseCounts[excelSectionName]) {
        matchedDbSection = excelSectionName;
        actualCount = databaseCounts[excelSectionName].actualCount;
      } else {
        // Try to find by grade and section
        Object.keys(databaseCounts).forEach(dbSectionName => {
          const dbSection = databaseCounts[dbSectionName];
          if (dbSection.grade === expected.grade && 
              dbSection.section.toLowerCase() === expected.section.toLowerCase()) {
            matchedDbSection = dbSectionName;
            actualCount = dbSection.actualCount;
          }
        });
      }
      
      if (matchedDbSection) {
        totalActual += actualCount;
      }
      
      const status = actualCount === expected.expectedCount ? '✅ Match' : 
                     actualCount > expected.expectedCount ? '⬆️ More' :
                     actualCount < expected.expectedCount ? '⬇️ Less' : '❓ Missing';
      
      if (actualCount === expected.expectedCount) {
        matchingCount++;
      }
      
      const sectionName = excelSectionName.padEnd(25);
      const expectedStr = expected.expectedCount.toString().padStart(8);
      const actualStr = actualCount.toString().padStart(6);
      
      console.log(`| ${sectionName} | ${expectedStr} | ${actualStr} | ${status.padEnd(9)} |`);
    });
    
    console.log('='.repeat(80));
    console.log(`📈 SUMMARY:`);
    console.log(`   Expected total: ${totalExpected} students`);
    console.log(`   Database total: ${totalActual} students`);
    console.log(`   Sections matching: ${matchingCount}/${Object.keys(expectedCounts).length}`);
    console.log(`   Accuracy: ${totalActual === totalExpected ? '✅ Perfect!' : `❓ ${Math.round((totalActual/totalExpected)*100)}%`}`);
    
    // Show any database sections not found in Excel
    console.log('\n🔍 DATABASE SECTIONS NOT IN EXCEL:');
    Object.keys(databaseCounts).forEach(dbSectionName => {
      if (!expectedCounts[dbSectionName]) {
        const dbSection = databaseCounts[dbSectionName];
        console.log(`   ${dbSectionName} (Grade ${dbSection.grade} ${dbSection.section}): ${dbSection.actualCount} students`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error during comparison:', error.message);
  }
}

// Run the verification
if (require.main === module) {
  compareExcelVsDatabase().then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  }).catch(console.error);
}

module.exports = { compareExcelVsDatabase };