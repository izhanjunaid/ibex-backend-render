const fetch = require('node-fetch');

async function testCacheInvalidationFix() {
  console.log('🧪 Testing Cache Invalidation Fix');
  console.log('=================================\n');

  const testDate = '2025-09-07';
  const gradeSectionId = '5399ee52-043c-4ca2-84a2-64ab2ea88c4c'; // Grade 1 Crimson
  const headers = {
    'Authorization': 'Bearer demo-jwt-token-12345',
    'Content-Type': 'application/json'
  };

  console.log('🎯 Test Scenario: Verify batch endpoint returns fresh data after attendance marking\n');

  // Step 1: Get initial state from batch endpoint
  console.log('1️⃣ Getting initial batch overview state...');
  try {
    const initialResponse = await fetch(`http://localhost:5000/api/attendance/grade-sections/daily?date=${testDate}`, { headers });
    
    if (initialResponse.ok) {
      const initialData = await initialResponse.json();
      const crimsonRow = initialData.rows?.find(row => row[0] === gradeSectionId);
      
      if (crimsonRow) {
        const [id, present, absent, late, excused, unmarked, total] = crimsonRow;
        console.log('   📊 Initial State:');
        console.log(`      Present: ${present}, Absent: ${absent}, Unmarked: ${unmarked}, Total: ${total}`);
        console.log(`      Attendance Rate: ${total > 0 ? Math.round(((total - unmarked) / total) * 100) : 0}%`);
        console.log(`      X-Cache: ${initialResponse.headers.get('X-Cache') || 'Not set'}`);
      } else {
        console.log('   ❌ Grade 1 Crimson not found in initial response');
        return;
      }
    } else {
      console.error('   ❌ Initial request failed:', initialResponse.status);
      return;
    }
  } catch (error) {
    console.error('   ❌ Initial request error:', error.message);
    return;
  }

  // Step 2: Mark attendance
  console.log('\n2️⃣ Marking attendance (this should trigger cache invalidation)...');
  try {
    const attendancePayload = {
      grade_section_id: gradeSectionId,
      date: testDate,
      attendance_records: [
        { student_id: '00c1c707-e5a7-4b5e-9d6c-8f2e1a3b4c5d', status: 'present', notes: 'Test marking' },
        { student_id: '7d2ff5c8-a1b2-3c4d-5e6f-7g8h9i0j1k2l', status: 'absent', notes: 'Test marking' }
      ]
    };

    const markingResponse = await fetch('http://localhost:5000/api/attendance/bulk-mark', {
      method: 'POST',
      headers,
      body: JSON.stringify(attendancePayload)
    });

    if (markingResponse.ok) {
      const markingData = await markingResponse.json();
      console.log('   ✅ Attendance marked successfully');
      console.log('   📝 Response:', markingData.message);
      console.log('   ⏱️  Check server logs for cache invalidation messages:');
      console.log('       💾 [CACHE] Invalidating all attendance-related caches...');
      console.log('       💾 [CACHE] Invalidated: attendance_daily_2025-09-07');
      console.log('       💾 [CACHE] Invalidated: grade_sections_daily_2025-09-07');
      console.log('       ✅ [CACHE] Successfully invalidated X cache keys');
    } else {
      console.error('   ❌ Attendance marking failed:', markingResponse.status);
      const errorData = await markingResponse.json();
      console.error('   Error:', errorData);
      return;
    }
  } catch (error) {
    console.error('   ❌ Attendance marking error:', error.message);
    return;
  }

  // Step 3: Immediately check batch endpoint again
  console.log('\n3️⃣ Immediately checking batch endpoint for fresh data...');
  try {
    // Small delay to ensure cache invalidation completed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const freshResponse = await fetch(`http://localhost:5000/api/attendance/grade-sections/daily?date=${testDate}`, { headers });
    
    if (freshResponse.ok) {
      const freshData = await freshResponse.json();
      const freshCrimsonRow = freshData.rows?.find(row => row[0] === gradeSectionId);
      
      if (freshCrimsonRow) {
        const [id, present, absent, late, excused, unmarked, total] = freshCrimsonRow;
        console.log('   📊 Fresh State:');
        console.log(`      Present: ${present}, Absent: ${absent}, Unmarked: ${unmarked}, Total: ${total}`);
        console.log(`      Attendance Rate: ${total > 0 ? Math.round(((total - unmarked) / total) * 100) : 0}%`);
        console.log(`      X-Cache: ${freshResponse.headers.get('X-Cache') || 'Not set'}`);
        
        // Verify the fix worked
        const cacheStatus = freshResponse.headers.get('X-Cache');
        if (cacheStatus === 'MISS') {
          console.log('   ✅ SUCCESS: Cache was invalidated (X-Cache: MISS)');
          console.log('   ✅ SUCCESS: Batch endpoint returned fresh data');
        } else if (cacheStatus === 'HIT') {
          console.log('   ❌ ISSUE: Cache was not invalidated (X-Cache: HIT)');
          console.log('   ❌ ISSUE: Batch endpoint returned stale cached data');
        } else {
          console.log('   ⚠️  UNCLEAR: No X-Cache header found');
        }
        
        // Check if data reflects the changes
        if (unmarked < total) {
          console.log('   ✅ SUCCESS: Data shows marked attendance');
        } else {
          console.log('   ❌ ISSUE: Data still shows all unmarked');
        }
        
      } else {
        console.log('   ❌ Grade 1 Crimson not found in fresh response');
      }
    } else {
      console.error('   ❌ Fresh request failed:', freshResponse.status);
    }
  } catch (error) {
    console.error('   ❌ Fresh request error:', error.message);
  }

  // Step 4: Test cache hit on second request
  console.log('\n4️⃣ Testing cache hit on second request...');
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const secondResponse = await fetch(`http://localhost:5000/api/attendance/grade-sections/daily?date=${testDate}`, { headers });
    
    if (secondResponse.ok) {
      const cacheStatus = secondResponse.headers.get('X-Cache');
      console.log(`   📊 Second request X-Cache: ${cacheStatus || 'Not set'}`);
      
      if (cacheStatus === 'HIT') {
        console.log('   ✅ SUCCESS: Cache is working (second request was cached)');
      } else {
        console.log('   ⚠️  Note: Second request was not cached (this is okay)');
      }
    }
  } catch (error) {
    console.error('   ❌ Second request error:', error.message);
  }

  console.log('\n🎯 Test Summary:');
  console.log('================');
  console.log('✅ What should happen:');
  console.log('   1. Initial request shows current state');
  console.log('   2. Attendance marking succeeds');
  console.log('   3. Cache invalidation logs appear in server console');
  console.log('   4. Fresh request shows X-Cache: MISS');
  console.log('   5. Fresh data reflects the attendance changes');
  console.log('   6. Second request shows X-Cache: HIT (new cache)');
  
  console.log('\n📋 Check Server Logs For:');
  console.log('   💾 [CACHE] Invalidating all attendance-related caches...');
  console.log('   💾 [CACHE] Invalidated: attendance_daily_2025-09-07');
  console.log('   💾 [CACHE] Invalidated: grade_sections_daily_2025-09-07');
  console.log('   ✅ [CACHE] Successfully invalidated X cache keys');
  
  console.log('\n🔧 If Issues Persist:');
  console.log('   1. Check if cache keys match exactly');
  console.log('   2. Verify cache invalidation logs appear');
  console.log('   3. Test with different grade sections');
  console.log('   4. Check for any cache middleware conflicts');
}

testCacheInvalidationFix().catch(console.error);
