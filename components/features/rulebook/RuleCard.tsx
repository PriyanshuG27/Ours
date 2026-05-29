'use client'

import { formatDistanceToNow } from 'date-fns'

export interface DecryptedRule {
  id: string
  created_at: string
  author_id: string
  status: 'proposed' | 'active' | 'retired'
  decryptedText: string
  category: string
  decryptedCategory: string
  decryptedPenalty: string | null
}

interface RuleCardProps {
  rule: DecryptedRule
  isAuthor: boolean
  onStatusChange: (newStatus: 'active' | 'retired') => void
  onChargeClick: () => void
}

export function RuleCard({ rule, isAuthor, onStatusChange, onChargeClick }: RuleCardProps) {
  const isProposed = rule.status === 'proposed'
  const isActive = rule.status === 'active'

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-4 transition-colors hover:border-neutral-700/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {rule.decryptedCategory}
          </span>
          <p className="text-base text-neutral-200 leading-relaxed">
            {rule.decryptedText}
          </p>
          {rule.decryptedPenalty && (
            <p className="mt-2 text-sm text-rose-400/80 italic border-l-2 border-rose-500/30 pl-2">
              Penalty: {rule.decryptedPenalty}
            </p>
          )}
        </div>
        
        {isProposed && (
          <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-400 border border-violet-500/20">
            Proposed
          </span>
        )}
        {isActive && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-neutral-500">
          {formatDistanceToNow(new Date(rule.created_at), { addSuffix: true })}
        </span>

        <div className="flex items-center gap-2">
          {isProposed && isAuthor && (
            <span className="text-xs text-neutral-500 italic">
              Awaiting acceptance
            </span>
          )}
          {isProposed && !isAuthor && (
            <>
              <button
                onClick={() => onStatusChange('retired')}
                className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700"
              >
                Reject
              </button>
              <button
                onClick={() => onStatusChange('active')}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700 active:bg-violet-800 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
              >
                Accept
              </button>
            </>
          )}
          
          {isActive && (
            <>
              <button
                onClick={onChargeClick}
                className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/20"
              >
                Charge
              </button>
              <button
                onClick={() => onStatusChange('retired')}
                className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700"
              >
                Retire
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
