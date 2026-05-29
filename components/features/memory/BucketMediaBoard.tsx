'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link as LinkIcon, Mic, MicOff, Play, Square, Trash2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useE2EEKey } from '@/hooks/use-e2ee-key'

interface BucketMedia {
  id: string
  media_type: 'photo' | 'video' | 'link' | 'voice'
  url_or_content: string
  created_at: string
}

export function BucketMediaBoard({ itemId }: { itemId: string }) {
  const { encryptBinary, decryptBinary } = useE2EEKey()
  const [media, setMedia] = useState<BucketMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [linkInput, setLinkInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchMedia = useCallback(async () => {
    try {
      const res = await fetch(`/api/bucket/${itemId}/media?_t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        
        // Resolve signed URLs for voice memos
        const nonPhotoMedia = (data.media as BucketMedia[]).filter(m => m.media_type !== 'photo')
        const resolvedMedia = await Promise.all(
          nonPhotoMedia.map(async (m) => {
            if (m.media_type === 'voice') {
              const { data: signedData } = await supabase.storage
                .from('bucket_media')
                .createSignedUrl(m.url_or_content, 3600)
              return { ...m, signedUrl: signedData?.signedUrl }
            }
            return m
          })
        )
        setMedia(resolvedMedia)
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    fetchMedia()
    const channel = supabase
      .channel(`bucket-media-${itemId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bucket_media', filter: `bucket_item_id=eq.${itemId}` }, () => fetchMedia())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bucket_media', filter: `bucket_item_id=eq.${itemId}` }, () => fetchMedia())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bucket_media' }, () => fetchMedia())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [itemId, fetchMedia])

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setRecordingTime(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkInput.trim()) return

    try {
      await fetch(`/api/bucket/${itemId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: 'link', url_or_content: linkInput.trim() }),
      })
      setLinkInput('')
      fetchMedia()
    } catch {}
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const arrayBuffer = await audioBlob.arrayBuffer()
        const encryptedBytes = await encryptBinary(new Uint8Array(arrayBuffer))
        const finalBlob = new Blob([new Uint8Array(encryptedBytes)], { type: 'application/octet-stream' })

        const formData = new FormData()
        formData.append('file', finalBlob, 'voice-memo.webm')
        formData.append('media_type', 'voice')

        await fetch(`/api/bucket/${itemId}/media/upload`, {
          method: 'POST',
          body: formData,
        })
        fetchMedia()
      }

      recorder.start()
      setIsRecording(true)
    } catch (err) {
      alert('Could not access microphone.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      setIsRecording(false)
    }
  }

  const [decryptedAudioCache, setDecryptedAudioCache] = useState<Record<string, string>>({})

  const playAudio = async (id: string, url: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (playingId === id) {
        setPlayingId(null)
        return
      }
    }

    setPlayingId(id)

    let finalUrl = url
    if (!decryptedAudioCache[id]) {
      try {
        const res = await fetch(url)
        const arrayBuffer = await res.arrayBuffer()
        const decryptedBytes = await decryptBinary(new Uint8Array(arrayBuffer))
        const blob = new Blob([new Uint8Array(decryptedBytes)], { type: 'audio/webm' })
        finalUrl = URL.createObjectURL(blob)
        setDecryptedAudioCache(prev => ({ ...prev, [id]: finalUrl }))
      } catch (err) {
        setPlayingId(null)
        return
      }
    } else {
      finalUrl = decryptedAudioCache[id]
    }

    const audio = new Audio(finalUrl)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.play()
  }

  const handleDelete = async (mediaId: string) => {
    try {
      await fetch(`/api/bucket/${itemId}/media/${mediaId}`, { method: 'DELETE' })
      fetchMedia()
    } catch {}
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-3">
      <h4 className="text-xs font-medium text-neutral-400">Inspiration & Notes</h4>

      {/* Media List */}
      <div className="flex flex-col gap-2">
        {media.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800/50 bg-neutral-800/20 px-3 py-2">
            {m.media_type === 'link' ? (
              <a href={m.url_or_content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 overflow-hidden text-sm text-blue-400 hover:underline">
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{m.url_or_content}</span>
              </a>
            ) : (
              <button
                onClick={() => playAudio(m.id, m.signedUrl)}
                className="flex items-center gap-2 text-sm text-violet-400 transition-colors hover:text-violet-300"
              >
                {playingId === m.id ? <Square className="h-4 w-4 shrink-0 fill-current" /> : <Play className="h-4 w-4 shrink-0 fill-current" />}
                Voice Memo
              </button>
            )}
            <button onClick={() => handleDelete(m.id)} className="text-neutral-600 hover:text-rose-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Input Controls */}
      <div className="flex gap-2">
        <form onSubmit={handleAddLink} className="flex flex-1 items-center gap-2">
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Paste an inspiration link..."
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <button type="submit" disabled={!linkInput} className="rounded-lg bg-neutral-800 p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-50">
            <LinkIcon className="h-4 w-4" />
          </button>
        </form>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            isRecording ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
          }`}
        >
          {isRecording ? (
            <span className="flex items-center gap-1.5"><Square className="h-3.5 w-3.5 fill-current" /> {formatTime(recordingTime)}</span>
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
