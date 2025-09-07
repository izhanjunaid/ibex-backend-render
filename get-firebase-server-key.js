const fs = require('fs');
const path = require('path');

console.log('🔑 **Alternative Ways to Get Firebase Server Key**');
console.log('==================================================');
console.log('');

console.log('**Method 1: Google Cloud Console**');
console.log('1. Go to: https://console.cloud.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: APIs & Services → Credentials');
console.log('4. Look for "API Keys" section');
console.log('5. Create new API key or use existing one');
console.log('');

console.log('**Method 2: Firebase Console - Different Location**');
console.log('1. Go to: https://console.firebase.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: Project Settings → Service Accounts');
console.log('4. Click "Generate new private key"');
console.log('5. Look for "server_key" in the downloaded JSON');
console.log('');

console.log('**Method 3: Manual Server Key Creation**');
console.log('1. Go to: https://console.firebase.google.com/');
console.log('2. Select project: ibex-a6bcd');
console.log('3. Go to: Project Settings → Cloud Messaging');
console.log('4. Try clicking "Manage" next to Service Account');
console.log('5. Look for "Server key" in the service account settings');
console.log('');

console.log('**Method 4: Use Google Cloud CLI**');
console.log('1. Install Google Cloud CLI');
console.log('2. Run: gcloud auth login');
console.log('3. Run: gcloud config set project ibex-a6bcd');
console.log('4. Run: gcloud iam service-accounts keys create key.json --iam-account=firebase-adminsdk-fbsvc@ibex-a6bcd.iam.gserviceaccount.com');
console.log('');

console.log('**Quick Test: Try This First**');
console.log('1. Go to Firebase Console → Project Settings → Cloud Messaging');
console.log('2. Look for any "Server key" or "API key" field');
console.log('3. If you see "Sender ID: 905626789604", try using that as a reference');
console.log('');

console.log('**If All Else Fails: Use V1 API**');
console.log('We can modify the Edge Function to use your service account JSON directly');
console.log('This would be more secure and use the modern API');
console.log('');

// Read the service account file to show details
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
  console.log('2. If you find it, add it as FIREBASE_SERVER_KEY secret in Supabase');
  console.log('3. If not, we can update the Edge Function to use V1 API');
  console.log('');
  
} catch (error) {
  console.log('Could not read service account file');
}
