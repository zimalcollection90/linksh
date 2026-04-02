const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('click_events')
    .select('id, ip_address, country, country_code, user_agent, clicked_at')
    .or('country.is.null,country.eq.Unknown,country_code.eq.XX,country.eq.Unknown Location')
    .order('clicked_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${data.length} problematic records:`);
  console.table(data.map(d => ({
    id: d.id,
    ip: d.ip_address,
    country: d.country,
    code: d.country_code,
    ua: d.user_agent?.substring(0, 40)
  })));
}

inspect();
