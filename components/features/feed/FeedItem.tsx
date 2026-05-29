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
  
  useEffect(() => {
    setIsPinned(event.is_pinned);
  }, [event.is_pinned]);

  const [pinLoading, setPinLoading] = useState(false)
  const [isFlagging, setIsFlagging] = useState(false)
  const [isFlagged, setIsFlagged] = useState(event.metadata?.isFlagged === true)
  const [showFlagConfirm, setShowFlagConfirm] = useState(false)
  const [decryptedCaption, setDecryptedCaption] = useState<string | null>(null)
  const [decryptedTaskTitle, setDecryptedTaskTitle] = useState<string | null>(null)

  const authorLabel = getAuthorLabel(event.author_id, userId, partnerName)
  const timeAgo = relativeTime(event.created_at)

  // Decrypt the caption when event changes
  useEffect(() => {
    let cancelled = false

    const runDecryption = async () => {
      // Caption
      if (event.encrypted_caption) {
        try {
          const dec = await decrypt(event.encrypted_caption)
          if (!cancelled) setDecryptedCaption(dec)
        } catch (e) {
          if (!cancelled) setDecryptedCaption('[unable to decrypt]')
        }
      } else {
        if (!cancelled) setDecryptedCaption(null)
      }

      // Task Title (from metadata)
      const metaTitle = getMeta(event.metadata, 'taskTitle') || getMeta(event.metadata, 'taskLabel')
      if (metaTitle) {
        try {
          const dec = await decrypt(metaTitle)
          if (!cancelled) setDecryptedTaskTitle(dec)
        } catch (e) {
          if (!cancelled) setDecryptedTaskTitle('[unable to decrypt]')
        }
      } else {
        if (!cancelled) setDecryptedTaskTitle(null)
      }
    }

    runDecryption()

    return () => {
      cancelled = true
    }
  }, [event.encrypted_caption, event.metadata, decrypt])

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

  async function handleFlag() {
    const completionId = getMeta(event.metadata, 'completionId');
    if (!completionId) return;
    
    setIsFlagging(true);
    try {
      const res = await fetch(`/api/tasks/completions/${completionId}/flag`, { method: "POST" });
      if (res.ok) {
        setIsFlagged(true);
      } else {
        alert("Failed to flag completion");
      }
    } finally {
      setIsFlagging(false);
    }
  }

  /** Display caption: decrypted if available, otherwise raw or null */
  const displayCaption = event.encrypted_caption
    ? (decryptedCaption ?? '…')
    : null
    
  const completionId = getMeta(event.metadata, 'completionId');

  return (
    <>
    <article className="overflow-hidden rounded-2xl border border-neutral-800/50 bg-neutral-900/40 backdrop-blur-sm relative">
      {/* Flagged Overlay */}
      {isFlagged && (
        <div className="absolute inset-0 z-10 bg-red-900/20 backdrop-blur-[2px] pointer-events-none border-2 border-red-500/50 rounded-2xl flex items-center justify-center">
          <div className="bg-red-500/90 text-white font-bold px-4 py-2 rounded-full rotate-12 shadow-xl border border-red-400">
            FLAGGED 🚩
          </div>
        </div>
      )}

      {/* Photo / Capture / Task Done — media_url is a signed URL from the API */}
      {event.media_url && (event.type === 'photo' || event.type === 'capture' || event.type === 'task_done') && (
        <EncryptedImage
          src={event.media_url}
          alt={displayCaption ?? 'Photo'}
          className="aspect-[4/3] w-full object-cover"
        />
      )}

      {/* Content area */}
      <div className="p-4">
        {/* Type-specific content */}
        {event.type === 'note' && !getMeta(event.metadata, 'isFreeze') && (
          <p className="text-sm leading-relaxed text-neutral-200">
            {displayCaption}
          </p>
        )}

        {event.type === 'note' && getMeta(event.metadata, 'isFreeze') && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <span className="text-xl">🧊</span>
            <span className="text-sm font-medium text-blue-200">
              Used a streak freeze for <span className="font-bold text-white">{decryptedTaskTitle || 'a task'}</span>
            </span>
          </div>
        )}

        {event.type === 'task_done' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-sm font-medium text-neutral-200">
                {decryptedTaskTitle || 'Task completed'}
              </span>
              {getMeta(event.metadata, 'streakCount') && (
                <span className="rounded-full bg-orange-500/10 text-orange-500 px-2 py-0.5 text-[10px] font-bold">
                  🔥 {getMeta(event.metadata, 'streakCount')}
                </span>
              )}
            </div>
            {displayCaption && (
              <p className="text-sm text-neutral-300">{displayCaption}</p>
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

          <div className="flex items-center gap-1">
            {event.type === 'task_done' && event.media_url && event.author_id !== userId && !isFlagged && completionId && (
              <button
                onClick={() => setShowFlagConfirm(true)}
                disabled={isFlagging}
                title="Flag this photo as inaccurate"
                className="rounded-lg p-1.5 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <span className="text-sm">🚩</span>
              </button>
            )}
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
      </div>
    </article>
    
    {/* Custom Confirmation Modal */}
    {showFlagConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-xl flex flex-col gap-4 animate-in zoom-in-95">
          <h3 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
             <span className="text-red-500">🚩</span> Flag Photo
          </h3>
          <p className="text-sm text-zinc-400">
             Are you sure this photo is inaccurate? Flagging will deduct a photo proof and can eventually reset their streak.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setShowFlagConfirm(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowFlagConfirm(false);
                handleFlag();
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
            >
              Yes, Flag It
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
