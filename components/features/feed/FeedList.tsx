'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FeedItem } from '@/components/features/feed/FeedItem'
import type { FeedEvent } from '@/types/app.types'
import { ImageOff, Loader2 } from 'lucide-react'
import { useSpace } from '@/hooks/use-space'
import { supabase } from '@/lib/supabase/client'

interface FeedListProps {
  /** Incremented to trigger a refetch (e.g. after upload) */
  refreshKey: number
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-neutral-800/50 bg-neutral-900/40">
      <div className="aspect-[4/3] w-full bg-neutral-800/60" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 rounded bg-neutral-800" />
        <div className="h-3 w-1/2 rounded bg-neutral-800" />
      </div>
    </div>
  )
}

export function FeedList({ refreshKey }: FeedListProps) {
  const { spaceId } = useSpace()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Subscribe to real-time inserts
  useEffect(() => {
    if (!spaceId) return

    const channel = supabase
      .channel('feed-inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feed_events',
          filter: `space_id=eq.${spaceId}`,
        },
        async (payload) => {
          const newEventId = payload.new.id
          
          try {
            // Fetch the latest event from the server so it comes with a properly signed URL
            const res = await fetch('/api/feed/events?limit=1')
            if (!res.ok) return
            
            const data = await res.json()
            const fullEvent = data.events?.find((e: FeedEvent) => e.id === newEventId)
            
            if (fullEvent) {
              setEvents((prev) => {
                if (prev.some((e) => e.id === fullEvent.id)) return prev
                return [fullEvent, ...prev]
              })
            }
          } catch (err) {
            console.error('[FeedList] Failed to fetch new event:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [spaceId])

  const fetchEvents = useCallback(async (cursor?: string) => {
    const isInitial = !cursor
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/feed/events?${params.toString()}`)
      if (!res.ok) return

      const data = await res.json() as {
        events: FeedEvent[]
        nextCursor: string | null
      }

      if (isInitial) {
        setEvents(data.events)
      } else {
        setEvents((prev) => [...prev, ...data.events])
      }
      setNextCursor(data.nextCursor)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial fetch + refetch on refreshKey change
  useEffect(() => {
    setEvents([])
    setNextCursor(null)
    fetchEvents()
  }, [fetchEvents, refreshKey])

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !nextCursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          fetchEvents(nextCursor)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore, fetchEvents])

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 px-6 pt-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="rounded-2xl bg-neutral-900/40 p-4">
          <ImageOff className="h-8 w-8 text-neutral-600" />
        </div>
        <p className="mt-4 text-sm font-medium text-neutral-400">
          Nothing here yet
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Start by adding a photo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-6 pt-6 pb-12">
      {events.map((event) => (
        <FeedItem
          key={event.id}
          event={event}
        />
      ))}

      {/* Infinite scroll sentinel */}
      {nextCursor && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {loadingMore && (
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          )}
        </div>
      )}
    </div>
  )
}
