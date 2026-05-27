'use client'

import { useState, useEffect } from 'react'
import { useSpaceStore } from '@/store/space.store'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { encryptPayload, decryptPayload } from '@/lib/crypto/e2ee'
import { RuleCard, DecryptedRule } from './RuleCard'
import { LedgerEntry, DecryptedLedgerEntry } from './LedgerEntry'
import { ChargeModal } from './ChargeModal'
import { Plus, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export function RulebookView() {
  const { userId, partnerId, partnerName, isLoaded } = useSpaceStore()
  const { key, encrypt, decrypt } = useE2EEKey()

  const [rules, setRules] = useState<DecryptedRule[]>([])
  const [entries, setEntries] = useState<DecryptedLedgerEntry[]>([])
  
  const [newRuleText, setNewRuleText] = useState('')
  const [newPenaltyText, setNewPenaltyText] = useState('')
  const [category, setCategory] = useState('Household')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [chargeTarget, setChargeTarget] = useState<DecryptedRule | null>(null)
  
  const [activeTab, setActiveTab] = useState<'rules' | 'ledger' | 'scoreboard'>('rules')

  useEffect(() => {
    if (!key || !userId || !isLoaded) return

    async function fetchData() {
      setIsLoading(true)
      try {
        const [rulesRes, entriesRes] = await Promise.all([
          fetch('/api/rules'),
          fetch('/api/ledger?settled=false')
        ])

        const rulesData = await rulesRes.json()
        const entriesData = await entriesRes.json()

        const decryptedRules = await Promise.all(
          (rulesData.rules || []).map(async (r: any) => {
            const decryptedText = await decrypt(r.encrypted_text)
            const decryptedPenalty = r.encrypted_penalty ? await decrypt(r.encrypted_penalty) : null
            return { ...r, decryptedText, decryptedPenalty }
          })
        )

        const decryptedEntries = await Promise.all(
          (entriesData.entries || []).map(async (e: any) => {
            const decryptedRuleText = await decrypt(e.rules.encrypted_text)
            const decryptedPenalty = e.rules.encrypted_penalty ? await decrypt(e.rules.encrypted_penalty) : null
            const decryptedNote = e.encrypted_note 
              ? await decrypt(e.encrypted_note) 
              : null
            return { ...e, decryptedRuleText, decryptedPenalty, decryptedNote }
          })
        )

        setRules(decryptedRules)
        setEntries(decryptedEntries)
      } catch (err) {
        console.error('Failed to load rulebook data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    const channel = supabase.channel('rulebook-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules' }, () => {
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [key, userId, isLoaded])

  const handleProposeRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRuleText.trim() || !key || isSubmitting || !userId) return

    setIsSubmitting(true)
    try {
      const encryptedText = await encrypt(newRuleText)
      const encryptedPenalty = newPenaltyText.trim() ? await encrypt(newPenaltyText) : undefined
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedText, encryptedPenalty, category })
      })
      
      if (res.ok) {
        setNewRuleText('')
        setNewPenaltyText('')
        setCategory('Household')
      }
    } catch (err) {
      console.error('Failed to propose rule:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (ruleId: string, newStatus: 'active' | 'retired') => {
    try {
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: newStatus === 'retired' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        setRules(prev => prev.map(r => 
          r.id === ruleId ? { ...r, status: newStatus } : r
        ).filter(r => r.status !== 'retired'))
      }
    } catch (err) {
      console.error('Failed to update rule status:', err)
    }
  }

  const handleCharge = async (note: string) => {
    if (!chargeTarget || !key || !userId || !partnerId) return

    try {
      const encryptedNote = note ? await encrypt(note) : undefined
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: chargeTarget.id,
          chargedId: partnerId,
          encryptedNote
        })
      })

      if (res.ok) {
        // Optimistically reload ledger or just append
        const newRes = await fetch('/api/ledger?settled=false')
        const entriesData = await newRes.json()
        const decryptedEntries = await Promise.all(
          (entriesData.entries || []).map(async (e: any) => {
            const decryptedRuleText = await decrypt(e.rules.encrypted_text)
            const decryptedNote = e.encrypted_note 
              ? await decrypt(e.encrypted_note) 
              : null
            return { ...e, decryptedRuleText, decryptedNote }
          })
        )
        setEntries(decryptedEntries)
        setActiveTab('ledger')
      }
    } catch (err) {
      console.error('Failed to submit charge:', err)
      throw err
    }
  }

  const handleSettle = async (entryId: string) => {
    try {
      const res = await fetch(`/api/ledger/${entryId}/settle`, { method: 'POST' })
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, is_settled: true, settled_at: new Date().toISOString() } : e))
      }
    } catch (err) {
      console.error('Failed to settle debt:', err)
    }
  }

  const handleForgiveRequest = async (entryId: string) => {
    try {
      const res = await fetch(`/api/ledger/${entryId}/forgive`, { method: 'POST' })
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, forgiveness_requested: true } : e))
      }
    } catch (err) {
      console.error('Failed to request forgiveness:', err)
    }
  }

  if (isLoading || !isLoaded) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    )
  }

  const activeRules = rules.filter(r => r.status === 'active')
  const proposedRules = rules.filter(r => r.status === 'proposed')
  const unsettledEntries = entries.filter(e => !e.is_settled)
  
  const myComplianceScore = entries.filter(e => e.is_settled && e.charged_id === userId).length
  const partnerComplianceScore = entries.filter(e => e.is_settled && e.charged_id === partnerId).length

  return (
    <div className="mx-auto max-w-lg pb-24 pt-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Rulebook</h1>
        <div className="flex rounded-lg bg-neutral-900/60 p-1 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('rules')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'rules'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Rules
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'ledger'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Ledger
            {unsettledEntries.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500/20 px-1 text-[10px] text-rose-400">
                {unsettledEntries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('scoreboard')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'scoreboard'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Trophy className="h-3 w-3" /> Score
          </button>
        </div>
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <form onSubmit={handleProposeRule} className="relative flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <input
              type="text"
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              placeholder="Propose a new rule..."
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
            />
            <div className="flex items-center gap-2 border-t border-neutral-800 pt-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-400 focus:outline-none"
              >
                <option value="Household">Household</option>
                <option value="Financial">Financial</option>
                <option value="Communication">Communication</option>
                <option value="Intimacy">Intimacy</option>
                <option value="Fun">Fun</option>
              </select>
              <input
                type="text"
                value={newPenaltyText}
                onChange={(e) => setNewPenaltyText(e.target.value)}
                placeholder="Optional penalty (e.g. Make dinner)"
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !newRuleText.trim()}
                className="rounded-lg bg-violet-600 p-1.5 text-white transition-all hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:hover:bg-violet-600"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </form>

          {proposedRules.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
                Proposed Rules
              </h2>
              <div className="space-y-3">
                {proposedRules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isAuthor={rule.author_id === userId}
                    onStatusChange={(status) => handleStatusChange(rule.id, status)}
                    onChargeClick={() => setChargeTarget(rule)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-500">
              Active Rules
            </h2>
            {activeRules.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">No active rules yet.</p>
            ) : (
              <div className="space-y-3">
                {activeRules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isAuthor={rule.author_id === userId}
                    onStatusChange={(status) => handleStatusChange(rule.id, status)}
                    onChargeClick={() => setChargeTarget(rule)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {unsettledEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800/50 bg-neutral-900/20 py-12 text-center">
              <div className="mb-3 rounded-full bg-neutral-800/50 p-3">
                <span className="text-2xl">✨</span>
              </div>
              <p className="text-sm font-medium text-neutral-300">All settled up</p>
              <p className="mt-1 text-xs text-neutral-500">No active debts in the ledger.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unsettledEntries.map(entry => (
                <LedgerEntry
                  key={entry.id}
                  entry={entry}
                  currentUserId={userId!}
                  partnerName={partnerName || 'Partner'}
                  onSettle={() => handleSettle(entry.id)}
                  onForgiveRequest={() => handleForgiveRequest(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scoreboard' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-6 flex flex-col gap-6">
            <div className="text-center">
              <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <h2 className="text-lg font-medium text-neutral-200">Compliance Scoreboard</h2>
              <p className="text-sm text-neutral-500">Total debts settled and resolved</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-xl border border-neutral-800/50 bg-neutral-950 p-4">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">You</p>
                <p className="text-3xl font-semibold text-white">{myComplianceScore}</p>
              </div>
              <div className="rounded-xl border border-neutral-800/50 bg-neutral-950 p-4">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">{partnerName}</p>
                <p className="text-3xl font-semibold text-white">{partnerComplianceScore}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {chargeTarget && (
        <ChargeModal
          rule={chargeTarget}
          onClose={() => setChargeTarget(null)}
          onCharge={handleCharge}
        />
      )}
    </div>
  )
}
