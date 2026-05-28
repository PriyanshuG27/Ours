'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useE2EEKey } from '@/hooks/use-e2ee-key'

interface EncryptedImageProps {
  src: string
  alt?: string
  className?: string
  onClick?: () => void
}

// Global cache to prevent double-fetching and double-decrypting, 
// and to fix issues where signed URLs expire before the zoomed overlay is opened.
const decryptedCache = new Map<string, string>()

export function EncryptedImage({ src, alt, className, onClick }: EncryptedImageProps) {
  const { decryptBinary } = useE2EEKey()
  const [objectUrl, setObjectUrl] = useState<string | null>(decryptedCache.get(src) ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    // If it's already in the cache, use it instantly.
    if (decryptedCache.has(src)) {
      setObjectUrl(decryptedCache.get(src)!)
      return
    }

    let cancelled = false

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
        
        decryptedCache.set(src, url)
        
        if (!cancelled) {
          setObjectUrl(url)
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

  return <img src={objectUrl} alt={alt ?? 'Encrypted Image'} className={className} loading="lazy" onClick={onClick} />
}
