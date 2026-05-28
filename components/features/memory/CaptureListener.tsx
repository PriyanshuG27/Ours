'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSpace } from '@/hooks/use-space'
import { CaptureCamera } from './CaptureCamera'

import { Camera, X } from 'lucide-react'

export function CaptureListener() {
  const { spaceId, userId, partnerName } = useSpace()
  const [incomingCapture, setIncomingCapture] = useState<{id: string, expiresAt: string} | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (!spaceId || !userId) return

    const channel = supabase
      .channel('capture-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'capture_events',
        },
        (payload) => {
          if (payload.new.space_id !== spaceId) return

          // If partner initiated it, show notification!
          if (payload.new.initiator_id !== userId) {
            setIncomingCapture({
              id: payload.new.id,
              expiresAt: payload.new.expires_at
            })
            setIsJoined(false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [spaceId, userId])

  async function handleJoin() {
    if (!incomingCapture) return
    setIsJoining(true)
    
    try {
      const res = await fetch(`/api/capture/${incomingCapture.id}/join`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setIncomingCapture({ id: data.captureEventId, expiresAt: data.expiresAt })
        setIsJoined(true)
      }
    } finally {
      setIsJoining(false)
    }
  }

  if (!incomingCapture) return null

  // If joined, show the actual camera
  if (isJoined) {
    return (
      <CaptureCamera
        captureEventId={incomingCapture.id}
        expiresAt={incomingCapture.expiresAt}
        onComplete={() => { setIncomingCapture(null); setIsJoined(false); }}
        onExpired={() => { setIncomingCapture(null); setIsJoined(false); }}
      />
    )
  }

  // Otherwise, show the Join toast
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
      <div className="flex w-80 flex-col overflow-hidden rounded-2xl border border-indigo-500/30 bg-neutral-900/95 shadow-2xl shadow-indigo-900/20 backdrop-blur-xl">
        <div className="flex items-start justify-between p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">Capture Moment</h3>
              <p className="text-xs text-neutral-400">{partnerName ?? 'Partner'} wants to capture a memory!</p>
            </div>
          </div>
          <button 
            onClick={() => setIncomingCapture(null)}
            className="text-neutral-500 hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 pt-2">
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-50"
          >
            {isJoining ? 'Joining...' : 'Join Capture'}
          </button>
        </div>
      </div>
    </div>
  )
}
