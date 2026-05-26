'use client'

import { useOthers } from '@/lib/liveblocks/config'
import { useSpace } from '@/hooks/use-space'

function LivePresenceDot() {
  const others = useOthers()
  const partnerOnline = others[0]?.presence?.isOnline === true

  return (
    <span
      aria-label={partnerOnline ? 'Partner is online' : 'Partner is offline'}
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        partnerOnline
          ? 'bg-emerald-500 animate-pulse'
          : 'bg-neutral-600'
      }`}
    />
  )
}

export function PresenceDot() {
  const { spaceId, isLoaded } = useSpace()

  // When RoomProvider hasn't mounted yet, render a static grey dot
  // to avoid the "RoomProvider is missing" crash from useOthers()
  if (!isLoaded || !spaceId) {
    return (
      <span
        aria-label="Partner is offline"
        className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-600"
      />
    )
  }

  return <LivePresenceDot />
}
