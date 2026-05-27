'use client'

import { HomeHeader } from '@/components/features/home/HomeHeader'
import { QuickNav } from '@/components/features/home/QuickNav'

export function HomeContent() {
  return (
    <div className="relative min-h-screen bg-black">
      {/* Ambient background glow — purely decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-900/20 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-emerald-900/10 blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <HomeHeader />
        <QuickNav />
      </div>
    </div>
  )
}
