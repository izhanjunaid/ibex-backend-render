const XLSX = require('xlsx');

/**
 * Debug Excel structure to understand the layout
 */
function debugExcelStructure(filePath) {
  console.log('🔍 [DEBUG] Examining Excel file structure...\n');
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with raw data
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📊 Excel file: ${filePath}`);
  console.log(`📋 Sheet name: ${sheetName}`);
  console.log(`📏 Total rows: ${rawData.length}`);
  console.log(`📏 Total columns: ${rawData[0] ? rawData[0].length : 0}\n`);
  
  // Show first 10 rows in detail
  console.log('📝 First 10 rows (showing first 10 columns):');
  for (let rowIndex = 0; rowIndex < Math.min(10, rawData.length); rowIndex++) {
    const row = rawData[rowIndex];
    console.log(`\nRow ${rowIndex + 1}:`);
    
    for (let colIndex = 0; colIndex < Math.min(10, row.length); colIndex++) {
      const cell = row[colIndex];
      if (cell !== undefined && cell !== null && cell !== '') {
        console.log(`  Col ${colIndex + 1}: "${cell}"`);
      }
    }
  }
  
  // Show all columns with non-empty headers
  console.log('\n📋 All column headers (non-empty):');
  const headers = rawData[0] || [];
  headers.forEach((header, index) => {
    if (header && typeof header === 'string' && header.trim() && !header.startsWith('__EMPTY')) {
      console.log(`  Col ${index + 1}: "${header}"`);
    }
  });
  
  // Show sample data from each grade column
  console.log('\n📚 Sample data from grade columns:');
  headers.forEach((header, colIndex) => {
    if (header && typeof header === 'string' && header.includes('Grade') && !header.startsWith('__EMPTY')) {
      console.log(`\n🎓 ${header} (Column ${colIndex + 1}):`);
      
      for (let rowIndex = 1; rowIndex < Math.min(10, rawData.length); rowIndex++) {
        const cell = rawData[rowIndex][colIndex];
        if (cell !== undefined && cell !== null && cell !== '') {
          console.log(`  Row ${rowIndex + 1}: "${cell}"`);
        }
      }
    }
  });
  
  return rawData;
}

// Run debug if this file is executed directly
if (require.main === module) {
  const excelFile = process.argv[2] || 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  console.log('🚀 [DEBUG] Starting Excel structure analysis...\n');
  debugExcelStructure(excelFile);
}

module.exports = { debugExcelStructure };