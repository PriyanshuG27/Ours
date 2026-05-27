'use client'

import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import type { FeedEvent } from '@/types/app.types'
import { useSpace } from '@/hooks/use-space'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { EncryptedImage } from '@/components/features/feed/EncryptedImage'

/** Relative time using Intl.RelativeTimeFormat — no date-fns needed */
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

function getAuthorLabel(authorId: string, userId: string | null, partnerName: string | null): string {
  if (authorId === userId) return 'You'
  return partnerName ?? 'Partner'
}

/** Safely extract a string value from metadata */
function getMeta(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key]
  return typeof value === 'string' ? value : undefined
}

interface FeedItemProps {
  event: FeedEvent
}

export function FeedItem({ event }: FeedItemProps) {
  const { userId, partnerName } = useSpace()
  const { decrypt } = useE2EEKey()
  const [isPinned, setIsPinned] = useState(event.is_pinned)
  const [pinLoading, setPinLoading] = useState(false)
  const [decryptedCaption, setDecryptedCaption] = useState<string | null>(null)

  const authorLabel = getAuthorLabel(event.author_id, userId, partnerName)
  const timeAgo = relativeTime(event.created_at)

  // Decrypt the caption when event changes
  useEffect(() => {
    if (!event.encrypted_caption) {
      setDecryptedCaption(null)
      return
    }

    let cancelled = false

    async function decryptCaption() {
      try {
        const plaintext = await decrypt(event.encrypted_caption as string)
        if (!cancelled) {
          setDecryptedCaption(plaintext)
        }
      } catch {
        // Decryption failed — show fallback
        if (!cancelled) {
          setDecryptedCaption('[encrypted]')
        }
      }
    }

    decryptCaption()

    return () => {
      cancelled = true
    }
  }, [event.encrypted_caption, decrypt])

  async function togglePin() {
    setPinLoading(true)
    try {
      const res = await fetch(`/api/feed/pin/${event.id}`, { method: 'PATCH' })
      if (res.ok) {
        const data = await res.json() as { isPinned: boolean }
        setIsPinned(data.isPinned)
      }
    } finally {
      setPinLoading(false)
    }
  }

  /** Display caption: decrypted if available, otherwise raw or null */
  const displayCaption = event.encrypted_caption
    ? (decryptedCaption ?? '…')
    : null

  return (
    <article className="overflow-hidden rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-sm">
      {/* Photo / Capture — media_url is a signed URL from the API */}
      {event.media_url && (event.type === 'photo' || event.type === 'capture') && (
        <EncryptedImage
          src={event.media_url}
          alt={displayCaption ?? 'Photo'}
          className="aspect-[4/3] w-full object-cover"
        />
      )}

      {/* Content area */}
      <div className="p-4">
        {/* Type-specific content */}
        {event.type === 'note' && (
          <p className="text-sm leading-relaxed text-neutral-200">
            {displayCaption}
          </p>
        )}

        {event.type === 'task_done' && (
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span className="text-sm text-neutral-200">
              {displayCaption ?? 'Task completed'}
            </span>
            {getMeta(event.metadata, 'mood') && (
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                {getMeta(event.metadata, 'mood')}
              </span>
            )}
          </div>
        )}

        {event.type === 'mood' && (
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {getMeta(event.metadata, 'mood') === 'easy' && '😌'}
              {getMeta(event.metadata, 'mood') === 'struggled' && '😤'}
              {getMeta(event.metadata, 'mood') === 'forced' && '😶'}
              {getMeta(event.metadata, 'mood') === 'proud' && '🥲'}
            </span>
            <span className="text-sm text-neutral-300">
              {displayCaption ?? getMeta(event.metadata, 'mood') ?? ''}
            </span>
          </div>
        )}

        {event.type === 'watch_session' && (
          <p className="text-sm text-neutral-300">
            🎬 Watched together
            {getMeta(event.metadata, 'duration') ? ` · ${getMeta(event.metadata, 'duration')}` : ''}
          </p>
        )}

        {event.type === 'focus_session' && (
          <p className="text-sm text-neutral-300">
            ⏱ Focused together
            {getMeta(event.metadata, 'duration') ? ` · ${getMeta(event.metadata, 'duration')}` : ''}
          </p>
        )}

        {/* Caption for photo/capture */}
        {(event.type === 'photo' || event.type === 'capture') && displayCaption && (
          <p className="mb-2 text-sm text-neutral-300">
            {displayCaption}
          </p>
        )}

        {/* Footer: author, time, pin */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">
              {authorLabel}
            </span>
            <span className="text-xs text-neutral-600">·</span>
            <span className="text-xs text-neutral-500">{timeAgo}</span>
          </div>

          <button
            onClick={togglePin}
            disabled={pinLoading}
            aria-label={isPinned ? 'Unpin from Memory Wall' : 'Pin to Memory Wall'}
            className={`rounded-lg p-1.5 transition-colors ${
              isPinned
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-neutral-600 hover:text-neutral-400'
            } disabled:opacity-50`}
          >
            <Bookmark
              className="h-4 w-4"
              fill={isPinned ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>
    </article>
  )
}
