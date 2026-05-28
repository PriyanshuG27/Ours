'use client'

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import { PresenceProvider } from '@/components/features/home/PresenceProvider'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { useSpace } from '@/hooks/use-space'
import { encryptPayload, decryptPayload, initSodium } from '@/lib/crypto/e2ee'
import { saveKey } from '@/hooks/use-e2ee-key'
import { supabase } from '@/lib/supabase/client'
import { AlertTriangle, Lock, Loader2 } from 'lucide-react'
import { NudgeListener } from '@/components/features/streaks/NudgeListener'
import { CaptureListener } from '@/components/features/memory/CaptureListener'

const E2EE_TEST_PLAINTEXT = 'ours-e2ee-verification-token'

/**
 * Client wrapper for the (space) layout.
 * Mounts Liveblocks PresenceProvider globally across all space pages.
 *
 * E2EE key lifecycle:
 * - If key exists in IndexedDB → render children normally.
 * - If key is missing (e.g. new device, cleared cache) → prompt user to enter it.
 */
export function SpaceShell({ children }: { children: ReactNode }) {
  const { spaceId, isLoaded: spaceLoaded } = useSpace()
  const { isLoaded: keyLoaded, needsKeyEntry, setKeyManually } = useE2EEKey()

  const [inputKey, setInputKey] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Partner / Recovery Unlock: verify key + save + continue
  const handleUnlock = useCallback(async () => {
    let rawKey = inputKey.trim()
    if (!rawKey || !spaceId) return
    
    // Auto-extract key if user pasted the entire Magic Link (e.g., https://.../#key=xyz)
    if (rawKey.includes('#key=')) {
      rawKey = rawKey.split('#key=')[1]
    }

    setIsProcessing(true)
    setVerifyError('')
    
    try {
      await initSodium()

      const { data: space } = await supabase
        .from('spaces')
        .select('encrypted_test_payload')
        .eq('id', spaceId)
        .single()

      const testPayload = space?.encrypted_test_payload as string | null

      if (!testPayload) {
        // No test payload (old space migration) — accept any key and store test payload
        const newTestPayload = await encryptPayload(E2EE_TEST_PLAINTEXT, rawKey)
        await supabase
          .from('spaces')
          .update({ encrypted_test_payload: newTestPayload })
          .eq('id', spaceId)
        await saveKey(spaceId, rawKey)
        setKeyManually(rawKey)
        return
      }

      const decrypted = await decryptPayload(testPayload, rawKey)
      if (decrypted !== E2EE_TEST_PLAINTEXT) {
        setVerifyError('Incorrect key')
        setIsProcessing(false)
        return
      }

      await saveKey(spaceId, rawKey)
      setKeyManually(rawKey)
    } catch {
      setVerifyError('Incorrect key. Please check and try again.')
      setIsProcessing(false)
    }
  }, [inputKey, spaceId])

  // ---- LOADING STATE ----
  if (!spaceLoaded || !keyLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    )
  }

  // ---- ENTER KEY (Fallback / Recovery) ----
  if (needsKeyEntry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
              <Lock className="h-7 w-7 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Enter Space Key</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Your encryption key is needed to unlock your space on this device.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value)
                setVerifyError('')
              }}
              placeholder="Paste the Space Key or Magic Link"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock()
              }}
            />

            {verifyError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <p className="text-xs text-red-400">{verifyError}</p>
              </div>
            )}

            <button
              onClick={handleUnlock}
              disabled={!inputKey.trim() || isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 flex justify-center items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- KEY IS AVAILABLE — RENDER NORMALLY ----
  return (
    <PresenceProvider>
      <NudgeListener />
      <CaptureListener />
      {children}
    </PresenceProvider>
  )
}
