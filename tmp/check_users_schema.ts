import { createAdminClient } from '../supabase/admin';

async function checkSchema() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns in users table:', Object.keys(data[0]));
  } else {
    console.log('No users found in table.');
  }
}

checkSchema();
