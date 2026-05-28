'use client'

import { useState, useEffect, useCallback } from 'react'
import { Camera, CheckCircle2, Clock, Upload, X, Loader2 } from 'lucide-react'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { compressImage } from '@/lib/image-utils'
import { BucketTodos } from './BucketTodos'
import { supabase } from '@/lib/supabase/client'
import type { BucketItem as BucketItemType, BucketCompletion } from '@/types/app.types'

interface BucketItemProps {
  item: BucketItemType
  decryptedTitle: string
  decryptedWhy: string
  currentUserId: string
  onUpdate: () => void
}

const statusConfig = {
  someday: {
    label: 'Someday',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    icon: '✨',
  },
  planning: {
    label: 'Planning',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: '📋',
  },
  done: {
    label: 'Done!',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    icon: '🎉',
  },
} as const

export function BucketItem({
  item,
  decryptedTitle,
  decryptedWhy,
  currentUserId,
  onUpdate,
}: BucketItemProps) {
  const { encrypt, decrypt } = useE2EEKey()
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [completionFile, setCompletionFile] = useState<File | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [uploading, setUploading] = useState(false)

  // Signed URL state for completion photos
  const [photoAUrl, setPhotoAUrl] = useState<string | null>(null)
  const [photoBUrl, setPhotoBUrl] = useState<string | null>(null)
  const [decryptedNoteA, setDecryptedNoteA] = useState<string | null>(null)
  const [decryptedNoteB, setDecryptedNoteB] = useState<string | null>(null)

  const completionA = item.completion_a as BucketCompletion | null
  const completionB = item.completion_b as BucketCompletion | null
  const config = statusConfig[item.status as keyof typeof statusConfig]

  // Check if current user already completed
  const userCompleted =
    completionA?.user_id === currentUserId ||
    completionB?.user_id === currentUserId

  // Check if partner completed
  const partnerCompleted =
    (completionA !== null && completionA.user_id !== currentUserId) ||
    (completionB !== null && completionB.user_id !== currentUserId)

  // Load signed URLs and decrypt notes for completed items
  const loadCompletionData = useCallback(async () => {
    if (item.status !== 'done') return
    if (!completionA && !completionB) return

    try {
      if (completionA?.photo_url) {
        const { data } = await supabase.storage
          .from('media')
          .createSignedUrl(completionA.photo_url, 3600)
        if (data?.signedUrl) setPhotoAUrl(data.signedUrl)
      }
      if (completionB?.photo_url) {
        const { data } = await supabase.storage
          .from('media')
          .createSignedUrl(completionB.photo_url, 3600)
        if (data?.signedUrl) setPhotoBUrl(data.signedUrl)
      }
      if (completionA?.encrypted_note) {
        try {
          const note = await decrypt(completionA.encrypted_note)
          setDecryptedNoteA(note)
        } catch {
          setDecryptedNoteA('[encrypted]')
        }
      }
      if (completionB?.encrypted_note) {
        try {
          const note = await decrypt(completionB.encrypted_note)
          setDecryptedNoteB(note)
        } catch {
          setDecryptedNoteB('[encrypted]')
        }
      }
    } catch {
      // Silently fail
    }
  }, [item.status, completionA, completionB, decrypt])

  useEffect(() => {
    loadCompletionData()
  }, [loadCompletionData])

  async function handleStartPlanning() {
    setUpdating(true)
    try {
      const res = await fetch(`/api/bucket/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'planning' }),
      })
      if (res.ok) onUpdate()
    } finally {
      setUpdating(false)
    }
  }

  async function handleComplete() {
    if (!completionNote.trim()) return

    setUploading(true)
    try {
      let compressed: Blob | null = null
      if (completionFile) {
        compressed = await compressImage(completionFile)
      }
      const encryptedNote = await encrypt(completionNote.trim())

      const formData = new FormData()
      if (compressed) {
        formData.append('file', compressed, 'completion.webp')
      }
      formData.append('encryptedNote', encryptedNote)

      const res = await fetch(`/api/bucket/${item.id}/complete`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setShowCompleteModal(false)
        setCompletionFile(null)
        setCompletionNote('')
        onUpdate()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-neutral-800/50 bg-neutral-900/60 backdrop-blur-sm">
        <div className="p-4">
          {/* Header: title + status badge */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-neutral-100">
              {decryptedTitle}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${config.bg} ${config.text}`}
            >
              {config.icon} {config.label}
            </span>
          </div>

          {/* Why note */}
          <p className="mb-3 text-sm italic leading-relaxed text-neutral-400">
            &ldquo;{decryptedWhy}&rdquo;
          </p>

          {/* Partner status for planning items */}
          {item.status === 'planning' && (
            <div className="mb-3 flex items-center gap-4 text-xs">
              {userCompleted ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  You completed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting for you
                </span>
              )}
              {partnerCompleted ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Partner completed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting for partner
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          {item.status === 'someday' && (
            <button
              onClick={handleStartPlanning}
              disabled={updating}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-violet-500/20 active:scale-[0.98] disabled:opacity-60"
            >
              {updating ? 'Moving…' : 'Start Planning →'}
            </button>
          )}

          {item.status === 'planning' && <BucketTodos itemId={item.id} />}

          {item.status === 'planning' && !userCompleted && (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
            >
              <Camera className="mr-2 inline-block h-4 w-4" />
              I Did This!
            </button>
          )}

          {/* Done state: show both completions side by side */}
          {item.status === 'done' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* Completion A */}
              {completionA && (
                <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800/50 bg-neutral-800/30">
                  {photoAUrl && (
                    <img
                      src={photoAUrl}
                      alt="Completion photo"
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  {decryptedNoteA && (
                    <p className="flex-1 p-3 text-sm italic leading-relaxed text-neutral-200">
                      "{decryptedNoteA}"
                    </p>
                  )}
                </div>
              )}
              {/* Completion B */}
              {completionB && (
                <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800/50 bg-neutral-800/30">
                  {photoBUrl && (
                    <img
                      src={photoBUrl}
                      alt="Completion photo"
                      className="aspect-square w-full object-cover"
                    />
                  )}
                  {decryptedNoteB && (
                    <p className="flex-1 p-3 text-sm italic leading-relaxed text-neutral-200">
                      "{decryptedNoteB}"
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Completion modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-100">
                Complete: {decryptedTitle}
              </h3>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="rounded-full p-1 text-neutral-500 hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Photo upload */}
            <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-800/30 p-6 transition-colors hover:border-neutral-600">
              <Upload className="h-6 w-6 text-neutral-500" />
              <span className="text-sm text-neutral-400">
                {completionFile ? completionFile.name : 'Upload a photo (Optional)'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setCompletionFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* Note */}
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="How was this experience?"
              rows={3}
              className="mb-4 w-full resize-none rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-neutral-200 placeholder-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />

            {/* Submit */}
            <button
              onClick={handleComplete}
              disabled={!completionNote.trim() || uploading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                'Submit Completion'
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
