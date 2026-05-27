import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role to bypass RLS for deletion

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetDb() {
  console.log('Deleting all feed events...')
  const { error: feedError } = await supabase
    .from('feed_events')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all

  if (feedError) console.error('Error deleting feed events:', feedError)
  else console.log('Feed events deleted.')

  console.log('Deleting all spaces...')
  const { error: spaceError } = await supabase
    .from('spaces')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all

  if (spaceError) console.error('Error deleting spaces:', spaceError)
  else console.log('Spaces deleted.')

  console.log('Done!')
}

resetDb()
