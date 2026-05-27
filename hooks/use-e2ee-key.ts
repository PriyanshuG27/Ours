'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSpaceStore } from '@/store/space.store'
import { encryptPayload, decryptPayload, encryptBinary as e2eeEncryptBinary, decryptBinary as e2eeDecryptBinary, initSodium } from '@/lib/crypto/e2ee'
const DB_NAME = 'ours-e2ee'
const STORE_NAME = 'keys'
const DB_VERSION = 1

// ---------- IndexedDB helpers ----------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Load the Space Key from IndexedDB for a given spaceId.
 * Returns null if not found.
 */
export async function loadKey(spaceId: string): Promise<string | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(spaceId)

      request.onsuccess = () => {
        const result = request.result as string | undefined
        resolve(result ?? null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch {
    // IndexedDB unavailable (private browsing) — try sessionStorage fallback
    try {
      const value = sessionStorage.getItem(`ours-e2ee-${spaceId}`)
      return value
    } catch {
      return null
    }
  }
}

/**
 * Save the Space Key to IndexedDB for a given spaceId.
 */
export async function saveKey(
  spaceId: string,
  keyBase64: string,
): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(keyBase64, spaceId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // IndexedDB unavailable — fall back to sessionStorage with warning
    try {
      sessionStorage.setItem(`ours-e2ee-${spaceId}`, keyBase64)
      console.warn(
        '[E2EE] IndexedDB unavailable — key stored in sessionStorage (will not persist across sessions)',
      )
    } catch {
      throw new Error('Cannot store encryption key: storage is not available')
    }
  }
}

// ---------- React Hook ----------

interface UseE2EEKeyReturn {
  /** Base64-encoded Space Key, or null if not yet loaded / missing */
  key: string | null
  /** True after the IndexedDB attempt has completed (found or not) */
  isLoaded: boolean
  /** True if the key is missing and the user needs to provide it */
  needsKeyEntry: boolean
  /** Encrypt a plaintext string with the loaded key */
  encrypt: (plaintext: string) => Promise<string>
  /** Decrypt ciphertext with the loaded key */
  decrypt: (ciphertext: string) => Promise<string>
  /** Encrypt a binary payload with the loaded key */
  encryptBinary: (data: Uint8Array) => Promise<Uint8Array>
  /** Decrypt a binary ciphertext with the loaded key */
  decryptBinary: (combined: Uint8Array) => Promise<Uint8Array>
  /** Update the key state in memory directly to avoid page reloads */
  setKeyManually: (key: string) => void
}

export function useE2EEKey(): UseE2EEKeyReturn {
  const spaceId = useSpaceStore((s) => s.spaceId)
  const [key, setKey] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load key from IndexedDB when spaceId becomes available
  useEffect(() => {
    // No space — nothing to load, but mark as loaded so SpaceShell
    // doesn't hang on the spinner forever.
    if (!spaceId) {
      setIsLoaded(true)
      return
    }

    let cancelled = false

    async function load() {
      try {
        await initSodium()
        const stored = await loadKey(spaceId as string)
        if (!cancelled) {
          setKey(stored)
          setIsLoaded(true)
        }
      } catch {
        if (!cancelled) {
          setIsLoaded(true)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [spaceId])

  const needsKeyEntry = isLoaded && key === null

  const encrypt = useCallback(
    async (plaintext: string): Promise<string> => {
      if (!key) {
        throw new Error('E2EE key not loaded — cannot encrypt')
      }
      return encryptPayload(plaintext, key)
    },
    [key],
  )

  const decrypt = useCallback(
    async (ciphertext: string): Promise<string> => {
      if (!key) {
        throw new Error('E2EE key not loaded — cannot decrypt')
      }
      return decryptPayload(ciphertext, key)
    },
    [key],
  )

  const encryptBinary = useCallback(
    async (data: Uint8Array): Promise<Uint8Array> => {
      if (!key) {
        throw new Error('E2EE key not loaded — cannot encrypt binary')
      }
      return e2eeEncryptBinary(data, key)
    },
    [key],
  )

  const decryptBinary = useCallback(
    async (combined: Uint8Array): Promise<Uint8Array> => {
      if (!key) {
        throw new Error('E2EE key not loaded — cannot decrypt binary')
      }
      return e2eeDecryptBinary(combined, key)
    },
    [key],
  )

  return useMemo(
    () => ({ key, isLoaded, needsKeyEntry, encrypt, decrypt, encryptBinary, decryptBinary, setKeyManually: setKey }),
    [key, isLoaded, needsKeyEntry, encrypt, decrypt, encryptBinary, decryptBinary],
  )
}
