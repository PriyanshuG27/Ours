'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, X, Loader2, Check } from 'lucide-react'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { supabase } from '@/lib/supabase/client'

interface CaptureCameraProps {
  captureEventId: string
  expiresAt: string
  onComplete: () => void
  onExpired: () => void
}

type CameraState = 'previewing' | 'uploading' | 'done' | 'expired' | 'error'

export function CaptureCamera({
  captureEventId,
  expiresAt,
  onComplete,
  onExpired,
}: CaptureCameraProps) {
  const { encryptBinary } = useE2EEKey()
  const [state, setState] = useState<CameraState>('previewing')
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, new Date(expiresAt).getTime() - Date.now())
  })
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [shutterCountdown, setShutterCountdown] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shutterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasCapturedRef = useRef(false)

  const expiresAtMs = new Date(expiresAt).getTime()

  // Total duration for the SVG ring calculation (60 seconds)
  const totalDuration = 60_000

  // Start camera
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            setCameraError('Camera is already in use by another tab or application. (Expected if testing both sides on one machine!)')
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.')
          } else {
            setCameraError('Camera access denied. Please allow camera permissions and try again.')
          }
          setState('error')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Countdown timer — 100ms intervals
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now()
      const left = expiresAtMs - now

      if (left <= 0) {
        setRemaining(0)
        setState('expired')
        onExpired()
        if (timerRef.current) clearInterval(timerRef.current)
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        return
      }

      setRemaining(left)
    }, 100)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [expiresAtMs, onExpired])

  const [isShutterLoading, setIsShutterLoading] = useState(false)

  // Listen for shared shutter click
  useEffect(() => {
    const channel = supabase
      .channel(`capture-shutter-${captureEventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'capture_events',
          filter: `id=eq.${captureEventId}`
        },
        (payload) => {
          if (payload.new.shutter_clicked_at) {
            const clickTime = new Date(payload.new.shutter_clicked_at).getTime()
            startShutterCountdown(clickTime)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [captureEventId])

  // Execute actual capture logic
  const executeCapture = useCallback(async () => {
    // ... [body remains identical until handleShutterClick]
    if (state !== 'previewing') return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Draw frame to canvas
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    setState('uploading')

    // Convert to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.95)
    })

    if (!blob) {
      setState('previewing')
      return
    }

    // Encrypt the binary file payload client-side before upload
    let encryptedBlob: Blob = blob
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const fileBytes = new Uint8Array(arrayBuffer)
      const encryptedBytes = await encryptBinary(fileBytes)
      encryptedBlob = new Blob([new Uint8Array(encryptedBytes)], { type: 'application/octet-stream' })
    } catch (err) {
      setCameraError('Encryption failed. Unable to securely upload capture.')
      setState('error')
      return
    }

    // Upload
    try {
      const formData = new FormData()
      formData.append('file', encryptedBlob, 'capture.webp')

      const res = await fetch(`/api/capture/${captureEventId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (res.status === 410) {
        setState('expired')
        onExpired()
        return
      }

      if (!res.ok) {
        setState('previewing')
        return
      }

      setState('done')
      // Stop camera after successful capture
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      onComplete()
    } catch {
      setState('previewing')
    }
  }, [state, captureEventId, encryptBinary, onComplete, onExpired])

  // Keep a ref to the latest executeCapture to avoid stale closures in the interval
  const executeCaptureRef = useRef(executeCapture)
  useEffect(() => {
    executeCaptureRef.current = executeCapture
  }, [executeCapture])

  function startShutterCountdown(clickTimeMs: number) {
    if (shutterTimerRef.current) clearInterval(shutterTimerRef.current)
    
    // We want to capture exactly 3 seconds after the click time
    const targetCaptureTime = clickTimeMs + 3000

    shutterTimerRef.current = setInterval(() => {
      const now = Date.now()
      const left = targetCaptureTime - now

      if (left <= 0) {
        setShutterCountdown(0)
        if (shutterTimerRef.current) clearInterval(shutterTimerRef.current)
        if (!hasCapturedRef.current) {
          hasCapturedRef.current = true
          executeCaptureRef.current()
        }
        return
      }

      setShutterCountdown(Math.ceil(left / 1000))
    }, 50)
  }

  // User clicks the button to initiate shared countdown
  const handleShutterClick = async () => {
    if (state !== 'previewing' || isShutterLoading) return
    
    setIsShutterLoading(true)
    try {
      await fetch(`/api/capture/${captureEventId}/shutter`, { method: 'POST' })
    } catch {
      setIsShutterLoading(false)
    }
  }

  // Forceful unmount when expired
  if (state === 'expired') {
    return null
  }

  // Format remaining time
  const seconds = Math.floor(remaining / 1000)
  const tenths = Math.floor((remaining % 1000) / 100)
  const displayTime = `${seconds}.${tenths}`

  // SVG ring progress
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = remaining / totalDuration
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="absolute opacity-0 pointer-events-none" />

      {/* Close button */}
      <button
        onClick={onExpired}
        className="absolute right-4 top-4 rounded-full bg-neutral-800/80 p-2 text-neutral-400 transition-colors hover:text-neutral-200"
        aria-label="Close camera"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Countdown ring */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgb(38 38 38)"
              strokeWidth="4"
            />
            {/* Progress ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={remaining < 10000 ? 'rgb(239 68 68)' : 'rgb(168 85 247)'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          </svg>
          <span
            className={`text-xl font-bold tabular-nums ${
              remaining < 10000 ? 'text-red-400' : 'text-neutral-100'
            }`}
          >
            {displayTime}s
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Your partner is capturing too ✨
        </p>
      </div>

      {/* Camera preview */}
      {state === 'error' ? (
        <div className="flex h-64 w-80 flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/80">
          <Camera className="h-12 w-12 text-neutral-600" />
          <p className="px-6 text-center text-sm text-neutral-400">
            {cameraError}
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border-2 border-neutral-800/50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-[60vh] max-w-[90vw] scale-x-[-1] object-cover"
          />
          {/* Big countdown overlay */}
          {shutterCountdown !== null && shutterCountdown > 0 && state === 'previewing' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <span className="text-[120px] font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] animate-in zoom-in duration-300">
                {shutterCountdown}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Capture / Status button */}
      <div className="mt-8 flex flex-col items-center">
        {state === 'previewing' && shutterCountdown === null && (
          <button
            onClick={handleShutterClick}
            disabled={isShutterLoading}
            className="group flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 bg-transparent transition-all hover:border-white hover:bg-white/10 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            aria-label="Capture photo"
          >
            {isShutterLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-white transition-transform group-active:scale-90" />
            )}
          </button>
        )}

        {state === 'uploading' && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-neutral-600 bg-neutral-800/50">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        )}

        {state === 'done' && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
        )}
      </div>
    </div>
  )
}
