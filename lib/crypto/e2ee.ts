import _sodium from 'libsodium-wrappers'

/**
 * Singleton promise for libsodium initialization.
 * Resolves once; subsequent calls return immediately.
 */
let sodiumReady: Promise<void> | null = null

export function initSodium(): Promise<void> {
  if (!sodiumReady) {
    sodiumReady = _sodium.ready.then(() => {
      // sodium is now usable — nothing to return
    })
  }
  return sodiumReady
}

/**
 * Generate a 32-byte Master Space Key (XSalsa20-Poly1305).
 * Called ONCE during Space creation. Returns a base64 string.
 */
export async function generateSpaceKey(): Promise<string> {
  await initSodium()
  const key = _sodium.randombytes_buf(_sodium.crypto_secretbox_KEYBYTES)
  return _sodium.to_base64(key, _sodium.base64_variants.ORIGINAL)
}

/**
 * Encrypt a plaintext string using the Space Key.
 * Returns base64(nonce ‖ ciphertext).
 */
export async function encryptPayload(
  plaintext: string,
  keyBase64: string,
): Promise<string> {
  await initSodium()

  const key = _sodium.from_base64(keyBase64, _sodium.base64_variants.ORIGINAL)

  if (key.length !== _sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid key length')
  }

  const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES)
  const message = _sodium.from_string(plaintext)
  const ciphertext = _sodium.crypto_secretbox_easy(message, nonce, key)

  // Combine nonce + ciphertext into a single Uint8Array
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce)
  combined.set(ciphertext, nonce.length)

  return _sodium.to_base64(combined, _sodium.base64_variants.ORIGINAL)
}

/**
 * Decrypt a base64(nonce ‖ ciphertext) string using the Space Key.
 * Returns the original plaintext string.
 * Throws if the key is wrong or data has been tampered with.
 */
export async function decryptPayload(
  ciphertextBase64: string,
  keyBase64: string,
): Promise<string> {
  await initSodium()

  const key = _sodium.from_base64(keyBase64, _sodium.base64_variants.ORIGINAL)

  if (key.length !== _sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid key length')
  }

  const combined = _sodium.from_base64(
    ciphertextBase64,
    _sodium.base64_variants.ORIGINAL,
  )

  const nonceLength = _sodium.crypto_secretbox_NONCEBYTES
  if (combined.length < nonceLength + _sodium.crypto_secretbox_MACBYTES) {
    throw new Error('Ciphertext too short')
  }

  const nonce = combined.slice(0, nonceLength)
  const ciphertext = combined.slice(nonceLength)

  const decrypted = _sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
  return _sodium.to_string(decrypted)
}

/**
 * Encrypt a binary Uint8Array using the Space Key.
 * Returns Uint8Array(nonce ‖ ciphertext).
 */
export async function encryptBinary(
  data: Uint8Array,
  keyBase64: string,
): Promise<Uint8Array> {
  await initSodium()

  const key = _sodium.from_base64(keyBase64, _sodium.base64_variants.ORIGINAL)

  if (key.length !== _sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid key length')
  }

  const nonce = _sodium.randombytes_buf(_sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = _sodium.crypto_secretbox_easy(data, nonce, key)

  // Combine nonce + ciphertext into a single Uint8Array
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce)
  combined.set(ciphertext, nonce.length)

  return combined
}

/**
 * Decrypt a combined binary Uint8Array using the Space Key.
 * Returns the original plaintext Uint8Array.
 * Throws if the key is wrong or data has been tampered with.
 */
export async function decryptBinary(
  combined: Uint8Array,
  keyBase64: string,
): Promise<Uint8Array> {
  await initSodium()

  const key = _sodium.from_base64(keyBase64, _sodium.base64_variants.ORIGINAL)

  if (key.length !== _sodium.crypto_secretbox_KEYBYTES) {
    throw new Error('Invalid key length')
  }

  const nonceLength = _sodium.crypto_secretbox_NONCEBYTES
  if (combined.length < nonceLength + _sodium.crypto_secretbox_MACBYTES) {
    throw new Error('Ciphertext too short')
  }

  const nonce = combined.slice(0, nonceLength)
  const ciphertext = combined.slice(nonceLength)

  return _sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
}
