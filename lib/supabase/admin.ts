import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/database.types'

export const adminClient = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)