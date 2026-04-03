import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pgakgajivcxbssktirqf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYWtnYWppdmN4YnNza3RpcnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjg4NCwiZXhwIjoyMDkwNDI4ODg0fQ.tpweecOj380uX8davAw_EjX_uwQ4NkuSiNljf7RdZ-A'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkClicks() {
  const { data, error } = await supabase
    .from('click_events')
    .select('*')
    .order('clicked_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching clicks:', error)
    return
  }

  // Group by UA
  const uaStats: Record<string, number> = {}
  data.forEach(click => {
    const ua = click.user_agent || 'EMPTY'
    uaStats[ua] = (uaStats[ua] || 0) + 1
  })

  console.log('User Agent Stats (Last 100):')
  const sortedStats = Object.entries(uaStats).sort((a, b) => b[1] - a[1])
  sortedStats.forEach(([ua, count]) => {
    console.log(`${count}x - ${ua}`)
  })
}

checkClicks()
