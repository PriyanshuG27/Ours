'use client'

import { useRouter } from 'next/navigation'
import { Rss, MonitorPlay, LayoutGrid, Focus, Flame } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavCard {
  label: string
  icon: LucideIcon
  href: string
  /** Tailwind classes for the icon container background + text color */
  accent: string
  /** Subtle description shown below the label */
  description: string
}

const cards: NavCard[] = [
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
]

export function QuickNav() {
  const router = useRouter()

  return (
    <nav className="px-6 pt-8">
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-neutral-500">
        Quick access
      </p>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, index) => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/40 p-4 text-left backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50 active:scale-[0.97]"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className={`rounded-xl p-2.5 transition-transform group-hover:scale-110 ${card.accent}`}>
              <card.icon className="h-5 w-5" />
            </div>
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
