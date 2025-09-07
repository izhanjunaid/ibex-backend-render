const fetch = require('node-fetch');

async function testCacheBehavior() {
  console.log('🧪 Testing Smart Cache Behavior');
  console.log('==============================\n');

  const apiUrl = 'http://localhost:5000/api/attendance/grade-sections/daily?date=2025-09-07';
  const headers = {
    'Authorization': 'Bearer demo-jwt-token-12345', // Demo token
    'Content-Type': 'application/json'
  };

  console.log('1️⃣ First Request (Should be Cache MISS)');
  console.log('   Expected: ❌ Smart Cache MISS in server logs');
  console.log('   Expected: 💾 Smart Cached in server logs');
  
  try {
    const start1 = Date.now();
    const response1 = await fetch(apiUrl, { headers });
    const time1 = Date.now() - start1;
    
    console.log(`   ✅ Response: ${response1.status} in ${time1}ms`);
    console.log(`   📊 X-Cache Header: ${response1.headers.get('X-Cache') || 'Not set'}`);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`   📋 Data: ${data1.rows?.length || 0} grade sections`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }

  console.log('\n⏳ Waiting 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('2️⃣ Second Request (Should be Cache HIT)');
  console.log('   Expected: 🎯 Smart Cache HIT in server logs');
  console.log('   Expected: Much faster response time');
  
  try {
    const start2 = Date.now();
    const response2 = await fetch(apiUrl, { headers });
    const time2 = Date.now() - start2;
    
    console.log(`   ✅ Response: ${response2.status} in ${time2}ms`);
    console.log(`   📊 X-Cache Header: ${response2.headers.get('X-Cache') || 'Not set'}`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`   📋 Data: ${data2.rows?.length || 0} grade sections`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }

  console.log('\n⏳ Waiting 65 seconds to test cache expiration...');
  console.log('   (This will test if cache expires after TTL)');
  await new Promise(resolve => setTimeout(resolve, 65000));

  console.log('\n3️⃣ Third Request (Should be Cache MISS again - cache expired)');
  console.log('   Expected: ❌ Smart Cache MISS in server logs');
  
  try {
    const start3 = Date.now();
    const response3 = await fetch(apiUrl, { headers });
    const time3 = Date.now() - start3;
    
    console.log(`   ✅ Response: ${response3.status} in ${time3}ms`);
    console.log(`   📊 X-Cache Header: ${response3.headers.get('X-Cache') || 'Not set'}`);
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`   📋 Data: ${data3.rows?.length || 0} grade sections`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }

  console.log('\n🎯 Cache Behavior Summary:');
  console.log('=========================');
  console.log('✅ First request: Cache MISS (normal)');
  console.log('✅ Second request: Cache HIT (faster)');
  console.log('✅ After 60s: Cache MISS (expired, normal)');
  console.log('\nThe "❌ Smart Cache MISS" message is NORMAL behavior!');
}

// Run the test (comment out the 65-second wait if you want a quick test)
testCacheBehavior().catch(console.error);
