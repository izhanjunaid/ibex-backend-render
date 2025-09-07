const fetch = require('node-fetch');

async function testIfCacheInvalidationRuns() {
  console.log('🔍 Testing If Cache Invalidation Code Is Running');
  console.log('===============================================\n');

  console.log('This test will help us determine if:');
  console.log('1. The server is running the updated code');
  console.log('2. The cache invalidation code is actually executing');
  console.log('3. There might be other issues preventing it from working');
  console.log('');

  // Test with a minimal attendance record
  const testPayload = {
    grade_section_id: '5399ee52-043c-4ca2-64a2-64ab2ea88c4c', // Grade 1 Crimson
    date: '2025-09-07',
    attendance_records: [
      {
        student_id: 'test-student-' + Date.now(),
        status: 'present',
        notes: 'Cache invalidation test'
      }
    ]
  };

  const headers = {
    'Authorization': 'Bearer demo-jwt-token-12345', // Using demo token for testing
    'Content-Type': 'application/json'
  };

  console.log('📝 Sending test bulk-mark request...');
  console.log('   Grade Section: Grade 1 Crimson');
  console.log('   Date: 2025-09-07');
  console.log('   Records: 1 test student');
  console.log('');

  try {
    const response = await fetch('http://localhost:5000/api/attendance/bulk-mark', {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload)
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Bulk-mark request succeeded!');
      console.log('   Response:', data.message);
      console.log('');
      
      console.log('🔍 NOW CHECK YOUR SERVER CONSOLE FOR THESE LOGS:');
      console.log('================================================');
      console.log('');
      console.log('1️⃣ ATTENDANCE MARKING SUCCESS:');
      console.log('   ✅ [ATTENDANCE] Successfully marked attendance: {...}');
      console.log('');
      console.log('2️⃣ CACHE INVALIDATION START:');
      console.log('   💾 [CACHE] Invalidating all attendance-related caches...');
      console.log('');
      console.log('3️⃣ INDIVIDUAL CACHE DELETIONS:');
      console.log('   💾 [CACHE] Invalidated: date:2025-09-07:user:demo-user-1:/api/attendance/grade-sections/daily?date=2025-09-07:');
      console.log('   💾 [CACHE] Invalidated: user:demo-user-1:/api/attendance/grade-sections/daily?date=2025-09-07:');
      console.log('   💾 [CACHE] Invalidated: attendance_5399ee52-043c-4ca2-64a2-64ab2ea88c4c_2025-09-07');
      console.log('   ... (more cache keys)');
      console.log('');
      console.log('4️⃣ WILDCARD CACHE DELETIONS:');
      console.log('   💾 [CACHE] Cleared X wildcard caches matching: date:2025-09-07:user:*:/api/attendance/grade-sections/daily*');
      console.log('');
      console.log('5️⃣ CACHE INVALIDATION COMPLETE:');
      console.log('   ✅ [CACHE] Successfully invalidated X cache keys');
      console.log('');
      console.log('6️⃣ PUSH NOTIFICATIONS (BACKGROUND):');
      console.log('   📱 Sending push notifications in background...');
      console.log('   ✅ Background push notifications sent successfully');
      console.log('');
      
    } else {
      console.error('❌ Bulk-mark request failed!');
      console.error('   Status:', response.status);
      
      if (response.status === 401) {
        console.log('');
        console.log('🔑 AUTHENTICATION ISSUE DETECTED:');
        console.log('   The server might not be in demo mode, or there\'s an auth issue.');
        console.log('   Try these solutions:');
        console.log('   1. Make sure server is running with DEMO_MODE=true');
        console.log('   2. Or update the Authorization header with a real JWT token');
        console.log('   3. Check if server.js has demo mode enabled');
      } else if (response.status === 404) {
        console.log('');
        console.log('🔗 ENDPOINT NOT FOUND:');
        console.log('   The server might not be running or the route doesn\'t exist.');
        console.log('   Make sure your server is running on localhost:5000');
      }
      
      try {
        const errorData = await response.json();
        console.error('   Error details:', errorData);
      } catch (e) {
        console.error('   Could not parse error response');
      }
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Make sure your server is running: npm start');
    console.log('   2. Check if server is listening on localhost:5000');
    console.log('   3. Verify no firewall is blocking the connection');
    console.log('   4. Try accessing http://localhost:5000/api/health in browser');
  }

  console.log('');
  console.log('📋 WHAT TO DO NEXT:');
  console.log('===================');
  console.log('');
  console.log('IF YOU SEE ALL THE CACHE LOGS ABOVE:');
  console.log('✅ Cache invalidation is working');
  console.log('✅ The issue might be elsewhere (frontend, timing, etc.)');
  console.log('');
  console.log('IF YOU DON\'T SEE THE CACHE LOGS:');
  console.log('❌ Cache invalidation code is not running');
  console.log('❌ Server might not be using updated code');
  console.log('❌ Need to restart server or check for errors');
  console.log('');
  console.log('IF YOU SEE ERRORS:');
  console.log('⚠️  Fix the errors first, then test again');
  console.log('⚠️  Check server logs for any startup issues');
}

testIfCacheInvalidationRuns().catch(console.error);
