const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixEmails() {
  console.log('🔍 Scanning for users with @ibex emails (missing TLD)...');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email')
    .like('email', '%@ibex');

  if (error) {
    console.error('❌ Error fetching users:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('✅ No malformed emails found.');
    return;
  }

  console.log(`Found ${users.length} users to update.`);

  const updates = users.map(u => ({
    id: u.id,
    email: u.email + '.com'
  }));

  const { data: updated, error: updErr } = await supabase
    .from('users')
    .upsert(updates, { onConflict: 'id' })
    .select('id, email');

  if (updErr) {
    console.error('❌ Update error:', updErr);
    return;
  }

  console.log('✅ Updated emails:');
  updated.forEach(u => console.log(`  ${u.email}`));
}

if (require.main === module) {
  fixEmails().then(() => process.exit()).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
