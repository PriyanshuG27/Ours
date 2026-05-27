'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useE2EEKey } from '@/hooks/use-e2ee-key'

interface EncryptedImageProps {
  src: string
  alt?: string
  className?: string
}

export function EncryptedImage({ src, alt, className }: EncryptedImageProps) {
  const { decryptBinary } = useE2EEKey()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let currentObjectUrl: string | null = null

    async function loadAndDecrypt() {
      try {
        // 1. Fetch the ciphertext blob from the signed URL
        const res = await fetch(src)
        if (!res.ok) throw new Error('Failed to fetch image')
        
        const arrayBuffer = await res.arrayBuffer()
        const encryptedBytes = new Uint8Array(arrayBuffer)
        
        // 2. Decrypt the binary data
        const decryptedBytes = await decryptBinary(encryptedBytes)
        
        // 3. Create a blob and an object URL
        const blob = new Blob([new Uint8Array(decryptedBytes)], { type: 'image/webp' })
        const url = URL.createObjectURL(blob)
        
        if (!cancelled) {
          setObjectUrl(url)
          currentObjectUrl = url
        } else {
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        if (!cancelled) {
          setError(true)
        }
      }
    }

    loadAndDecrypt()

    return () => {
      cancelled = true
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl)
      }
    }
  }, [src, decryptBinary])

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-neutral-900/50 text-neutral-500 ${className ?? ''}`}>
        <span className="text-xs">Image unavailable</span>
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-neutral-900/20 ${className ?? ''}`}>
        <Loader2 className="h-5 w-5 animate-spin text-neutral-600" />
      </div>
    )
  }

  return <img src={objectUrl} alt={alt ?? 'Encrypted Image'} className={className} loading="lazy" />
}
