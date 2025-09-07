const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAttendanceTable() {
  console.log('🔍 Analyzing Current Attendance Table Structure...\n');

  try {
    // 1. Get table structure by examining sample data
    console.log('1. 📋 Table Structure Analysis...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('attendance')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.log('❌ Error accessing attendance table:', sampleError.message);
      return;
    }

    if (sampleData && sampleData.length > 0) {
      console.log('📊 Table columns:');
      const columns = Object.keys(sampleData[0]);
      columns.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col} (${typeof sampleData[0][col]})`);
      });

      console.log('\n📝 Sample data structure:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    }

    // 2. Analyze data distribution
    console.log('\n2. 📊 Data Distribution Analysis...');
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   📈 Total records: ${totalCount}`);

    // Get status distribution
    const { data: statusData, error: statusError } = await supabase
      .from('attendance')
      .select('status');

    if (!statusError && statusData) {
      const statusCounts = {};
      statusData.forEach(record => {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      });
      
      console.log('   📊 Status distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        const percentage = ((count / totalCount) * 100).toFixed(1);
        console.log(`      ${status}: ${count} (${percentage}%)`);
      });
    }

    // Get date range
    const { data: dateData, error: dateError } = await supabase
      .from('attendance')
      .select('date')
      .order('date', { ascending: true });

    if (!dateError && dateData && dateData.length > 0) {
      const firstDate = dateData[0].date;
      const lastDate = dateData[dateData.length - 1].date;
      console.log(`   📅 Date range: ${firstDate} to ${lastDate}`);
      
      // Count unique dates
      const uniqueDates = [...new Set(dateData.map(d => d.date))];
      console.log(`   📅 Unique dates: ${uniqueDates.length}`);
    }

    // 3. Check for grade_section_id usage
    console.log('\n3. 🏫 Grade Section Analysis...');
    const { data: gradeSectionData, error: gsError } = await supabase
      .from('attendance')
      .select('grade_section_id')
      .not('grade_section_id', 'is', null);

    if (!gsError && gradeSectionData) {
      const uniqueGradeSections = [...new Set(gradeSectionData.map(g => g.grade_section_id))];
      console.log(`   📚 Unique grade sections: ${uniqueGradeSections.length}`);
      
      if (uniqueGradeSections.length > 0) {
        console.log('   📝 Sample grade section IDs:');
        uniqueGradeSections.slice(0, 5).forEach((id, index) => {
          console.log(`      ${index + 1}. ${id}`);
        });
      }
    }

    // 4. Check for student distribution
    console.log('\n4. 👥 Student Distribution...');
    const { data: studentData, error: studentError } = await supabase
      .from('attendance')
      .select('student_id');

    if (!studentError && studentData) {
      const uniqueStudents = [...new Set(studentData.map(s => s.student_id))];
      console.log(`   👤 Unique students: ${uniqueStudents.length}`);
      
      // Get student attendance counts
      const studentCounts = {};
      studentData.forEach(record => {
        studentCounts[record.student_id] = (studentCounts[record.student_id] || 0) + 1;
      });
      
      const attendanceCounts = Object.values(studentCounts);
      const avgAttendance = attendanceCounts.reduce((sum, count) => sum + count, 0) / attendanceCounts.length;
      console.log(`   📊 Average attendance records per student: ${avgAttendance.toFixed(1)}`);
    }

    // 5. Check for performance issues
    console.log('\n5. ⚡ Performance Analysis...');
    
    // Check if there are indexes by looking at query performance
    const startTime = Date.now();
    const { data: perfData, error: perfError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', '2025-08-11')
      .limit(10);
    const endTime = Date.now();
    
    console.log(`   ⏱️  Query performance: ${endTime - startTime}ms for date filter`);
    
    if (!perfError && perfData) {
      console.log(`   📊 Records found for 2025-08-11: ${perfData.length}`);
    }

    // 6. Check for data quality issues
    console.log('\n6. 🔍 Data Quality Analysis...');
    
    // Check for null values
    const { data: nullData, error: nullError } = await supabase
      .from('attendance')
      .select('*')
      .or('student_id.is.null,date.is.null,status.is.null');

    if (!nullError && nullData) {
      console.log(`   ⚠️  Records with null values: ${nullData.length}`);
      if (nullData.length > 0) {
        console.log('   📝 Sample null records:');
        nullData.slice(0, 3).forEach((record, index) => {
          console.log(`      ${index + 1}. ${JSON.stringify(record)}`);
        });
      }
    }

    // Check for duplicate records
    const { data: duplicateData, error: duplicateError } = await supabase
      .from('attendance')
      .select('student_id, date, grade_section_id')
      .order('student_id')
      .order('date');

    if (!duplicateError && duplicateData) {
      const duplicates = [];
      for (let i = 1; i < duplicateData.length; i++) {
        const prev = duplicateData[i - 1];
        const curr = duplicateData[i];
        if (prev.student_id === curr.student_id && 
            prev.date === curr.date && 
            prev.grade_section_id === curr.grade_section_id) {
          duplicates.push({ prev, curr });
        }
      }
      console.log(`   ⚠️  Potential duplicate records: ${duplicates.length}`);
    }

    console.log('\n🎉 Attendance table analysis completed!');

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
  }
}

analyzeAttendanceTable();
