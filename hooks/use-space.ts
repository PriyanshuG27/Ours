'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSpaceStore } from '@/store/space.store'

export function useSpace() {
  const {
    spaceId,
    userId,
    partnerId,
    partnerName,
    isLoaded,
    setSpace,
    setLoaded,
  } = useSpaceStore()

  useEffect(() => {
    if (isLoaded) return

    let cancelled = false

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (cancelled) return
        if (!user) {
          setLoaded()
          return
        }

        const { data: spaces } = await supabase
          .from('spaces')
          .select('id, users, user_names')
          .eq('is_active', true)
          .limit(1)

        if (cancelled) return

        const space = spaces?.[0]

        if (!space) {
          setLoaded()
          return
        }

        const users = space.users as string[]
        const userNames = space.user_names as string[]
        const userIndex = users.indexOf(user.id)

        if (userIndex === -1) {
          setLoaded()
          return
        }

        const partnerIndex = userIndex === 0 ? 1 : 0
        const pId = users[partnerIndex] ?? null
        const pName = userNames[partnerIndex] ?? null

        if (pId && pName) {
          setSpace(space.id as string, user.id, pId, pName)
        } else {
          setLoaded()
        }
      } catch (err) {
        console.error('[use-space] load error:', err)
        if (!cancelled) {
          setLoaded()
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [isLoaded, setSpace, setLoaded])

  return { spaceId, userId, partnerId, partnerName, isLoaded }
}
