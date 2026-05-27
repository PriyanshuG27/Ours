'use client'

import { useState } from 'react'
import { DecryptedRule } from './RuleCard'

interface ChargeModalProps {
  rule: DecryptedRule
  onClose: () => void
  onCharge: (note: string) => Promise<void>
}

export function ChargeModal({ rule, onClose, onCharge }: ChargeModalProps) {
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await onCharge(note)
      onClose()
    } catch (err) {
      console.error('Failed to charge:', err)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl p-6">
        <h3 className="text-lg font-medium text-white mb-2">Charge Partner</h3>
        <p className="text-sm text-neutral-400 mb-6">
          You are charging them for breaking the rule:<br />
          <strong className="text-neutral-200 block mt-2 border-l-2 border-violet-500 pl-3">
            {rule.decryptedText}
          </strong>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Add a note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened?"
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-white placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none h-24"
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 active:bg-rose-800 shadow-[0_0_15px_rgba(225,29,72,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? 'Charging...' : 'Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
