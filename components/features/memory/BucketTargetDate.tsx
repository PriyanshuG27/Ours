'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock } from 'lucide-react'

export function BucketTargetDate({
  itemId,
  initialDate,
  onUpdate,
}: {
  itemId: string
  initialDate: string | null
  onUpdate: () => void
}) {
  const [date, setDate] = useState(initialDate ? initialDate.split('T')[0] : '')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (initialDate) {
      setDate(initialDate.split('T')[0])
    }
  }, [initialDate])

  const handleUpdate = async (newDate: string) => {
    setDate(newDate)
    setUpdating(true)
    try {
      await fetch(`/api/bucket/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: newDate ? new Date(newDate).toISOString() : null }),
      })
      onUpdate()
    } catch {} finally {
      setUpdating(false)
    }
  }

  // Calculate days remaining
  let countdownText = ''
  let countdownColor = 'text-neutral-400'
  if (date) {
    const target = new Date(date)
    const now = new Date()
    const diff = target.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 3600 * 24))
    
    if (days < 0) {
      countdownText = `${Math.abs(days)} days ago`
      countdownColor = 'text-neutral-500'
    } else if (days === 0) {
      countdownText = 'Today!'
      countdownColor = 'text-rose-400 font-bold'
    } else if (days <= 30) {
      countdownText = `${days} Days left!`
      countdownColor = 'text-rose-400 font-bold'
    } else {
      countdownText = `${days} Days left`
      countdownColor = 'text-violet-400 font-medium'
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Target Date
        </h4>
        {date && (
          <span className={`text-xs flex items-center gap-1 ${countdownColor}`}>
            <Clock className="h-3 w-3" /> {countdownText}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="date"
          value={date}
          disabled={updating}
          onChange={(e) => handleUpdate(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
        />
      </div>
    </div>
  )
}
