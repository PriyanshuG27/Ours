'use client'

import { useRouter } from 'next/navigation'
import { Rss, MonitorPlay, LayoutGrid, Focus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavCard {
  label: string
  icon: LucideIcon
  href: string
  accent: string
}

const cards: NavCard[] = [
  {
    label: 'Feed',
    icon: Rss,
    href: '/feed',
    accent: 'bg-violet-500/10 text-violet-400',
  },
  {
    label: 'Watch Room',
    icon: MonitorPlay,
    href: '/watch',
    accent: 'bg-sky-500/10 text-sky-400',
  },
  {
    label: 'Problem Board',
    icon: LayoutGrid,
    href: '/board',
    accent: 'bg-amber-500/10 text-amber-400',
  },
  {
    label: 'Focus Mode',
    icon: Focus,
    href: '/focus',
    accent: 'bg-emerald-500/10 text-emerald-400',
  },
]

export function QuickNav() {
  const router = useRouter()

  return (
    <nav className="px-6 pt-6">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/50 p-4 text-left transition-all hover:border-neutral-700 hover:bg-neutral-800/60 active:scale-[0.98]"
          >
            <div className={`rounded-xl p-2.5 ${card.accent}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-neutral-300 transition-colors group-hover:text-white">
              {card.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
