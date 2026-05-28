'use client'

import { useState, useEffect } from 'react'
import { useSpaceStore } from '@/store/space.store'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { encryptPayload, decryptPayload } from '@/lib/crypto/e2ee'
import { RuleCard, DecryptedRule } from './RuleCard'
import { LedgerEntry, DecryptedLedgerEntry } from './LedgerEntry'
import { ChargeModal } from './ChargeModal'
import { Plus, Trophy, Flame, AlertCircle, Scale, ShieldAlert } from 'lucide-react'
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
  const [isBurningToken, setIsBurningToken] = useState(false)
  
  const [chargeTarget, setChargeTarget] = useState<DecryptedRule | null>(null)
  
  const [activeTab, setActiveTab] = useState<'rules' | 'ledger' | 'scoreboard'>('rules')

  useEffect(() => {
    if (!key || !userId || !isLoaded) return

    async function fetchData(isBackground = false) {
      if (!isBackground) setIsLoading(true)
      try {
        const [rulesRes, entriesRes] = await Promise.all([
          fetch('/api/rules'),
          fetch('/api/ledger')
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
        if (!isBackground) setIsLoading(false)
      }
    }

    fetchData()

    const channel = supabase.channel('rulebook-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rules' }, () => {
        fetchData(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, () => {
        fetchData(true)
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
        const newRes = await fetch('/api/ledger')
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

  const handleVeto = async (entryId: string) => {
    if (!hasGoldenToken) return
    
    // Trigger God-Level Animation
    setIsBurningToken(true)
    await new Promise(r => setTimeout(r, 2500))

    try {
      const res = await fetch(`/api/ledger/${entryId}/veto`, { method: 'POST' })
      if (res.ok) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, is_settled: true, is_vetoed: true, settled_at: new Date().toISOString() } : e))
      }
    } catch (err) {
      console.error('Failed to veto debt:', err)
    } finally {
      setIsBurningToken(false)
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

  const sevenDaysAgoMs = new Date().getTime() - 7 * 24 * 60 * 60 * 1000

  let mostRecentForgivenessMs = 0
  entries.forEach(e => {
    if (e.charged_id === userId && e.forgiveness_requested_at) {
      const ms = new Date(e.forgiveness_requested_at).getTime()
      if (ms > mostRecentForgivenessMs) {
        mostRecentForgivenessMs = ms
      }
    }
  })

  let canAskForgiveness = true
  let cooldownTargetMs = 0

  if (mostRecentForgivenessMs > sevenDaysAgoMs) {
    canAskForgiveness = false
    cooldownTargetMs = mostRecentForgivenessMs + 7 * 24 * 60 * 60 * 1000
  }

  const getStrikes = (ruleId: string, chargedId: string) => {
    return entries.filter(e => e.rule_id === ruleId && e.charged_id === chargedId).length
  }

  // Token Mechanic
  const currentMonth = new Date().getMonth()
  const myVetoesThisMonth = entries.filter(e => e.is_vetoed && e.charged_id === userId && e.settled_at && new Date(e.settled_at).getMonth() === currentMonth).length
  const hasGoldenToken = myVetoesThisMonth === 0

  // Category Breakdown Stats
  const categoryCounts: Record<string, number> = {}
  let totalEntries = 0
  entries.forEach(e => {
    // Note: We need category from the database payload. If e.rules is missing or category is missing, default to 'Other'
    const cat = (e as any).rules?.category || 'Household'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    totalEntries++
  })

  // 7-Day Debt Tides
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    d.setHours(0, 0, 0, 0)
    return { date: d, count: 0 }
  })
  
  entries.forEach(e => {
    const entryDate = new Date(e.created_at)
    entryDate.setHours(0, 0, 0, 0)
    const dayMatch = last7Days.find(d => d.date.getTime() === entryDate.getTime())
    if (dayMatch) {
      dayMatch.count++
    }
  })
  
  const maxTide = Math.max(...last7Days.map(d => d.count), 1)

  // Advanced Stats
  const myActiveDebts = unsettledEntries.filter(e => e.charged_id === userId).length
  const partnerActiveDebts = unsettledEntries.filter(e => e.charged_id === partnerId).length

  let mostBrokenRuleText = 'None yet'
  let highestChargeCount = 0
  const ruleCounts: Record<string, { count: number, text: string }> = {}
  
  entries.forEach(e => {
    if (!ruleCounts[e.rule_id]) {
      ruleCounts[e.rule_id] = { count: 0, text: e.decryptedRuleText }
    }
    ruleCounts[e.rule_id].count++
    if (ruleCounts[e.rule_id].count > highestChargeCount) {
      highestChargeCount = ruleCounts[e.rule_id].count
      mostBrokenRuleText = ruleCounts[e.rule_id].text
    }
  })

  // Forgiveness denied vs granted? (If it's settled and forgiveness was requested, it was granted!)
  const forgivenessGrantedMe = entries.filter(e => e.charged_id === userId && e.forgiveness_requested && e.is_settled).length
  const forgivenessGrantedPartner = entries.filter(e => e.charged_id === partnerId && e.forgiveness_requested && e.is_settled).length

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
                  strikeCount={getStrikes(entry.rule_id, entry.charged_id)}
                  canAskForgiveness={canAskForgiveness}
                  cooldownTargetMs={cooldownTargetMs}
                  hasGoldenToken={hasGoldenToken}
                  onSettle={() => handleSettle(entry.id)}
                  onForgiveRequest={() => handleForgiveRequest(entry.id)}
                  onVeto={() => handleVeto(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scoreboard' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Main Compliance Score */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-6 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-500/5 blur-[50px]" />
            <div className="text-center relative z-10">
              <Trophy className="h-8 w-8 text-amber-400 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <h2 className="text-lg font-medium text-neutral-200">Compliance Scoreboard</h2>
              <p className="text-sm text-neutral-500">Total debts successfully settled</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center relative z-10">
              <div className="rounded-xl border border-neutral-800/50 bg-neutral-950 p-4 shadow-inner">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">You</p>
                <p className="text-4xl font-bold text-white">{myComplianceScore}</p>
              </div>
              <div className="rounded-xl border border-neutral-800/50 bg-neutral-950 p-4 shadow-inner">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">{partnerName}</p>
                <p className="text-4xl font-bold text-white">{partnerComplianceScore}</p>
              </div>
            </div>
          </div>

          {/* Active Debts vs Forgiveness */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-medium text-neutral-300 uppercase tracking-wider">Active Debts</h3>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase">You Owe</p>
                  <p className="text-2xl font-semibold text-rose-400">{myActiveDebts}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500 uppercase">They Owe</p>
                  <p className="text-2xl font-semibold text-rose-400">{partnerActiveDebts}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-indigo-400" />
                <h3 className="text-xs font-medium text-neutral-300 uppercase tracking-wider">Forgiven</h3>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-neutral-500 uppercase">You</p>
                  <p className="text-2xl font-semibold text-indigo-400">{forgivenessGrantedMe}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-neutral-500 uppercase">Partner</p>
                  <p className="text-2xl font-semibold text-indigo-400">{forgivenessGrantedPartner}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hall of Shame */}
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-medium text-amber-500 uppercase tracking-wider">Hall of Shame</h3>
            </div>
            <p className="text-xs text-neutral-400 mb-2">Most frequently broken rule ({highestChargeCount} times):</p>
            <p className="text-sm text-neutral-200 font-medium italic bg-neutral-950/50 p-3 rounded-lg border border-amber-500/10">
              &quot;{mostBrokenRuleText}&quot;
            </p>
          </div>

          {/* Golden Token Inventory */}
          <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-transparent p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-yellow-500 uppercase tracking-wider mb-1">Golden Token</h3>
                <p className="text-xs text-neutral-400">Monthly Get Out of Jail Free Card</p>
              </div>
              <div className={`h-12 w-12 rounded-full border-2 flex items-center justify-center ${hasGoldenToken ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)] animate-pulse' : 'border-neutral-700 bg-neutral-800 text-neutral-600'}`}>
                <span className="text-xl">🎟️</span>
              </div>
            </div>
            {!hasGoldenToken && <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-wide">Restocks 1st of next month</p>}
          </div>

          {/* Category Breakdown */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-5">
            <h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wider mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>{cat}</span>
                    <span>{Math.round((count / totalEntries) * 100)}% ({count})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-violet-500" 
                      style={{ width: `${(count / totalEntries) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {totalEntries === 0 && <p className="text-xs text-neutral-500 italic">No rules broken yet.</p>}
            </div>
          </div>

          {/* Debt Tides (7-Day Activity) */}
          <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-5">
            <h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wider mb-4">Debt Tides (Last 7 Days)</h3>
            <div className="flex items-end justify-between h-24 gap-2">
              {last7Days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full relative flex-1 flex items-end">
                    <div 
                      className="w-full rounded-t-sm bg-indigo-500/50 transition-all group-hover:bg-indigo-400" 
                      style={{ height: `${Math.max((day.count / maxTide) * 100, 2)}%` }}
                    />
                    {day.count > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {day.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-600 uppercase tracking-widest">
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' })[0]}
                  </span>
                </div>
              ))}
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

      {isBurningToken && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative flex flex-col items-center justify-center">
            {/* Dramatic glow layers */}
            <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
              <div className="h-[500px] w-[500px] rounded-full bg-yellow-500/20 blur-[100px] animate-pulse" />
              <div className="absolute h-[300px] w-[300px] rounded-full bg-rose-600/40 blur-[80px] animate-ping" />
            </div>
            
            {/* The burning token */}
            <div className="relative z-10 animate-bounce">
              <Flame className="h-40 w-40 text-yellow-400 drop-shadow-[0_0_50px_rgba(250,204,21,1)]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl drop-shadow-2xl">🎟️</span>
              </div>
            </div>

            <h1 className="mt-12 text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-rose-600 animate-pulse tracking-[0.2em] uppercase text-center drop-shadow-2xl z-10">
              Veto Activated<br/>
              <span className="text-2xl text-rose-400 tracking-widest opacity-80 block mt-4">Debt Annihilated</span>
            </h1>
          </div>
        </div>
      )}
    </div>
  )
}
