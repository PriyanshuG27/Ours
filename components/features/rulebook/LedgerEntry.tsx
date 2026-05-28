'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { Lock, Flame } from 'lucide-react'
import { useCountdown } from '@/hooks/use-countdown'

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
  forgiveness_requested_at?: string | null
  is_vetoed?: boolean
}

interface LedgerEntryProps {
  entry: DecryptedLedgerEntry
  currentUserId: string
  partnerName: string
  strikeCount: number
  canAskForgiveness: boolean
  cooldownTargetMs: number
  hasGoldenToken: boolean
  onSettle: () => void
  onForgiveRequest: () => void
  onVeto: () => void
}

export function LedgerEntry({ entry, currentUserId, partnerName, strikeCount, canAskForgiveness, cooldownTargetMs, hasGoldenToken, onSettle, onForgiveRequest, onVeto }: LedgerEntryProps) {
  const iAmCharger = entry.charger_id === currentUserId
  const chargerName = iAmCharger ? 'You' : partnerName
  const chargedName = iAmCharger ? partnerName : 'You'

  const { formatted: timerText, isExpired } = useCountdown(
    !canAskForgiveness && cooldownTargetMs > 0 ? cooldownTargetMs : null
  )

  const isActuallyLocked = !canAskForgiveness && !isExpired

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
      entry.is_settled 
        ? 'border-neutral-800/30 bg-neutral-900/20 opacity-60' 
        : 'border-neutral-800/50 bg-neutral-900/40 hover:border-neutral-700/80'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-300 flex items-center gap-2">
            <span><span className={iAmCharger ? 'text-rose-400' : 'text-neutral-300'}>{chargerName}</span> charged <span className={!iAmCharger ? 'text-rose-400' : 'text-neutral-300'}>{chargedName}</span></span>
            {strikeCount >= 2 && (
              <span className="shrink-0 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/30">
                🔥 Strike {strikeCount}
              </span>
            )}
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
          entry.is_vetoed ? (
            <span className="shrink-0 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-yellow-500 border border-yellow-500/20 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
              Vetoed (Burned)
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 border border-neutral-700">
              Settled
            </span>
          )
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
            <div className="flex items-center gap-2">
              {hasGoldenToken && (
                <button
                  onClick={onVeto}
                  className="group relative flex items-center gap-1.5 overflow-hidden rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow-500 transition-all hover:bg-yellow-500/20 border border-yellow-500/30 hover:scale-105 active:scale-95"
                >
                  <Flame className="h-3.5 w-3.5" />
                  Burn Token
                  <div className="absolute inset-0 bg-yellow-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={onForgiveRequest}
                  disabled={isActuallyLocked}
                  className={`relative flex items-center gap-1.5 overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    !isActuallyLocked 
                      ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 active:bg-neutral-600 border border-neutral-700' 
                      : 'bg-rose-950/40 text-rose-500 border border-rose-900/50 cursor-not-allowed shadow-[0_0_10px_rgba(225,29,72,0.1)]'
                  }`}
                >
                  {isActuallyLocked && <Lock className="h-3 w-3" />}
                  {!isActuallyLocked ? 'Ask Forgiveness' : 'Begging Locked'}
                  
                  {/* Subtle pulse animation for locked state */}
                  {isActuallyLocked && (
                    <div className="absolute inset-0 bg-rose-500/5 animate-pulse rounded-lg" />
                  )}
                </button>
                {isActuallyLocked && timerText && (
                  <span className="text-[10px] text-rose-500 font-bold font-mono tracking-widest uppercase">{timerText}</span>
                )}
              </div>
            </div>
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
