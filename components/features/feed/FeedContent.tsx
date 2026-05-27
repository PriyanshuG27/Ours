'use client'

import { useState } from 'react'
import { PhotoUploader } from '@/components/features/feed/PhotoUploader'
import { FeedList } from '@/components/features/feed/FeedList'

export function FeedContent() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="relative min-h-screen bg-black">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-violet-900/15 blur-[100px]" />
        <div className="absolute right-0 top-1/2 h-48 w-48 rounded-full bg-sky-900/10 blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="px-6 pb-2 pt-safe">
          <h1 className="py-4 text-lg font-bold tracking-tight text-white">
            Feed
          </h1>
        </header>

        <PhotoUploader onSuccess={() => setRefreshKey((k) => k + 1)} />
        <FeedList refreshKey={refreshKey} />
      </div>
    </div>
  )
}
