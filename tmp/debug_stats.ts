
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkStats() {
  console.log('Checking Admin Stats...')
  const { data: adminStats, error: adminError } = await supabase.rpc('get_admin_dashboard_stats')
  if (adminError) {
    console.error('Admin Stats Error:', adminError)
  } else {
    console.log('Admin Stats Data:', adminStats)
  }

  console.log('\nChecking some links...')
  const { data: links, error: linksError } = await supabase.from('links').select('*').limit(5)
  if (linksError) {
    console.error('Links Error:', linksError)
  } else {
    console.log('Links count:', links?.length)
  }
}

checkStats()
