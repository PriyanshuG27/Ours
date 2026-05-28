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
  const { encrypt, decrypt, key } = useE2EEKey()

  const [items, setItems] = useState<BucketItem[]>([])
  const [decryptedWhys, setDecryptedWhys] = useState<Map<string, string>>(new Map())
  const [decryptedTitles, setDecryptedTitles] = useState<Map<string, string>>(new Map())
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
      await Promise.all(
        fetchedItems.map(async (item) => {
          if (item.title) {
            try {
              const decryptedTitle = await decrypt(item.title)
              titleMap.set(item.id, decryptedTitle)
            } catch {
              titleMap.set(item.id, item.title) // Fallback for plain text legacy items
            }
          } else {
            titleMap.set(item.id, 'Untitled')
          }
          if (item.encrypted_why) {
            try {
              const decrypted = await decrypt(item.encrypted_why)
              whyMap.set(item.id, decrypted)
            } catch (e) {
              console.error('Failed to decrypt why for item', item.id, e)
              whyMap.set(item.id, '[Decryption failed]')
            }
          }
        })
      )
      setDecryptedWhys(whyMap)
      setDecryptedTitles(titleMap)
    } catch (err) {
      console.error('Bucket fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [decrypt])

  useEffect(() => {
    if (key && userId) {
      fetchItems()
      
      const channel = supabase
        .channel(`bucket-items-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bucket_items',
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
  }, [key, userId, fetchItems])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSubmitting || !key) return

    setIsSubmitting(true)
    try {
      const encryptedWhy = why.trim() ? await encrypt(why) : await encrypt('')
      const encryptedTitle = await encrypt(title.trim())
      const res = await fetch('/api/bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedTitle, encryptedWhy }),
      })

      if (!res.ok) throw new Error('Failed to create bucket item')
      setTitle('')
      setWhy('')
      await fetchItems()
    } catch (err) {
      console.error('Failed to add bucket item:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems = items.filter(
    (item) => item.status === TABS.find((t) => t.id === activeTab)?.status
  )

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
            onClick={() => setActiveTab(tab.id)}
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
            
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">Why (Optional)</label>
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Why I want this with you..."
                rows={2}
                className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300 placeholder:text-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
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
      {filteredItems.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
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
