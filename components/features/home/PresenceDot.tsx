'use client'

import { useOthers } from '@/lib/liveblocks/config'
import { useSpace } from '@/hooks/use-space'

function LivePresenceDot() {
  const others = useOthers()
  const partnerOnline = others[0]?.presence?.isOnline === true

  if (partnerOnline) {
    return (
      <span
        aria-label="Partner is online"
        className="relative inline-flex h-2.5 w-2.5"
      >
        {/* Glow ring */}
        <span className="absolute inline-flex h-full w-full animate-presence-pulse rounded-full bg-emerald-400 opacity-60" />
        {/* Solid dot */}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_2px_rgba(16,185,129,0.4)]" />
      </span>
    )
  }

  return (
    <span
      aria-label="Partner is offline"
      className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-600"
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
