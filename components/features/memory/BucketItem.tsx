'use client'

import { useState, useEffect, useCallback } from 'react'
import { Camera, CheckCircle2, Clock, Upload, X, Loader2 } from 'lucide-react'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { EncryptedImage } from '@/components/features/feed/EncryptedImage'
import { compressImage } from '@/lib/image-utils'
import { BucketTodos } from './BucketTodos'
import { BucketTargetDate } from './BucketTargetDate'
import { BucketBudget } from './BucketBudget'
import { BucketMediaBoard } from './BucketMediaBoard'
import { supabase } from '@/lib/supabase/client'
import type { BucketItem as BucketItemType, BucketCompletion } from '@/types/app.types'
import html2canvas from 'html2canvas'
import { useRef } from 'react'

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
  const { encrypt, decrypt, isLoaded, encryptBinary } = useE2EEKey()
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [vibeRating, setVibeRating] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)

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

  const [completedPhotos, setCompletedPhotos] = useState<string[]>([])

  // Load signed URLs and decrypt notes for completed items
  const loadCompletionData = useCallback(async () => {
    if (item.status !== 'done') return
    if (!isLoaded) return
    
    try {
      // 1. Fetch media photos
      const mediaRes = await fetch(`/api/bucket/${item.id}/media?_t=${Date.now()}`)
      let allPhotos: string[] = []
      
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json()
        const photos = mediaData.media.filter((m: any) => m.media_type === 'photo')
        
        const signedPhotos = await Promise.all(
          photos.map(async (m: any) => {
            const { data } = await supabase.storage.from('media').createSignedUrl(m.url_or_content, 3600)
            return data?.signedUrl
          })
        )
        allPhotos = [...signedPhotos.filter(Boolean) as string[]]
      }

      // 2. Add legacy photos
      if (completionA?.photo_url) {
        const { data } = await supabase.storage
          .from('media')
          .createSignedUrl(completionA.photo_url, 3600)
        if (data?.signedUrl) allPhotos.push(data.signedUrl)
      }
      if (completionB?.photo_url) {
        const { data } = await supabase.storage
          .from('media')
          .createSignedUrl(completionB.photo_url, 3600)
        if (data?.signedUrl) allPhotos.push(data.signedUrl)
      }
      
      setCompletedPhotos(allPhotos)

      // 3. Decrypt notes
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
    } catch {}
  }, [item.id, item.status, completionA, completionB, decrypt, isLoaded])

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
      // 1. Upload all files to bucket_media
      for (const file of completionFiles) {
        const compressed = await compressImage(file)
        const arrayBuffer = await compressed.arrayBuffer()
        const encryptedBytes = await encryptBinary(new Uint8Array(arrayBuffer))
        const finalFile = new Blob([new Uint8Array(encryptedBytes)], { type: 'application/octet-stream' })

        const formData = new FormData()
        formData.append('file', finalFile, file.name)
        formData.append('media_type', 'photo')
        await fetch(`/api/bucket/${item.id}/media/upload`, {
          method: 'POST',
          body: formData,
        })
      }

      // 2. Complete the item
      const encryptedNote = await encrypt(completionNote.trim())
      const formData = new FormData()
      formData.append('encryptedNote', encryptedNote)
      if (vibeRating > 0) {
        formData.append('vibeRating', vibeRating.toString())
      }

      const res = await fetch(`/api/bucket/${item.id}/complete`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setShowCompleteModal(false)
        setCompletionFiles([])
        setCompletionNote('')
        setVibeRating(0)
        onUpdate()
      }
    } finally {
      setUploading(false)
    }
  }

  const handleOpenCompleteModal = async () => {
    try {
      const { data } = await supabase.from('bucket_todos').select('is_completed').eq('bucket_item_id', item.id)
      if (data?.some(t => !t.is_completed)) {
        alert('Please check off or delete all tasks for this dream before completing it!')
        return
      }
      setShowCompleteModal(true)
    } catch {}
  }

  const polaroidRef = useRef<HTMLDivElement>(null)

  const handleExportPolaroid = async () => {
    if (!polaroidRef.current) return
    try {
      const canvas = await html2canvas(polaroidRef.current, {
        backgroundColor: '#171717',
        scale: 2,
        useCORS: true,
      })
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = url
      link.download = `bucket-${decryptedTitle.replace(/\s+/g, '-').toLowerCase()}.png`
      link.click()
    } catch {}
  }

  const isHyped = item.hype_votes?.includes(currentUserId)

  async function handleHype() {
    try {
      const newVotes = isHyped
        ? (item.hype_votes || []).filter((id) => id !== currentUserId)
        : [...(item.hype_votes || []), currentUserId]

      await fetch(`/api/bucket/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hype_votes: newVotes }),
      })
      onUpdate()
    } catch {}
  }

  return (
    <>
      <article ref={polaroidRef} className={`overflow-hidden rounded-2xl border transition-all ${
        item.status === 'someday' && item.hype_votes?.length >= 2 
          ? 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
          : 'border-neutral-800/50 bg-neutral-900/60 backdrop-blur-sm'
      }`}>
        <div className="p-4">
          {/* Header: title + status badge */}
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className={`text-base font-semibold ${item.status === 'someday' && item.hype_votes?.length >= 2 ? 'text-rose-100' : 'text-neutral-100'}`}>
              {decryptedTitle}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              {item.status === 'someday' && (
                <button
                  onClick={handleHype}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold transition-all ${
                    isHyped
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-neutral-800 text-neutral-500 hover:text-rose-400'
                  }`}
                >
                  🔥 {item.hype_votes?.length > 0 && item.hype_votes.length}
                </button>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${config.bg} ${config.text}`}
              >
                {config.icon} {config.label}
              </span>
            </div>
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

          {item.status === 'planning' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <BucketTargetDate itemId={item.id} initialDate={item.target_date} onUpdate={onUpdate} />
              <BucketBudget itemId={item.id} initialBudgetCents={item.budget_cents} initialSavedCents={item.saved_cents} onUpdate={onUpdate} />
            </div>
          )}

          {item.status === 'planning' && <BucketTodos itemId={item.id} />}
          
          {item.status === 'planning' && <BucketMediaBoard itemId={item.id} />}

          {item.status === 'planning' && !userCompleted && (
            <button
              onClick={handleOpenCompleteModal}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
            >
              <Camera className="mr-2 inline-block h-4 w-4" />
              I Did This!
            </button>
          )}

          {/* Done state */}
          {item.status === 'done' && (
            <div className="mt-4 flex flex-col gap-4">
              {completedPhotos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {completedPhotos.map((url, i) => (
                    <EncryptedImage
                      key={i}
                      src={url}
                      alt="Completion"
                      onClick={() => setEnlargedImage(url)}
                      className="h-32 w-32 shrink-0 cursor-pointer rounded-xl border border-neutral-800/50 object-cover shadow-sm transition-transform hover:scale-105"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Completion A */}
                {completionA && (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800/50 bg-neutral-800/30">
                    <div className="flex-1 p-3 flex flex-col gap-2">
                      {completionA.vibe_rating && (
                        <div className="text-xl text-center">
                          {completionA.vibe_rating === 1 ? '🥱' : completionA.vibe_rating === 2 ? '🙂' : completionA.vibe_rating === 3 ? '😊' : completionA.vibe_rating === 4 ? '😍' : '🤯'}
                        </div>
                      )}
                      {decryptedNoteA && (
                        <p className="text-sm italic leading-relaxed text-neutral-200">
                          &quot;{decryptedNoteA}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {/* Completion B */}
                {completionB && (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800/50 bg-neutral-800/30">
                    <div className="flex-1 p-3 flex flex-col gap-2">
                      {completionB.vibe_rating && (
                        <div className="text-xl text-center">
                          {completionB.vibe_rating === 1 ? '🥱' : completionB.vibe_rating === 2 ? '🙂' : completionB.vibe_rating === 3 ? '😊' : completionB.vibe_rating === 4 ? '😍' : '🤯'}
                        </div>
                      )}
                      {decryptedNoteB && (
                        <p className="text-sm italic leading-relaxed text-neutral-200">
                          &quot;{decryptedNoteB}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                data-html2canvas-ignore="true"
                onClick={handleExportPolaroid}
                className="mx-auto flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800/50 px-4 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
              >
                <Camera className="h-3.5 w-3.5" />
                Export as Polaroid
              </button>
            </div>
          )}
        </div>
      </article>

      {/* Enlarged image overlay */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <EncryptedImage src={enlargedImage} alt="Enlarged" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}

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
                {completionFiles.length > 0 ? `${completionFiles.length} photo(s) selected` : 'Upload photos (Optional)'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setCompletionFiles(Array.from(e.target.files || []))}
              />
            </label>

            {/* Vibe Rating */}
            <div className="mb-4 flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-400">Vibe Rating</label>
              <div className="flex gap-2 justify-between">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setVibeRating(rating)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition-all ${
                      vibeRating === rating ? 'bg-amber-500/20 scale-110 border border-amber-500/50' : 'bg-neutral-800/50 grayscale hover:grayscale-0'
                    }`}
                  >
                    {rating === 1 ? '🥱' : rating === 2 ? '🙂' : rating === 3 ? '😊' : rating === 4 ? '😍' : '🤯'}
                  </button>
                ))}
              </div>
            </div>

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
