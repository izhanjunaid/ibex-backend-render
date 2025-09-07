const fs = require('fs');
const path = require('path');

// Read the Firebase service account JSON file
const serviceAccountPath = path.join(__dirname, 'ibex-a6bcd-4944bcb6c104.json');

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('🔑 Firebase Service Account Details:');
  console.log('=====================================');
  console.log(`Project ID: ${serviceAccount.project_id}`);
  console.log(`Client Email: ${serviceAccount.client_email}`);
  console.log(`Private Key ID: ${serviceAccount.private_key_id}`);
  console.log('');
  
  console.log('📋 Next Steps:');
  console.log('==============');
  console.log('');
  console.log('1. Go to Firebase Console → Project Settings → Cloud Messaging');
  console.log('2. Enable "Cloud Messaging API (Legacy)" temporarily');
  console.log('3. Look for a "Server key" field that appears');
  console.log('4. Copy that server key');
  console.log('');
  console.log('5. Add the server key to your environment:');
  console.log('   FIREBASE_SERVER_KEY=your_server_key_here');
  console.log('');
  console.log('6. Deploy the Edge Function:');
  console.log('   npx supabase functions deploy push-notifications');
  console.log('');
  console.log('7. Test the system:');
  console.log('   node test-push-notifications.js');
  console.log('');
  
  // Create a .env.example file
  const envExample = `# Firebase Configuration
FIREBASE_SERVER_KEY=your_server_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Other Configuration
NODE_ENV=production
`;

  fs.writeFileSync('.env.example', envExample);
  console.log('✅ Created .env.example file with Firebase configuration template');
  console.log('');
  console.log('⚠️  Important: Keep your service account JSON file secure!');
  console.log('   Never commit it to version control.');
  
} catch (error) {
  console.error('❌ Error reading service account file:', error.message);
  console.log('');
  console.log('Make sure the file "ibex-a6bcd-4944bcb6c104.json" is in the current directory');
}
