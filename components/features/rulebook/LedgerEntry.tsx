'use client'

import { formatDistanceToNow, format } from 'date-fns'

export interface DecryptedLedgerEntry {
  id: string
  created_at: string
  rule_id: string
  charger_id: string
  charged_id: string
  is_settled: boolean
  settled_at: string | null
  decryptedNote: string | null
  decryptedRuleText: string
  decryptedPenalty: string | null
  forgiveness_requested: boolean
}

interface LedgerEntryProps {
  entry: DecryptedLedgerEntry
  currentUserId: string
  partnerName: string
  onSettle: () => void
  onForgiveRequest: () => void
}

export function LedgerEntry({ entry, currentUserId, partnerName, onSettle, onForgiveRequest }: LedgerEntryProps) {
  const iAmCharger = entry.charger_id === currentUserId
  const chargerName = iAmCharger ? 'You' : partnerName
  const chargedName = iAmCharger ? partnerName : 'You'

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
      entry.is_settled 
        ? 'border-neutral-800/30 bg-neutral-900/20 opacity-60' 
        : 'border-neutral-800/50 bg-neutral-900/40 hover:border-neutral-700/80'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-300">
            <span className={iAmCharger ? 'text-rose-400' : 'text-neutral-300'}>{chargerName}</span> charged <span className={!iAmCharger ? 'text-rose-400' : 'text-neutral-300'}>{chargedName}</span>
          </p>
          <p className={`mt-1 text-base text-neutral-200 ${entry.is_settled ? 'line-through decoration-neutral-500' : ''}`}>
            {entry.decryptedRuleText}
          </p>
          
          {entry.decryptedPenalty && (
            <p className="mt-1 text-sm font-medium text-rose-400/90">
              Owed: {entry.decryptedPenalty}
            </p>
          )}

          {entry.decryptedNote && (
            <div className="mt-2 rounded-lg bg-neutral-950 p-2.5 text-sm text-neutral-400 border border-neutral-800/50">
              &ldquo;{entry.decryptedNote}&rdquo;
            </div>
          )}
        </div>
        
        {entry.is_settled ? (
          <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 border border-neutral-700">
            Settled
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-rose-400 border border-rose-500/20">
            Unsettled
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-neutral-500 flex items-center gap-2">
          {entry.is_settled && entry.settled_at
            ? `Settled on ${format(new Date(entry.settled_at), 'MMM d, yyyy')}`
            : formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
            
          {!entry.is_settled && entry.forgiveness_requested && (
            <span className="italic text-indigo-400">
              • Forgiveness requested
            </span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {!entry.is_settled && !iAmCharger && !entry.forgiveness_requested && (
            <button
              onClick={onForgiveRequest}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700"
            >
              Ask Forgiveness
            </button>
          )}

          {!entry.is_settled && iAmCharger && (
            <button
              onClick={onSettle}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700"
            >
              {entry.forgiveness_requested ? "Forgive & Settle" : "Settle Debt"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
