const XLSX = require('xlsx');

/**
 * Debug Excel headers to understand the exact structure
 */
function debugExcelHeaders(filePath) {
  console.log('🔍 [DEBUG] Examining Excel headers in detail...\n');
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`📊 Excel file: ${filePath}`);
  console.log(`📋 Sheet name: ${sheetName}`);
  console.log(`📏 Total rows: ${rawData.length}`);
  
  // Show the header row in detail
  const headerRow = rawData[0] || [];
  console.log(`\n📝 HEADER ROW (Row 1) - ${headerRow.length} columns:`);
  
  headerRow.forEach((header, index) => {
    if (header && header.toString().trim()) {
      console.log(`   Col ${index.toString().padStart(2)}: "${header}"`);
    }
  });
  
  // Look for the grade/section pattern every 3 columns
  console.log(`\n🎯 GRADE SECTIONS (every 3rd column pattern):`);
  
  for (let colIndex = 0; colIndex < headerRow.length; colIndex += 3) {
    const col1 = headerRow[colIndex];     // Should be Sr.# or similar
    const col2 = headerRow[colIndex + 1]; // Should be Student Name
    const col3 = headerRow[colIndex + 2]; // Should be Father Name
    
    if (col1 && col1.toString().trim()) {
      console.log(`\n   Columns ${colIndex}-${colIndex+2}:`);
      console.log(`     Col ${colIndex}: "${col1}" (Serial)`);
      console.log(`     Col ${colIndex + 1}: "${col2 || 'undefined'}" (Student)`);
      console.log(`     Col ${colIndex + 2}: "${col3 || 'undefined'}" (Father)`);
      
      // Try to parse grade info from any of these columns
      if (col1) {
        const gradeInfo = parseAnyGradeHeader(col1.toString());
        if (gradeInfo) {
          console.log(`     🎓 GRADE INFO: Grade ${gradeInfo.grade}, Section ${gradeInfo.section}`);
        }
      }
    }
  }
  
  // Show a few sample data rows
  console.log(`\n📋 SAMPLE DATA ROWS:`);
  for (let rowIndex = 1; rowIndex <= Math.min(5, rawData.length - 1); rowIndex++) {
    const row = rawData[rowIndex];
    console.log(`   Row ${rowIndex + 1}: [${row?.slice(0, 6).map(cell => `"${cell || ''}"`).join(', ')}...]`);
  }
}

/**
 * Enhanced grade header parser
 */
function parseAnyGradeHeader(header) {
  if (!header || typeof header !== 'string') return null;
  
  const cleanHeader = header.trim();
  console.log(`     🔍 Parsing: "${cleanHeader}"`);
  
  // More comprehensive patterns
  const gradePatterns = [
    /^Grade\s+(\d+)\s*$/i,                    // "Grade 8"
    /^Grade\s+(\d+)\s+([A-Za-z]+)$/i,         // "Grade 8 A" or "Grade 6 Crimson"
    /^Grade\s+Pre-(\d+)\s+([A-Za-z]+)$/i,     // "Grade Pre-3 Lilly"
    /^Pre-Year\s+I\s+([A-Za-z]+)$/i,          // "Pre-Year I Rose"
    /^Pre-Year\s+(\d+)\s+([A-Za-z]+)$/i,      // "Pre-Year 1 Rose"
    /^(\d+)\s+([A-Za-z]+)$/i,                 // "8 A"
    /^(\d+)$/i                                // "8"
  ];
  
  for (const pattern of gradePatterns) {
    const match = cleanHeader.match(pattern);
    if (match) {
      console.log(`       ✅ Matched pattern: ${pattern}`);
      
      if (cleanHeader.includes('Pre-Year I')) {
        return { grade: 0, section: match[1] };
      } else if (cleanHeader.includes('Pre-Year')) {
        return { grade: 0, section: match[2] || 'A' };
      } else if (cleanHeader.includes('Pre-')) {
        return { grade: 0, section: match[2] || 'A' };
      } else {
        return { 
          grade: parseInt(match[1]), 
          section: match[2] || 'A' 
        };
      }
    }
  }
  
  console.log(`       ❌ No pattern matched`);
  return null;
}

// Run the debug
if (require.main === module) {
  const excelFile = 'Enrolled Student July, 2025 Pre Year 1 to Grade 8.xls';
  debugExcelHeaders(excelFile);
}

module.exports = { debugExcelHeaders };