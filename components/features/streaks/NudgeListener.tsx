'use client'

import { useEventListener } from '@/lib/liveblocks/config'
import { BellRing } from 'lucide-react'
import { useState } from 'react'

export function NudgeListener() {
  const [toast, setToast] = useState<string | null>(null)

  useEventListener(({ event }) => {
    if (event.type === 'NUDGE') {
      setToast('Your partner is nudging you to complete a task! 👀')
      // Auto-hide after 5s
      setTimeout(() => setToast(null), 5000)
    }
  })

  if (!toast) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 bg-violet-600 text-white px-5 py-3 rounded-full shadow-lg shadow-violet-900/50">
        <BellRing className="h-5 w-5 animate-pulse" />
        <span className="font-medium text-sm">{toast}</span>
      </div>
    </div>
  )
}
