'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useSpace } from '@/hooks/use-space'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { PresenceDot } from '@/components/features/home/PresenceDot'
import { SettingsModal } from '@/components/features/settings/SettingsModal'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Deterministic hue from a string — gives each user a unique avatar color */
function hashToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export function HomeHeader() {
  const { spaceId, partnerName, partnerId } = useSpace()
  const { key } = useE2EEKey()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const myInitials = 'ME'
  const partnerInitials = partnerName ? getInitials(partnerName) : '?'
  const partnerHue = partnerId ? hashToHue(partnerId) : 260

  return (
    <>
      <header className="px-6 pb-4 pt-safe">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <p className="text-sm font-medium text-neutral-400">
            {partnerName ?? 'Partner'}
          </p>
          <h1 className="bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            Ours
          </h1>
          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-300 active:scale-95 flex items-center gap-2"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

      {/* Profile photo placeholders */}
      <div className="flex items-end justify-center gap-8 pt-4">
        {/* Current user */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 ring-2 ring-neutral-700/50 transition-transform hover:scale-105">
            <span className="text-sm font-semibold text-neutral-300">
              {myInitials}
            </span>
          </div>
          <span className="text-[11px] font-medium text-neutral-500">You</span>
        </div>

        {/* Connecting line — subtle visual link between the two */}
        <div className="mb-8 h-px w-8 bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

        {/* Partner */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-white/10 transition-transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, hsl(${partnerHue}, 40%, 25%), hsl(${partnerHue + 30}, 35%, 18%))`,
            }}
          >
            <span className="text-sm font-semibold text-white/80">
              {partnerInitials}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <PresenceDot />
            <span className="text-[11px] font-medium text-neutral-500">
              {partnerName ?? 'Partner'}
            </span>
          </div>
        </div>
      </div>
    </header>

    <SettingsModal 
      isOpen={isSettingsOpen} 
      onClose={() => setIsSettingsOpen(false)} 
      spaceId={spaceId} 
      e2eeKey={key} 
    />
  </>
)
}
