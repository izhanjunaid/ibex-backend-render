const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAsyncNotifications() {
  console.log('🧪 Testing Async Push Notifications');
  console.log('===================================\n');

  const testGradeSectionId = 'c4d0e071-7282-4d43-a68d-dc2ccc4dc136'; // Grade Pre-3 Bellflower
  const testDate = '2025-09-07';

  console.log('1. 📝 Simulating attendance marking with timing...');
  
  const startTime = Date.now();
  
  try {
    // Simulate the attendance marking API call
    const response = await fetch('http://localhost:5000/api/attendance/bulk-mark', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer demo-jwt-token-12345', // Demo token
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grade_section_id: testGradeSectionId,
        date: testDate,
        attendance_records: [
          { student_id: 'c423e2a4-0fbf-4bd0-9206-5918ddbf8414', status: 'present', notes: '' },
          { student_id: 'e89f70b1-32f4-4374-847e-afb57f8fadc8', status: 'absent', notes: '' },
          { student_id: 'b313a2e9-8519-4422-859c-eccfe7250a1f', status: 'late', notes: '' }
        ]
      })
    });

    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Attendance marked successfully in ${responseTime}ms`);
      console.log('   Response:', data.message);
      console.log('   📊 Performance Impact:');
      console.log(`      - Response Time: ${responseTime}ms`);
      console.log(`      - Expected: < 1000ms (should be much faster now)`);
      
      if (responseTime < 1000) {
        console.log('   🚀 EXCELLENT: Response is now fast!');
      } else {
        console.log('   ⚠️  Still slow - check if notifications are still blocking');
      }
      
    } else {
      console.error('❌ Attendance marking failed:', response.status);
      const errorData = await response.json();
      console.error('   Error:', errorData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n2. 📱 Checking if notifications are sent in background...');
  console.log('   (Check server logs for background notification messages)');
  
  console.log('\n🎯 What to Look For in Server Logs:');
  console.log('   ✅ "Attendance marked successfully" appears immediately');
  console.log('   ✅ "Sending push notifications in background..." appears after response');
  console.log('   ✅ "Background push notifications sent successfully" appears later');
  
  console.log('\n📊 Expected Performance Improvement:');
  console.log('   Before: 2-5 seconds (waiting for notifications)');
  console.log('   After: < 500ms (immediate response, background notifications)');
}

testAsyncNotifications().catch(console.error);
