const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugOptimisticUpdates() {
  console.log('🔍 Debugging Optimistic Update Mismatch');
  console.log('======================================\n');

  // Find Grade 1 Crimson section
  console.log('1. 📚 Finding Grade 1 Crimson section...');
  
  const { data: gradeSections, error: gsError } = await supabase
    .from('grade_sections')
    .select('*')
    .ilike('name', '%Grade 1 Crimson%')
    .eq('is_active', true);

  if (gsError) {
    console.error('❌ Error finding grade section:', gsError);
    return;
  }

  if (!gradeSections || gradeSections.length === 0) {
    console.log('❌ Grade 1 Crimson not found');
    
    // Show available Grade 1 sections
    const { data: grade1Sections } = await supabase
      .from('grade_sections')
      .select('*')
      .eq('grade_level', 1)
      .eq('is_active', true);
    
    console.log('\n📚 Available Grade 1 sections:');
    grade1Sections?.forEach(section => {
      console.log(`   - ${section.name} (ID: ${section.id})`);
    });
    return;
  }

  const gradeSection = gradeSections[0];
  const testDate = '2025-09-07'; // Current date from your logs
  
  console.log(`✅ Found: ${gradeSection.name}`);
  console.log(`   ID: ${gradeSection.id}`);
  console.log(`   Teacher ID: ${gradeSection.teacher_id}`);

  // Check current attendance data
  console.log('\n2. 📊 Checking current attendance data...');
  
  const { data: attendanceData, error: attendanceError } = await supabase
    .rpc('get_grade_section_attendance', {
      p_grade_section_id: gradeSection.id,
      p_date: testDate
    });

  if (attendanceError) {
    console.error('❌ Error getting attendance data:', attendanceError);
    return;
  }

  console.log(`✅ Found ${attendanceData?.length || 0} students in attendance data`);
  
  if (attendanceData && attendanceData.length > 0) {
    const stats = {
      total: attendanceData.length,
      present: attendanceData.filter(s => s.status === 'present').length,
      absent: attendanceData.filter(s => s.status === 'absent').length,
      late: attendanceData.filter(s => s.status === 'late').length,
      excused: attendanceData.filter(s => s.status === 'excused').length,
      unmarked: attendanceData.filter(s => s.status === 'unmarked' || !s.status).length
    };
    
    console.log('\n📊 Backend Statistics:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Present: ${stats.present}`);
    console.log(`   Absent: ${stats.absent}`);
    console.log(`   Late: ${stats.late}`);
    console.log(`   Excused: ${stats.excused}`);
    console.log(`   Unmarked: ${stats.unmarked}`);
    
    const attendanceRate = stats.total > 0 ? Math.round(((stats.total - stats.unmarked) / stats.total) * 100) : 0;
    console.log(`   Attendance Rate: ${attendanceRate}%`);
    
    if (stats.unmarked === stats.total) {
      console.log('\n❌ ISSUE FOUND: All students are unmarked in backend!');
      console.log('   This explains why backendStatus is "unmarked" and backendRate is 0');
    } else if (stats.unmarked === 0) {
      console.log('\n✅ Backend shows all students marked');
    } else {
      console.log(`\n⚠️  Backend shows partial marking: ${stats.total - stats.unmarked}/${stats.total} students marked`);
    }
    
    // Show first few students and their status
    console.log('\n👥 First 5 students and their status:');
    attendanceData.slice(0, 5).forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.first_name} ${student.last_name}: ${student.status || 'unmarked'}`);
    });
  }

  // Check recent attendance records in database
  console.log('\n3. 🔍 Checking recent attendance records in database...');
  
  const { data: recentAttendance, error: recentError } = await supabase
    .from('attendance')
    .select('*')
    .eq('grade_section_id', gradeSection.id)
    .eq('date', testDate)
    .order('marked_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Error getting recent attendance:', recentError);
  } else {
    console.log(`✅ Found ${recentAttendance?.length || 0} recent attendance records`);
    
    if (recentAttendance && recentAttendance.length > 0) {
      console.log('\n📋 Recent attendance records:');
      recentAttendance.forEach((record, index) => {
        const markedTime = new Date(record.marked_at).toLocaleTimeString();
        console.log(`   ${index + 1}. Student: ${record.student_id.substring(0, 8)}... Status: ${record.status} at ${markedTime}`);
      });
    } else {
      console.log('❌ No attendance records found in database!');
      console.log('   This could explain the mismatch - frontend thinks data was saved but it wasn\'t');
    }
  }

  // Test the daily overview endpoint (what frontend likely uses)
  console.log('\n4. 🧪 Testing daily overview endpoint...');
  
  try {
    const response = await fetch(`http://localhost:5000/api/attendance/grade-sections/daily?date=${testDate}`, {
      headers: {
        'Authorization': 'Bearer demo-jwt-token-12345',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const dailyData = await response.json();
      console.log('✅ Daily overview endpoint response received');
      
      // Find Grade 1 Crimson in the response
      const crimsonRow = dailyData.rows?.find(row => row[0] === gradeSection.id);
      
      if (crimsonRow) {
        const [id, present, absent, late, excused, unmarked, total] = crimsonRow;
        console.log('\n📊 Daily Overview Data for Grade 1 Crimson:');
        console.log(`   Present: ${present}`);
        console.log(`   Absent: ${absent}`);
        console.log(`   Late: ${late}`);
        console.log(`   Excused: ${excused}`);
        console.log(`   Unmarked: ${unmarked}`);
        console.log(`   Total: ${total}`);
        
        const overviewRate = total > 0 ? Math.round(((total - unmarked) / total) * 100) : 0;
        console.log(`   Rate: ${overviewRate}%`);
        
        if (unmarked === total) {
          console.log('\n❌ Daily overview also shows all unmarked!');
        }
      } else {
        console.log('❌ Grade 1 Crimson not found in daily overview response');
      }
    } else {
      console.error('❌ Daily overview endpoint failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Error testing daily overview:', error.message);
  }

  // Check cache status
  console.log('\n5. 💾 Cache Analysis...');
  console.log('   The "ageSeconds: 11" suggests frontend cached data is 11 seconds old');
  console.log('   If backend was updated after frontend cache, this could cause the mismatch');
  console.log('   Frontend should refresh its cache or the backend cache might need invalidation');

  console.log('\n🎯 Diagnosis Summary:');
  console.log('===================');
  console.log('Frontend State:');
  console.log('   ✅ optimisticStatus: "marked"');
  console.log('   ✅ optimisticRate: 100');
  console.log('   ⚠️  ageSeconds: 11 (cached data is 11 seconds old)');
  console.log('\nBackend State:');
  console.log('   ❌ backendStatus: "unmarked"');
  console.log('   ❌ backendRate: 0');
  console.log('\nPossible Causes:');
  console.log('   1. Attendance data wasn\'t actually saved to database');
  console.log('   2. Frontend cache is stale and needs refresh');
  console.log('   3. Backend cache needs invalidation');
  console.log('   4. There was an error in the attendance marking process');
  
  console.log('\n🔧 Recommended Actions:');
  console.log('1. Check server logs for attendance marking errors');
  console.log('2. Verify attendance was actually saved to database');
  console.log('3. Clear frontend cache and refresh');
  console.log('4. Check if async notifications affected the save process');
}

debugOptimisticUpdates().catch(console.error);
