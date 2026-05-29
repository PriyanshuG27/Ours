'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSpaceStore } from '@/store/space.store'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { supabase } from '@/lib/supabase/client'
import {
  BucketItem,
  BucketItemStatus,
} from '@/types/app.types'
import { BucketItem as BucketItemCard } from './BucketItem'
import { Plus, MapPin, Compass, Sparkles } from 'lucide-react'

type TabId = 'someday' | 'planning' | 'done'

const TABS: { id: TabId; label: string; status: BucketItemStatus }[] = [
  { id: 'someday', label: 'Someday', status: BucketItemStatus.SOMEDAY },
  { id: 'planning', label: 'Planning', status: BucketItemStatus.PLANNING },
  { id: 'done', label: 'We Did This ✨', status: BucketItemStatus.DONE },
]

export function BucketList() {
  const userId = useSpaceStore((s) => s.userId)
  const spaceId = useSpaceStore((s) => s.spaceId)
  const { encrypt, decrypt, key } = useE2EEKey()

  const [items, setItems] = useState<BucketItem[]>([])
  const [decryptedWhys, setDecryptedWhys] = useState<Map<string, string>>(new Map())
  const [decryptedTitles, setDecryptedTitles] = useState<Map<string, string>>(new Map())
  const [decryptedCategories, setDecryptedCategories] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('someday')

  // Add form state
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/bucket?_t=${Date.now()}`)
      if (!res.ok) throw new Error('Failed to fetch bucket items')
      const data = await res.json()
      const fetchedItems: BucketItem[] = data.items ?? []
      setItems(fetchedItems)

      // Decrypt all why and title values
      const whyMap = new Map<string, string>()
      const titleMap = new Map<string, string>()
      const catMap = new Map<string, string>()
      await Promise.all(
        fetchedItems.map(async (item) => {
          if (item.title) {
            try {
              const decryptedTitle = await decrypt(item.title)
              titleMap.set(item.id, decryptedTitle)
            } catch {
              titleMap.set(item.id, '[unable to decrypt]')
            }
          } else {
            titleMap.set(item.id, 'Untitled')
          }
          if (item.category) {
            try {
              const decryptedCat = await decrypt(item.category)
              catMap.set(item.id, decryptedCat)
            } catch {
              catMap.set(item.id, item.category)
            }
          }
          if (item.encrypted_why) {
            try {
              const decrypted = await decrypt(item.encrypted_why)
              whyMap.set(item.id, decrypted)
            } catch (e) {
              whyMap.set(item.id, '[unable to decrypt]')
            }
          }
        })
      )
      setDecryptedWhys(whyMap)
      setDecryptedTitles(titleMap)
      setDecryptedCategories(catMap)
    } catch (err) {
    } finally {
      setIsLoading(false)
    }
  }, [decrypt])

  useEffect(() => {
    if (key && spaceId) {
      fetchItems()
      
      const channel = supabase
        .channel(`bucket-items-${spaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bucket_items',
            filter: `space_id=eq.${spaceId}`,
          },
          () => {
            fetchItems()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [key, spaceId, fetchItems])

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const CATEGORIES = ['Travel', 'Food', 'Adventure', 'Home', 'Financial', 'Other']

  const handleSurpriseUs = () => {
    const somedayItems = items.filter(i => i.status === 'someday')
    if (somedayItems.length === 0) return
    const randomItem = somedayItems[Math.floor(Math.random() * somedayItems.length)]
    // In a real app this might open a modal, but for now let's just trigger a browser alert with the decrypted title
    const title = decryptedTitles.get(randomItem.id) || 'A secret dream'
    alert(`Surprise! How about we do this:\\n\\n✨ ${title} ✨\\n\\nMove it to Planning?`)
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSubmitting || !key) return

    setIsSubmitting(true)
    try {
      const encryptedWhy = why.trim() ? await encrypt(why) : await encrypt('')
      const encryptedTitle = await encrypt(title.trim())
      const encryptedCategory = category ? await encrypt(category) : ''
      const res = await fetch('/api/bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedTitle, encryptedWhy, category: encryptedCategory }),
      })

      if (!res.ok) throw new Error('Failed to create bucket item')
      setTitle('')
      setWhy('')
      setCategory('')
      await fetchItems()
    } catch (err) {
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesTab = item.status === TABS.find((t) => t.id === activeTab)?.status
    const matchesCategory = categoryFilter ? decryptedCategories.get(item.id) === categoryFilter : true
    return matchesTab && matchesCategory
  })

  // Sort items to put highly hyped ones at the top of the someday list
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.status === 'someday' && b.status === 'someday') {
      const aHype = Array.isArray(a.hype_votes) ? a.hype_votes.length : 0;
      const bHype = Array.isArray(b.hype_votes) ? b.hype_votes.length : 0;
      return bHype - aHype;
    }
    // For planning/done, just sort by newest
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-8 pb-24">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-neutral-800/60" />
        </div>
        <div className="mb-6 flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-neutral-800/60" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-neutral-900/60 border border-neutral-800/50"
            />
          ))}
        </div>
      </div>
    )
  }

  const emptyStates: Record<TabId, { icon: React.ReactNode; title: string; subtitle: string }> = {
    someday: {
      icon: <Compass className="h-8 w-8 text-violet-400" />,
      title: 'Dream together',
      subtitle: 'Add the adventures you want to share someday.',
    },
    planning: {
      icon: <MapPin className="h-8 w-8 text-blue-400" />,
      title: 'Start planning',
      subtitle: 'Move a dream here when you\'re ready to make it real.',
    },
    done: {
      icon: <Sparkles className="h-8 w-8 text-emerald-400" />,
      title: 'Complete adventures together',
      subtitle: 'Finished bucket list items will appear here.',
    },
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Bucket List</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Things to do together, one day at a time.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto scrollbar-hide rounded-xl bg-neutral-900/40 p-1 backdrop-blur-sm border border-neutral-800/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setCategoryFilter(null) // Reset category on tab change
            }}
            className={`relative flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-gradient-to-r from-violet-500 to-rose-500" />
            )}
          </button>
        ))}
      </div>

      {/* Categories & Actions Bar */}
      <div className="mb-6 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === null
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                  : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        {activeTab === 'someday' && items.filter(i => i.status === 'someday').length > 1 && (
          <button
            onClick={handleSurpriseUs}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)] transition-all hover:border-rose-500/50 hover:bg-rose-500/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Surprise Us
          </button>
        )}
      </div>

      {/* Add form — only on Someday tab */}
      {activeTab === 'someday' && (
        <form
          onSubmit={handleAddItem}
          className="mb-6 rounded-2xl border border-neutral-800/50 bg-neutral-900/60 p-4 backdrop-blur-sm"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">Dream Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you want to do together?"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="">No Category</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Why (Optional)</label>
                <textarea
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="Why I want this with you..."
                  rows={1}
                  className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Dream
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      {sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800/50 bg-neutral-900/20 py-16 text-center">
          <div className="mb-3 rounded-full bg-neutral-800/50 p-4">
            {emptyStates[activeTab].icon}
          </div>
          <p className="text-sm font-medium text-neutral-300">
            {emptyStates[activeTab].title}
          </p>
          <p className="mt-1 max-w-[220px] text-xs text-neutral-500">
            {emptyStates[activeTab].subtitle}
          </p>
        </div>
      ) : activeTab === 'done' ? (
        <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-neutral-800/50">
          {Object.entries(
            sortedItems.reduce((acc, item) => {
              const date = new Date(item.completed_at || item.created_at)
              const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' })
              if (!acc[monthYear]) acc[monthYear] = []
              acc[monthYear].push(item)
              return acc
            }, {} as Record<string, typeof sortedItems>)
          ).map(([monthYear, monthItems]) => (
            <div key={monthYear} className="relative">
              <div className="sticky top-4 z-10 mb-4 ml-10 inline-block rounded-full border border-neutral-700/50 bg-neutral-800/80 px-3 py-1 text-xs font-bold text-neutral-300 backdrop-blur-md shadow-sm">
                {monthYear}
              </div>
              <div className="space-y-4">
                {monthItems.map((item) => (
                  <div key={item.id} className="relative ml-10">
                    <div className="absolute -left-7 top-6 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-neutral-900 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <BucketItemCard
                      item={item}
                      decryptedTitle={decryptedTitles.get(item.id) ?? item.title}
                      decryptedWhy={decryptedWhys.get(item.id) ?? ''}
                      currentUserId={userId ?? ''}
                      onUpdate={fetchItems}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map((item) => (
            <BucketItemCard
              key={item.id}
              item={item}
              decryptedTitle={decryptedTitles.get(item.id) ?? item.title}
              decryptedWhy={decryptedWhys.get(item.id) ?? ''}
              currentUserId={userId ?? ''}
              onUpdate={fetchItems}
            />
          ))}
        </div>
      )}
    </div>
  )
}
