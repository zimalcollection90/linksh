import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pgakgajivcxbssktirqf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYWtnYWppdmN4YnNza3RpcnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjg4NCwiZXhwIjoyMDkwNDI4ODg0fQ.tpweecOj380uX8davAw_EjX_uwQ4NkuSiNljf7RdZ-A'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkClicks() {
  const { data, error } = await supabase
    .from('click_events')
    .select('*')
    .order('clicked_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching clicks:', error)
    return
  }

  console.log('Recent Clicks:')
  data.forEach((click, index) => {
    console.log(`[${index + 1}] Time: ${click.clicked_at}, IP: ${click.ip_address}, UA: ${click.user_agent}, Referrer: ${click.referrer}, Bot: ${click.is_bot}, Filtered: ${click.is_filtered}, Reason: ${click.filter_reason}`)
  })
}

checkClicks()
