'use client'

import { useState, useEffect } from 'react'
import { Wallet, Target, PiggyBank, Edit2, Check } from 'lucide-react'

export function BucketBudget({
  itemId,
  initialBudgetCents,
  initialSavedCents,
  onUpdate,
}: {
  itemId: string
  initialBudgetCents: number | null
  initialSavedCents: number
  onUpdate: () => void
}) {
  const [budgetCents, setBudgetCents] = useState(initialBudgetCents || 0)
  const [savedCents, setSavedCents] = useState(initialSavedCents || 0)
  const [isEditingBudget, setIsEditingBudget] = useState(!initialBudgetCents)
  const [budgetInput, setBudgetInput] = useState(initialBudgetCents ? (initialBudgetCents / 100).toString() : '')
  const [addAmount, setAddAmount] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setBudgetCents(initialBudgetCents || 0)
    setSavedCents(initialSavedCents || 0)
    if (initialBudgetCents && isEditingBudget) {
      setIsEditingBudget(false)
      setBudgetInput((initialBudgetCents / 100).toString())
    }
  }, [initialBudgetCents, initialSavedCents])

  const handleSetBudget = async () => {
    const val = parseFloat(budgetInput)
    if (isNaN(val) || val <= 0) return
    const cents = Math.round(val * 100)
    setBudgetCents(cents)
    setIsEditingBudget(false)
    await saveToDb({ budget_cents: cents })
  }

  const handleAddSavings = async () => {
    const val = parseFloat(addAmount)
    if (isNaN(val) || val <= 0) return
    const cents = Math.round(val * 100)
    const newSaved = savedCents + cents
    setSavedCents(newSaved)
    setAddAmount('')
    await saveToDb({ saved_cents: newSaved })
  }

  const saveToDb = async (payload: { budget_cents?: number; saved_cents?: number }) => {
    setUpdating(true)
    try {
      await fetch(`/api/bucket/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onUpdate()
    } catch (err) {
    } finally {
      setUpdating(false)
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  const percent = budgetCents > 0 ? Math.min(100, Math.round((savedCents / budgetCents) * 100)) : 0

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-3">
      <h4 className="text-xs font-medium text-neutral-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Savings Goal</span>
        {!isEditingBudget && budgetCents > 0 && (
          <button onClick={() => setIsEditingBudget(true)} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <Edit2 className="h-3 w-3" />
          </button>
        )}
      </h4>

      {isEditingBudget ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="Total estimated cost"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 pl-7 pr-3 py-2 text-sm text-neutral-200 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
          <button
            onClick={handleSetBudget}
            disabled={updating || !budgetInput}
            className="flex flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 px-3 py-2 text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-bold text-emerald-400">{formatCurrency(savedCents)}</div>
              <div className="text-xs text-neutral-500 flex items-center gap-1">
                <Target className="h-3 w-3" /> of {formatCurrency(budgetCents)} target
              </div>
            </div>
            <div className="text-sm font-bold text-neutral-300">{percent}%</div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</span>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Add savings..."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 pl-7 pr-3 py-1.5 text-xs text-neutral-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <button
              onClick={handleAddSavings}
              disabled={updating || !addAmount}
              className="flex flex-shrink-0 items-center gap-1 justify-center rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
            >
              <PiggyBank className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
