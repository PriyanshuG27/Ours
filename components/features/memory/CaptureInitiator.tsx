'use client'

import { useState, useEffect } from 'react'
import { Camera, Loader2, Users } from 'lucide-react'
import { CaptureCamera } from './CaptureCamera'
import { supabase } from '@/lib/supabase/client'

type InitiatorState =
  | { phase: 'idle' }
  | { phase: 'initiating' }
  | { phase: 'waiting'; captureEventId: string; expiresAt: string }
  | { phase: 'capturing'; captureEventId: string; expiresAt: string }
  | { phase: 'complete' }
  | { phase: 'expired' }
  | { phase: 'error'; message: string }

export function CaptureInitiator() {
  const [state, setState] = useState<InitiatorState>({ phase: 'idle' })

  useEffect(() => {
    if (state.phase !== 'waiting') return

    const channel = supabase
      .channel(`capture-wait-${state.captureEventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'capture_events',
          filter: `id=eq.${state.captureEventId}`
        },
        (payload) => {
          if (payload.new.partner_joined) {
            setState({
              phase: 'capturing',
              captureEventId: payload.new.id,
              expiresAt: payload.new.expires_at
            })
          }
        }
      )
      .subscribe()

    // Setup fallback timer to launch solo capture if partner doesn't join
    const msLeft = new Date(state.expiresAt).getTime() - Date.now()
    const timer = setTimeout(() => {
      // If timer runs out while waiting, force open camera for solo capture
      setState(prev => prev.phase === 'waiting' ? {
        phase: 'capturing',
        captureEventId: prev.captureEventId,
        expiresAt: prev.expiresAt
      } : prev)
    }, Math.max(0, msLeft))

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(timer)
    }
  }, [state])

  async function handleInitiate() {
    setState({ phase: 'initiating' })

    try {
      const res = await fetch('/api/capture/initiate', { method: 'POST' })

      if (res.status === 429) {
        setState({
          phase: 'error',
          message: 'You already captured this hour. Try again later!',
        })
        setTimeout(() => setState({ phase: 'idle' }), 3000)
        return
      }

      if (!res.ok) {
        setState({ phase: 'error', message: 'Failed to start capture' })
        setTimeout(() => setState({ phase: 'idle' }), 3000)
        return
      }

      const data = (await res.json()) as {
        captureEventId: string
        expiresAt: string
      }

      setState({
        phase: 'waiting',
        captureEventId: data.captureEventId,
        expiresAt: data.expiresAt,
      })
    } catch {
      setState({ phase: 'error', message: 'Something went wrong' })
      setTimeout(() => setState({ phase: 'idle' }), 3000)
    }
  }

  function handleComplete() {
    setState({ phase: 'complete' })
    setTimeout(() => setState({ phase: 'idle' }), 3000)
  }

  function handleExpired() {
    setState({ phase: 'expired' })
    setTimeout(() => setState({ phase: 'idle' }), 3000)
  }

  // Render camera overlay when capturing
  if (state.phase === 'capturing') {
    return (
      <CaptureCamera
        captureEventId={state.captureEventId}
        expiresAt={state.expiresAt}
        onComplete={handleComplete}
        onExpired={handleExpired}
      />
    )
  }

  // Result states
  if (state.phase === 'waiting') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Waiting for partner...
      </div>
    )
  }

  if (state.phase === 'complete') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-400">
        ✓ Captured!
      </div>
    )
  }

  if (state.phase === 'expired') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-400">
        ⏱ Time&apos;s up
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400">
        {state.message}
      </div>
    )
  }

  return (
    <button
      onClick={handleInitiate}
      disabled={state.phase === 'initiating'}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all hover:shadow-rose-500/30 active:scale-95 disabled:opacity-60"
    >
      {state.phase === 'initiating' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting…
        </>
      ) : (
        <>
          <Camera className="h-4 w-4" />
          Capture Moment
        </>
      )}
    </button>
  )
}
