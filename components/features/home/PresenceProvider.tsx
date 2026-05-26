'use client'

import { ReactNode } from 'react'
import { RoomProvider } from '@/lib/liveblocks/config'
import { useSpace } from '@/hooks/use-space'

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { spaceId, isLoaded } = useSpace()

  // During hydration or when space isn't loaded, render children without
  // the RoomProvider to prevent crashes. Once spaceId is available,
  // wrap in RoomProvider so presence hooks become active.
  if (!isLoaded || !spaceId) {
    return <>{children}</>
  }

  return (
    <RoomProvider
      id={spaceId}
      initialPresence={{ isOnline: true }}
    >
      {children}
    </RoomProvider>
  )
}
