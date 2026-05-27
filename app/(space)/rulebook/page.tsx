import { RulebookView } from '@/components/features/rulebook/RulebookView'

export const metadata = {
  title: 'Rulebook & Ledger | Ours',
}

export default function RulebookPage() {
  return (
    <div className="min-h-screen bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-900/10 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-rose-900/10 blur-[80px]" />
      </div>

      <div className="relative z-10">
        <RulebookView />
      </div>
    </div>
  )
}
