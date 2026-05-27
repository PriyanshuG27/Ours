'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, X, Upload, Loader2, AlertCircle } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { useE2EEKey } from '@/hooks/use-e2ee-key'

interface PhotoUploaderProps {
  onSuccess: () => void
}

type UploadStatus = 'idle' | 'compressing' | 'uploading' | 'error'

export function PhotoUploader({ onSuccess }: PhotoUploaderProps) {
  const { encrypt, encryptBinary } = useE2EEKey()
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setStatus('idle')
    setPreview(null)
    setCompressedFile(null)
    setCaption('')
    setErrorMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('compressing')
    setErrorMessage('')

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.4,
        fileType: 'image/webp',
        useWebWorker: true,
      })

      const url = URL.createObjectURL(compressed)
      setPreview(url)
      setCompressedFile(compressed)
      setStatus('idle')
    } catch {
      setStatus('error')
      setErrorMessage('Failed to process image. Please try another.')
    }
  }

  async function handleUpload() {
    if (!compressedFile) return

    setStatus('uploading')
    setErrorMessage('')

    try {
      const formData = new FormData()

      // Convert the compressed File to an ArrayBuffer, then Uint8Array
      const arrayBuffer = await compressedFile.arrayBuffer()
      const fileBytes = new Uint8Array(arrayBuffer)
      
      // Encrypt the binary file payload
      const encryptedBytes = await encryptBinary(fileBytes)
      
      // Create a Blob from the ciphertext
      const encryptedBlob = new Blob([new Uint8Array(encryptedBytes)], { type: 'application/octet-stream' })
      
      formData.append('file', encryptedBlob)
      formData.append('type', 'photo')
      if (caption.trim()) {
        // E2EE: encrypt caption client-side before sending
        const encryptedCaption = await encrypt(caption.trim())
        formData.append('caption', encryptedCaption)
      }

      const res = await fetch('/api/feed/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.status === 429) {
        setStatus('error')
        setErrorMessage('Daily photo limit reached (5 per day)')
        return
      }

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Upload failed')
      }

      resetState()
      onSuccess()
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong'
      )
    }
  }

  // Collapsed state — just the trigger button
  if (!preview) {
    return (
      <div className="px-6 pt-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'compressing'}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/40 px-4 py-5 text-neutral-400 transition-all hover:border-neutral-500 hover:bg-neutral-800/40 hover:text-neutral-300 active:scale-[0.98]"
        >
          {status === 'compressing' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Processing…</span>
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              <span className="text-sm font-medium">Add a photo</span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    )
  }

  // Preview state
  return (
    <div className="px-6 pt-6">
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
        {/* Preview image */}
        <div className="relative">
          <img
            src={preview}
            alt="Photo preview"
            className="aspect-[4/3] w-full object-cover"
          />
          <button
            onClick={resetState}
            aria-label="Remove photo"
            className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Caption + submit */}
        <div className="space-y-3 p-4">
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
            maxLength={200}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          />

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-400">{errorMessage}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={status === 'uploading'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'uploading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Share
              </>
            )}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
