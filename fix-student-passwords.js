const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 Finding students with NULL password_hash');
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'student')
    .is('password_hash', null);
  if (error) {
    console.error(error); return;
  }
  console.log(`Found ${users.length} students to update`);
  if (users.length === 0) return;
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('ibex123', salt);
  const updates = users.map(u=>({id:u.id, password_hash:hash}));
  const { error: upErr } = await supabase.from('users').upsert(updates, { onConflict:'id'});
  if (upErr) console.error(upErr);
  else console.log('✅ Passwords fixed');
}
if(require.main===module){main();}