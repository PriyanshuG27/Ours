import { useState, useCallback } from 'react'
import { X, Copy, Check, LogOut, KeyRound, Skull } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  spaceId: string | null
  e2eeKey: string | null
}

export function SettingsModal({ isOpen, onClose, spaceId, e2eeKey }: SettingsModalProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Sever Protocol state
  const [showSeverConfirm, setShowSeverConfirm] = useState(false)
  const [severInput, setSeverInput] = useState('')
  const [isSevering, setIsSevering] = useState(false)
  const [severError, setSeverError] = useState('')

  if (!isOpen) return null

  async function handleCopyMagicLink() {
    if (!spaceId || !e2eeKey) return
    const { data } = await supabase.from('spaces').select('invite_code').eq('id', spaceId).single()
    if (data?.invite_code) {
      const link = `${window.location.origin}/setup?code=${data.invite_code}#key=${e2eeKey}`
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  async function handleResetKey() {
    if (confirm('Are you sure? This will remove the encryption key from this device. You will need the Magic Link to access this space again.')) {
      const request = indexedDB.open('ours-e2ee')
      request.onsuccess = (e: Event) => {
        const target = e.target as IDBOpenDBRequest
        const db = target.result
        const tx = db.transaction(['keys'], 'readwrite')
        tx.objectStore('keys').clear()
        tx.oncomplete = () => {
          window.location.reload()
        }
      }
    }
  }

  async function handleSever() {
    if (severInput.toLowerCase() !== 'end') return
    setIsSevering(true)
    setSeverError('')

    try {
      const response = await fetch('/api/space/sever', { method: 'POST' })

      if (!response.ok) {
        const body = await response.json()
        setSeverError(body.error || 'Failed to end space')
        setIsSevering(false)
        return
      }

      // Space severed — redirect to setup
      router.refresh()
      router.push('/setup')
    } catch {
      setSeverError('Something went wrong. Please try again.')
      setIsSevering(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Space</h3>
            
            <button
              onClick={handleCopyMagicLink}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-colors hover:bg-neutral-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10">
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Copy className="h-5 w-5 text-indigo-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">Copy Magic Link</p>
                <p className="text-xs text-neutral-400">Invite your partner to this space</p>
              </div>
            </button>
            
            <button
              onClick={handleResetKey}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-colors hover:bg-neutral-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <KeyRound className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Forget Space Key</p>
                <p className="text-xs text-neutral-400">Clear key from this device</p>
              </div>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Account</h3>
            
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/20 p-4 text-left transition-colors hover:bg-red-900/40 disabled:opacity-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <LogOut className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </p>
              </div>
            </button>
          </div>

          {/* Danger Zone — Sever Protocol */}
          <div className="space-y-3 border-t border-neutral-800 pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-500/70">Danger Zone</h3>

            {!showSeverConfirm ? (
              <button
                onClick={() => setShowSeverConfirm(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/20 p-4 text-left transition-colors hover:bg-red-900/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                  <Skull className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-400">End this Space</p>
                  <p className="text-xs text-neutral-500">Permanently dissolve this relationship space</p>
                </div>
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
                <p className="text-sm text-red-300">
                  All data will be deleted after 30 days. This cannot be undone.
                </p>
                <p className="text-xs text-neutral-400">
                  Type <span className="font-mono font-bold text-red-400">end</span> to confirm.
                </p>
                <input
                  type="text"
                  value={severInput}
                  onChange={(e) => {
                    setSeverInput(e.target.value)
                    setSeverError('')
                  }}
                  placeholder="Type 'end' to confirm"
                  className="w-full rounded-lg border border-red-900/50 bg-black/50 px-3 py-2 font-mono text-sm text-white placeholder:text-neutral-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  autoFocus
                />
                {severError && (
                  <p className="text-xs text-red-400">{severError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowSeverConfirm(false)
                      setSeverInput('')
                      setSeverError('')
                    }}
                    className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSever}
                    disabled={severInput.toLowerCase() !== 'end' || isSevering}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSevering ? 'Ending...' : 'End Space'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
