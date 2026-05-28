import { useState } from 'react'
import { X, Copy, Check, LogOut, KeyRound } from 'lucide-react'
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
      request.onsuccess = (e: any) => {
        const db = e.target.result
        const tx = db.transaction(['keys'], 'readwrite')
        tx.objectStore('keys').clear()
        tx.oncomplete = () => {
          window.location.reload()
        }
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
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

        </div>
      </div>
    </div>
  )
}
