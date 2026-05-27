import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SpaceSetup } from '@/components/features/auth/SpaceSetup'

export default async function SetupPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: spaces } = await supabase
    .from('spaces')
    .select('id')
    .eq('is_active', true)
    .limit(1)

  const hasSpace = spaces && spaces.length > 0

  // User already has a space → go home
  if (hasSpace) {
    redirect('/home')
  }

  // No space yet → show space creation/join flow
  return <SpaceSetup />
}
