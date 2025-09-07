const https = require('https');

console.log('🚀 **Quick FCM System Test**');
console.log('============================');
console.log('');

// Configuration
const EDGE_FUNCTION_URL = 'https://ngbpndbjxmhffhcpkgas.supabase.co/functions/v1/push-notifications';

// Test data
const testData = {
  token: 'test_fcm_token_12345',
  userId: 'test-user-id-123'
};

console.log('**Test Configuration:**');
console.log(`Edge Function URL: ${EDGE_FUNCTION_URL}`);
console.log(`Test FCM Token: ${testData.token}`);
console.log('');

console.log('**To test the system, you need:**');
console.log('1. A valid JWT token from your app');
console.log('2. Run one of these commands:');
console.log('');

console.log('**Test 1: Register FCM Token**');
console.log('==============================');
console.log(`curl -X POST ${EDGE_FUNCTION_URL} \\`);
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "action": "register-token",');
console.log('    "data": {');
console.log(`      "token": "${testData.token}",`);
console.log('      "deviceType": "android",');
console.log('      "deviceName": "Test Device"');
console.log('    }');
console.log('  }\'');
console.log('');

console.log('**Test 2: Send Attendance Notification**');
console.log('=========================================');
console.log(`curl -X POST ${EDGE_FUNCTION_URL} \\`);
console.log('  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "action": "send-attendance-notification",');
console.log('    "data": {');
console.log(`      "studentId": "${testData.userId}",`);
console.log('      "status": "present",');
console.log('      "date": "2025-01-15",');
console.log('      "gradeSectionName": "Grade 10-A",');
console.log('      "markedBy": "teacher-123"');
console.log('    }');
console.log('  }\'');
console.log('');

console.log('**Expected Results:**');
console.log('=====================');
console.log('');

console.log('**Success Response (Token Registration):**');
console.log('{');
console.log('  "success": true,');
console.log('  "message": "FCM token registered successfully"');
console.log('}');
console.log('');

console.log('**Success Response (Attendance Notification):**');
console.log('{');
console.log('  "success": true,');
console.log('  "message": "Notification sent to 1 device(s)"');
console.log('}');
console.log('');

console.log('**What to Check:**');
console.log('==================');
console.log('');

console.log('1. **Response Status**: Should be 200 OK');
console.log('2. **Response Body**: Should contain "success": true');
console.log('3. **Database**: Check fcm_tokens and notification_history tables');
console.log('4. **Logs**: Check Edge Function logs in Supabase Dashboard');
console.log('');

console.log('**If You Get Errors:**');
console.log('======================');
console.log('');

console.log('- **401 Unauthorized**: Invalid JWT token');
console.log('- **400 Bad Request**: Invalid action or data');
console.log('- **500 Internal Error**: Check Edge Function logs');
console.log('');

console.log('**Next Steps After Testing:**');
console.log('=============================');
console.log('');

console.log('1. **If successful**: System is working! 🎉');
console.log('2. **If FCM fails**: Check service account configuration');
console.log('3. **If database fails**: Run the migration SQL');
console.log('4. **If auth fails**: Check JWT token validity');
console.log('');

console.log('**Ready to Test! 🚀**');
console.log('=====================');
console.log('');

console.log('Replace "YOUR_JWT_TOKEN_HERE" with a real JWT token');
console.log('from your app and run the curl commands above!');
console.log('');
