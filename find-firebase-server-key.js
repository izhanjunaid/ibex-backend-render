const fs = require('fs');
const path = require('path');

console.log('🔑 **Finding Firebase Server Key - Complete Guide**');
console.log('==================================================');
console.log('');

console.log('**Method 1: Google Cloud Console (Most Likely)**');
console.log('1. Go to: https://console.cloud.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: APIs & Services → Credentials');
console.log('4. Look for "API Keys" section');
console.log('5. Create new API key or use existing one');
console.log('6. Copy the API key (starts with AIza...)');
console.log('');

console.log('**Method 2: Firebase Console - Service Accounts**');
console.log('1. Go to: https://console.firebase.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: Project Settings → Service Accounts');
console.log('4. Click "Generate new private key"');
console.log('5. Download the JSON file');
console.log('6. Look for "server_key" field in the JSON');
console.log('');

console.log('**Method 3: Firebase Console - Cloud Messaging**');
console.log('1. Go to: https://console.firebase.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: Project Settings → Cloud Messaging');
console.log('4. Look for "Server key" field');
console.log('5. If not visible, try clicking "Manage" next to Service Account');
console.log('');

console.log('**Method 4: Google Cloud CLI**');
console.log('1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install');
console.log('2. Run: gcloud auth login');
console.log('3. Run: gcloud config set project ibex-a6bcd');
console.log('4. Run: gcloud iam service-accounts keys create key.json --iam-account=firebase-adminsdk-fbsvc@ibex-a6bcd.iam.gserviceaccount.com');
console.log('5. Check the generated key.json for server_key');
console.log('');

console.log('**Method 5: Direct API Call**');
console.log('1. Go to: https://console.cloud.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: APIs & Services → Enabled APIs');
console.log('4. Search for "Firebase Cloud Messaging API"');
console.log('5. Click on it and look for credentials');
console.log('');

console.log('**What the Server Key Looks Like:**');
console.log('- Starts with: AAAA... or AIza...');
console.log('- Length: Usually 150+ characters');
console.log('- Format: AAAA1234567890abcdefghijklmnopqrstuvwxyz...');
console.log('');

console.log('**Alternative: Use V1 API with Service Account**');
console.log('If you can\'t find the server key, we can use your service account JSON');
console.log('This is actually more secure and modern!');
console.log('');

// Read the service account file
try {
  const serviceAccountPath = path.join(__dirname, 'ibex-a6bcd-4944bcb6c104.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('**Your Current Service Account Details:**');
  console.log(`Project ID: ${serviceAccount.project_id}`);
  console.log(`Client Email: ${serviceAccount.client_email}`);
  console.log(`Private Key ID: ${serviceAccount.private_key_id}`);
  console.log('');
  
  console.log('**Next Steps:**');
  console.log('1. Try the methods above to find the server key');
  console.log('2. If you find it, we\'ll update the Edge Function');
  console.log('3. If not, we\'ll use V1 API with your service account');
  console.log('');
  
} catch (error) {
  console.log('Could not read service account file');
}

console.log('**Quick Test Commands:**');
console.log('Once you have the server key, test it with:');
console.log('curl -X POST https://fcm.googleapis.com/fcm/send \\');
console.log('  -H "Authorization: key=YOUR_SERVER_KEY" \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"to":"test_token","notification":{"title":"Test","body":"Test message"}}\'');
console.log('');
