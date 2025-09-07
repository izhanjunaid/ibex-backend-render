const { parseColumnBasedExcel } = require('./bulk-import-excel-columns');
const fs = require('fs');

/**
 * Export Excel data to CSV for review before import
 */
function exportToCSV(excelFilePath, csvFilePath = 'students-extracted.csv') {
  console.log('📊 [EXPORT] Extracting students from Excel and exporting to CSV...\n');
  
  try {
    // Parse the Excel file
    const students = parseColumnBasedExcel(excelFilePath);
    
    // Filter out invalid entries (like "Sr.#")
    const validStudents = students.filter(student => {
      const name = student.first_name.toLowerCase();
      return name !== 'sr.#' && 
             name !== 'sr' &&
             name !== '#' &&
             name !== 'serial' &&
             name !== 'no' &&
             name !== 'number' &&
             name.length > 1;
    });
    
    console.log(`📝 Filtered ${students.length} entries to ${validStudents.length} valid students`);
    
    if (validStudents.length === 0) {
      console.log('⚠️ No valid students found. The Excel file might have a different structure.');
      console.log('💡 Try checking if student names start from row 2 or 3 instead of row 1.');
      return;
    }
    
    // Create CSV content
    const headers = ['email', 'first_name', 'last_name', 'grade_level', 'section', 'academic_year', 'school_id'];
    const csvRows = [headers.join(',')];
    
    validStudents.forEach(student => {
      const row = [
        student.email,
        student.first_name,
        student.last_name,
        student.grade_level,
        student.section,
        student.academic_year,
        student.school_id || ''
      ];
      csvRows.push(row.join(','));
    });
    
    // Write CSV file
    fs.writeFileSync(csvFilePath, csvRows.join('\n'));
    
    console.log(`✅ Exported ${validStudents.length} students to: ${csvFilePath}`);
    console.log('\n📋 Sample of extracted students:');
    validStudents.slice(0, 10).forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.first_name} ${student.last_name} (${student.email}) - Grade ${student.grade_level} ${student.section}`);
    });
    
    if (validStudents.length > 10) {
      console.log(`  ... and ${validStudents.length - 10} more students`);
    }
    
    console.log(`\n💡 Review the CSV file and then run:`);
    console.log(`   node bulk-import-students.js "${csvFilePath}"`);
    console.log(`   or for dry run:`);
    console.log(`   node bulk-import-students.js "${csvFilePath}" --dry-run`);
    
    return validStudents;
    
  } catch (error) {
    console.error('❌ Export error:', error);
    throw error;
  }
}

// Run export if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const excelFile = args[0] || 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  const csvFile = args[1] || 'students-extracted.csv';
  
  console.log('🚀 [EXCEL TO CSV] Starting export...\n');
  console.log(`📁 Excel file: ${excelFile}`);
  console.log(`📄 CSV output: ${csvFile}\n`);
  
  exportToCSV(excelFile, csvFile);
}

module.exports = { exportToCSV };