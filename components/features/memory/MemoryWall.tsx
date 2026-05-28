'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bookmark, Shuffle, X, Camera, AlertCircle } from 'lucide-react'
import { useSpace } from '@/hooks/use-space'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { EncryptedImage } from '@/components/features/feed/EncryptedImage'
import { supabase } from '@/lib/supabase/client'
import type { FeedEvent } from '@/types/app.types'

/** Relative time using Intl.RelativeTimeFormat */
function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSeconds = Math.round((then - now) / 1000)

  const units: { unit: Intl.RelativeTimeFormatUnit; threshold: number }[] = [
    { unit: 'year', threshold: 60 * 60 * 24 * 365 },
    { unit: 'month', threshold: 60 * 60 * 24 * 30 },
    { unit: 'week', threshold: 60 * 60 * 24 * 7 },
    { unit: 'day', threshold: 60 * 60 * 24 },
    { unit: 'hour', threshold: 60 * 60 },
    { unit: 'minute', threshold: 60 },
    { unit: 'second', threshold: 1 },
  ]

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  for (const { unit, threshold } of units) {
    if (Math.abs(diffSeconds) >= threshold) {
      const value = Math.round(diffSeconds / threshold)
      return rtf.format(value, unit)
    }
  }

  return 'just now'
}

interface DecryptedItem {
  event: FeedEvent
  caption: string | null
}

export function MemoryWall() {
  const { userId, partnerName, spaceId } = useSpace()
  const { decrypt, isLoaded: keyLoaded } = useE2EEKey()
  const [items, setItems] = useState<DecryptedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [randomItem, setRandomItem] = useState<DecryptedItem | null>(null)
  const [zoomedItem, setZoomedItem] = useState<DecryptedItem | null>(null)

  // Fetch pinned feed events
  const fetchPinned = useCallback(async (showSkeleton = true) => {
    try {
      if (showSkeleton) setLoading(true)
      const res = await fetch(`/api/feed/events?pinned=true&limit=50&_t=${Date.now()}`)
      if (!res.ok) return

      const data = (await res.json()) as { events: FeedEvent[] }

      // Decrypt captions
      const decrypted: DecryptedItem[] = await Promise.all(
        data.events.map(async (event) => {
          let caption: string | null = null
          if (event.encrypted_caption) {
            try {
              caption = await decrypt(event.encrypted_caption)
            } catch {
              caption = '[encrypted]'
            }
          }
          return { event, caption }
        })
      )

      setItems(decrypted)
    } catch {
      // Silently fail
    } finally {
      if (showSkeleton) setLoading(false)
    }
  }, [decrypt])

  useEffect(() => {
    if (!keyLoaded) return
    fetchPinned(true)
  }, [keyLoaded, fetchPinned])

  // Real-time listener for memory wall changes
  useEffect(() => {
    if (!spaceId || !keyLoaded) return

    const channel = supabase
      .channel(`memory-wall-${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feed_events',
        },
        (payload) => {
          // Handle DELETE separately since payload.new might be an empty object
          if (payload.eventType === 'DELETE' && payload.old) {
            setZoomedItem(prev => (prev && prev.event.id === payload.old.id) ? null : prev)
          } 
          // Update zoomed item if it is the one being modified
          else if (payload.eventType === 'UPDATE' && payload.new) {
            const newRow = payload.new as FeedEvent
            if (newRow.id) {
              setZoomedItem(prev => {
                if (prev && prev.event.id === newRow.id) {
                  return { ...prev, event: { ...prev.event, delete_requested_by: newRow.delete_requested_by } }
                }
                return prev
              })
            }
          }

          // Silent background refresh (no skeleton/loading screen)
          fetchPinned(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [spaceId, keyLoaded, fetchPinned])

  function showRandomMemory() {
    if (items.length === 0) return
    const idx = Math.floor(Math.random() * items.length)
    setRandomItem(items[idx])
  }

  function getAuthorLabel(authorId: string): string {
    if (authorId === userId) return 'You'
    return partnerName ?? 'Partner'
  }

  async function handleRequestDelete(eventId: string) {
    if (!spaceId || !userId) return
    const res = await supabase.from('feed_events').update({ delete_requested_by: userId }).eq('id', eventId)
    if (!res.error) {
      setZoomedItem(prev => prev ? { ...prev, event: { ...prev.event, delete_requested_by: userId } } : null)
      setItems(prev => prev.map(item => item.event.id === eventId ? { ...item, event: { ...item.event, delete_requested_by: userId } } : item))
    }
  }

  async function handleDeleteDeny(eventId: string) {
    if (!spaceId || !userId) return
    const res = await supabase.from('feed_events').update({ delete_requested_by: null }).eq('id', eventId)
    if (!res.error) {
      setZoomedItem(prev => prev ? { ...prev, event: { ...prev.event, delete_requested_by: null } } : null)
      setItems(prev => prev.map(item => item.event.id === eventId ? { ...item, event: { ...item.event, delete_requested_by: null } } : item))
    }
  }

  async function handleDeleteApprove(eventId: string) {
    if (!spaceId || !userId) return
    const res = await supabase.from('feed_events').delete().eq('id', eventId)
    if (!res.error) {
      setZoomedItem(null)
      setItems(prev => prev.filter(item => item.event.id !== eventId))
    }
  }

  // Loading skeletons
  if (loading) {
    return (
      <div className="columns-2 gap-4 md:columns-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="mb-4 break-inside-avoid rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-3"
          >
            <div className="mb-3 aspect-[4/3] animate-pulse rounded-xl bg-neutral-800" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-800" />
            <div className="mt-2 h-2 w-1/3 animate-pulse rounded bg-neutral-800/50" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900/80 ring-1 ring-neutral-800">
          <Bookmark className="h-7 w-7 text-neutral-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-neutral-300">
          No memories pinned yet
        </h2>
        <p className="max-w-xs text-sm text-neutral-500">
          Pin your favorite moments from the feed to build your memory wall
          together.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Random Memory button */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={showRandomMemory}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-900/80 px-4 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-800 transition-all hover:bg-neutral-800 hover:text-neutral-100 active:scale-95"
        >
          <Shuffle className="h-4 w-4" />
          Random Memory
        </button>
      </div>

      {/* Masonry grid */}
      <div className="columns-2 gap-4 md:columns-3">
        {items.map(({ event, caption }) => (
          <article
            key={event.id}
            onClick={() => setZoomedItem({ event, caption })}
            className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-800/50 bg-neutral-900/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:border-neutral-700/50 hover:shadow-lg hover:shadow-neutral-950/30 cursor-pointer group"
          >
            {event.media_url && (
              <div className={`relative overflow-hidden aspect-square ${(event.metadata as any)?.isPaired && (event.metadata as any)?.photo_b_url ? 'flex gap-1 bg-neutral-950 p-1' : ''}`}>
                <EncryptedImage
                  src={event.media_url}
                  alt={caption ?? 'Memory'}
                  className={`object-cover transition-transform duration-700 group-hover:scale-105 ${(event.metadata as any)?.isPaired && (event.metadata as any)?.photo_b_url ? 'w-1/2 h-full rounded-l-xl' : 'w-full h-full'}`}
                />
                {(event.metadata as any)?.isPaired && (event.metadata as any)?.photo_b_url && (
                  <EncryptedImage
                    src={(event.metadata as any).photo_b_url}
                    alt={caption ?? 'Memory Partner'}
                    className="w-1/2 h-full object-cover rounded-r-xl transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                {/* Paired Icon Overlay */}
                {(event.metadata as any)?.isPaired && (event.metadata as any)?.photo_b_url && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-full bg-neutral-950/40 p-2 backdrop-blur-md border border-white/10 shadow-xl">
                      <Camera className="h-5 w-5 text-white/80" />
                    </div>
                  </div>
                )}
                
                {/* Delete Requested Badge */}
                {event.delete_requested_by && (
                  <div className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-sm shadow-xl ${
                    event.delete_requested_by === userId
                      ? 'bg-neutral-800/80 border-neutral-600/30 text-neutral-300'
                      : 'bg-red-500/80 border-red-500/30 text-white'
                  }`}>
                    {event.delete_requested_by !== userId && (
                      <AlertCircle className="h-3 w-3 text-white" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {event.delete_requested_by === userId ? 'Pending Deletion' : 'Partner wants to delete'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-3">
              {/* Capture pair indicator */}
              {event.type === 'capture' && (
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                  {(event.metadata as Record<string, unknown>)?.isPaired
                    ? '📸 Paired Capture'
                    : '📸 Solo Capture'}
                </div>
              )}

              {/* Caption */}
              {caption && (
                <p className="mb-1.5 text-sm leading-relaxed text-neutral-200">
                  {caption}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  {getAuthorLabel(event.author_id)}
                </span>
                <span className="text-xs text-neutral-700">·</span>
                <span className="text-xs text-neutral-600">
                  {relativeTime(event.created_at)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Random Memory overlay */}
      {randomItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-lg"
          onClick={() => setRandomItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Random memory"
        >
          <button
            onClick={() => setRandomItem(null)}
            className="absolute right-4 top-4 rounded-full bg-neutral-800/80 p-2 text-neutral-400 transition-colors hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-lg overflow-hidden rounded-3xl border border-neutral-800/50 bg-neutral-900/80 shadow-2xl"
          >
            {randomItem.event.media_url && (
              <EncryptedImage
                src={randomItem.event.media_url}
                alt={randomItem.caption ?? 'Memory'}
                className="max-h-[60vh] w-full object-cover"
              />
            )}

            <div className="p-5">
              {randomItem.caption && (
                <p className="mb-3 text-base text-neutral-200">
                  {randomItem.caption}
                </p>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-400">
                  {getAuthorLabel(randomItem.event.author_id)}
                </span>
                <span className="text-neutral-700">·</span>
                <span className="text-sm text-neutral-500">
                  {relativeTime(randomItem.event.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoomed Lightbox overlay */}
      {zoomedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 cursor-zoom-out"
          onClick={() => setZoomedItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed memory"
        >
          <button
            onClick={() => setZoomedItem(null)}
            className="absolute right-4 top-4 z-50 rounded-full bg-neutral-800/80 p-2 text-neutral-400 transition-colors hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div 
            onClick={(e) => e.stopPropagation()} 
            className="flex h-[85vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-3xl border border-neutral-800/50 bg-neutral-900/80 shadow-2xl cursor-default animate-in zoom-in-95"
          >
            {zoomedItem.event.media_url && (
              <div className={`flex-1 overflow-hidden bg-black/80 ${(zoomedItem.event.metadata as any)?.isPaired && (zoomedItem.event.metadata as any)?.photo_b_url ? 'flex gap-2 p-2' : ''}`}>
                <EncryptedImage
                  src={zoomedItem.event.media_url}
                  alt={zoomedItem.caption ?? 'Memory'}
                  className={`object-contain ${(zoomedItem.event.metadata as any)?.isPaired && (zoomedItem.event.metadata as any)?.photo_b_url ? 'w-1/2 h-full rounded-2xl bg-neutral-950' : 'h-full w-full'}`}
                />
                {(zoomedItem.event.metadata as any)?.isPaired && (zoomedItem.event.metadata as any)?.photo_b_url && (
                  <EncryptedImage
                    src={(zoomedItem.event.metadata as any).photo_b_url}
                    alt={zoomedItem.caption ?? 'Memory Partner'}
                    className="w-1/2 h-full object-contain rounded-2xl bg-neutral-950"
                  />
                )}
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  {zoomedItem.event.type === 'capture' && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
                      {(zoomedItem.event.metadata as Record<string, unknown>)?.isPaired
                        ? '📸 Paired Capture'
                        : '📸 Solo Capture'}
                    </div>
                  )}

                  {zoomedItem.caption && (
                    <p className="mb-4 text-lg text-neutral-200">
                      {zoomedItem.caption}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-400">
                      Added by {getAuthorLabel(zoomedItem.event.author_id)}
                    </span>
                    <span className="text-neutral-700">·</span>
                    <span className="text-sm text-neutral-500">
                      {relativeTime(zoomedItem.event.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  {zoomedItem.event.delete_requested_by ? (
                    zoomedItem.event.delete_requested_by === userId ? (
                      <span className="rounded-xl bg-neutral-800/50 px-3 py-1.5 text-xs font-medium text-neutral-400">
                        Pending partner approval…
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-1.5">
                        <span className="px-2 text-xs font-semibold text-red-400">
                          Partner wants to delete
                        </span>
                        <button
                          onClick={() => handleDeleteApprove(zoomedItem.event.id)}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-500/30"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeleteDeny(zoomedItem.event.id)}
                          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-neutral-400 transition-colors hover:bg-neutral-700"
                        >
                          Keep
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      onClick={() => handleRequestDelete(zoomedItem.event.id)}
                      className="rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-900/40 hover:text-red-400"
                    >
                      Request Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
