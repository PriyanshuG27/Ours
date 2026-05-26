'use client'

import { PresenceProvider } from '@/components/features/home/PresenceProvider'
import { HomeHeader } from '@/components/features/home/HomeHeader'
import { QuickNav } from '@/components/features/home/QuickNav'

export function HomeContent() {
  return (
    <PresenceProvider>
      <div className="min-h-screen bg-black">
        <HomeHeader />
        <QuickNav />
      </div>
    </PresenceProvider>
  )
}
