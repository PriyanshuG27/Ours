'use client'

import { useRouter } from 'next/navigation'
import { Rss, MonitorPlay, LayoutGrid, Focus, Flame, BookOpen, ImagePlus, MapPinned, Languages, Newspaper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSpaceStore } from '@/store/space.store'

interface NavCard {
  label: string
  icon: LucideIcon
  href: string
  /** Tailwind classes for the icon container background + text color */
  accent: string
  /** Subtle description shown below the label */
  description: string
}

const baseCards: NavCard[] = [
  {
    label: 'Feed',
    icon: Rss,
    href: '/feed',
    accent: 'bg-violet-500/10 text-violet-400',
    description: 'Photos & moments',
  },
  {
    label: 'Watch Room',
    icon: MonitorPlay,
    href: '/watch',
    accent: 'bg-sky-500/10 text-sky-400',
    description: 'Watch together',
  },
  {
    label: 'Problem Board',
    icon: LayoutGrid,
    href: '/board',
    accent: 'bg-amber-500/10 text-amber-400',
    description: 'Work through it',
  },
  {
    label: 'Focus Mode',
    icon: Focus,
    href: '/focus',
    accent: 'bg-emerald-500/10 text-emerald-400',
    description: 'Study together',
  },
  {
    label: 'Streaks',
    icon: Flame,
    href: '/streaks',
    accent: 'bg-orange-500/10 text-orange-400',
    description: 'Daily habits',
  },
  {
    label: 'Rulebook',
    icon: BookOpen,
    href: '/rulebook',
    accent: 'bg-rose-500/10 text-rose-400',
    description: 'Rules & ledger',
  },
  {
    label: 'Memory Wall',
    icon: ImagePlus,
    href: '/memory-wall',
    accent: 'bg-pink-500/10 text-pink-400',
    description: 'Pinned moments',
  },
  {
    label: 'Bucket List',
    icon: MapPinned,
    href: '/bucket-list',
    accent: 'bg-teal-500/10 text-teal-400',
    description: 'Dreams together',
  },
  {
    label: 'Dictionary',
    icon: Languages,
    href: '/dictionary',
    accent: 'bg-indigo-500/10 text-indigo-400',
    description: 'Our language',
  },
  {
    label: 'Newspaper',
    icon: Newspaper,
    href: '/newspaper',
    accent: 'bg-slate-500/10 text-slate-400',
    description: 'Sunday digest',
  },
]

export function QuickNav() {
  const router = useRouter()
  const isLoaded = useSpaceStore(state => state.isLoaded)
  const [unsettledCount, setUnsettledCount] = useState(0)

  useEffect(() => {
    if (!isLoaded) return
    fetch('/api/ledger?settled=false')
      .then(res => res.json())
      .then(data => {
        if (data.count !== undefined && data.count !== null) {
          setUnsettledCount(data.count)
        } else if (data.entries) {
          setUnsettledCount(data.entries.length)
        }
      })
      .catch(console.error)
  }, [isLoaded])

  return (
    <nav className="px-6 pt-8">
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
        Quick access
      </p>
      <div className="grid grid-cols-2 gap-3">
        {baseCards.map((card, index) => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="relative group flex flex-col items-start gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-4 text-left backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50 active:scale-[0.97]"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className={`rounded-xl p-2.5 transition-transform group-hover:scale-110 ${card.accent}`}>
              <card.icon className="h-5 w-5" />
            </div>
            
            {card.href === '/rulebook' && unsettledCount > 0 && (
              <div className="absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg animate-in zoom-in">
                {unsettledCount}
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-neutral-200 transition-colors group-hover:text-white">
                {card.label}
              </span>
              <span className="text-[11px] text-neutral-500">
                {card.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </nav>
  )
}
