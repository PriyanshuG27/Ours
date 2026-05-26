'use client'

import { Settings } from 'lucide-react'
import { useSpace } from '@/hooks/use-space'
import { PresenceDot } from '@/components/features/home/PresenceDot'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function HomeHeader() {
  const { partnerName, userId } = useSpace()

  // Derive a display initial for the current user.
  // We don't store our own name in the Zustand store (only partner),
  // so we show a generic "Me" placeholder.
  const myInitials = 'ME'
  const partnerInitials = partnerName ? getInitials(partnerName) : '?'

  return (
    <header className="px-6 pb-4 pt-safe">
      {/* Top bar */}
      <div className="flex items-center justify-between py-4">
        <p className="text-sm font-medium text-neutral-400">
          {partnerName ?? 'Partner'}
        </p>
        <h1 className="text-lg font-bold tracking-tight text-white">Ours</h1>
        <button
          aria-label="Settings"
          className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-300"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Profile photo placeholders */}
      <div className="flex items-end justify-center gap-6 pt-2">
        {/* Current user */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 ring-2 ring-neutral-700">
            <span className="text-sm font-semibold text-neutral-300">
              {myInitials}
            </span>
          </div>
          <span className="text-[11px] text-neutral-500">You</span>
        </div>

        {/* Partner */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800 ring-2 ring-neutral-700">
            <span className="text-sm font-semibold text-neutral-300">
              {partnerInitials}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <PresenceDot />
            <span className="text-[11px] text-neutral-500">
              {partnerName ?? 'Partner'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
