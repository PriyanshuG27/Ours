import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/space/sever
 *
 * Initiates space dissolution (Sever Protocol).
 * Either user can trigger — no partner approval required.
 *
 * Sets is_active = false and severed_at = now().
 * Both users immediately lose access (middleware + SpaceGuard redirect to /setup).
 * Data is retained for 30 days before hard deletion via cleanup_severed_spaces().
 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find user's active space
  const { data: spaces } = await supabase
    .from('spaces')
    .select('id')
    .eq('is_active', true)
    .limit(1)

  const spaceId = spaces?.[0]?.id as string | undefined

  if (!spaceId) {
    return NextResponse.json(
      { error: 'No active space found' },
      { status: 404 }
    )
  }

  // Sever the space: deactivate + timestamp for 30-day retention window
  const { error: updateError } = await supabase
    .from('spaces')
    .update({
      is_active: false,
      severed_at: new Date().toISOString(),
    })
    .eq('id', spaceId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to sever space' },
      { status: 500 }
    )
  }

  return NextResponse.json({ severed: true })
}
