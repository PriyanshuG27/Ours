'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus, Trash2, Shuffle, X, BookOpen } from 'lucide-react'
import { useSpace } from '@/hooks/use-space'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import type { DictionaryEntry } from '@/types/app.types'
import { supabase } from '@/lib/supabase/client'

interface DecryptedEntry {
  id: string
  word: string
  meaning: string
  origin: string | null
  author_id: string
  created_at: string
}

export function Dictionary() {
  const { spaceId, userId, partnerName } = useSpace()
  const { encrypt, decrypt, key, isLoaded: keyLoaded, needsKeyEntry } = useE2EEKey()

  const [rawEntries, setRawEntries] = useState<DictionaryEntry[]>([])
  const [entries, setEntries] = useState<DecryptedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [flashcard, setFlashcard] = useState<DecryptedEntry | null>(null)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Add form state
  const [newWord, setNewWord] = useState('')
  const [newMeaning, setNewMeaning] = useState('')
  const [newOrigin, setNewOrigin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch and decrypt entries
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/dictionary')
      if (!res.ok) return

      const data = (await res.json()) as { entries: DictionaryEntry[] }
      setRawEntries(data.entries ?? [])

      // Decrypt all fields
      const decrypted: DecryptedEntry[] = await Promise.all(
        (data.entries ?? []).map(async (entry) => {
          let word = ''
          let meaning = ''
          let origin: string | null = null

          try {
            word = await decrypt(entry.encrypted_word)
          } catch {
            word = '[unable to decrypt]'
          }

          try {
            meaning = await decrypt(entry.encrypted_meaning)
          } catch {
            meaning = '[unable to decrypt]'
          }

          if (entry.encrypted_origin) {
            try {
              origin = await decrypt(entry.encrypted_origin)
            } catch {
              origin = '[unable to decrypt]'
            }
          }

          return {
            id: entry.id,
            word,
            meaning,
            origin,
            author_id: entry.author_id,
            created_at: entry.created_at,
          }
        })
      )

      setEntries(decrypted)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [decrypt])

  useEffect(() => {
    if (key && userId) fetchEntries()
    // If key is loaded but missing, stop showing skeleton
    if (keyLoaded && !key) setLoading(false)

    if (!key || !userId || !spaceId) return

    const channel = supabase
      .channel(`dictionary-${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dictionary_entries',
          filter: `space_id=eq.${spaceId}`,
        },
        () => {
          fetchEntries()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [key, keyLoaded, userId, spaceId, fetchEntries])

  // Client-side sort + filter
  const filtered = useMemo(() => {
    let result = [...entries]

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) => e.word.toLowerCase().includes(q))
    }

    // Sort alphabetically by word
    result.sort((a, b) =>
      a.word.toLowerCase().localeCompare(b.word.toLowerCase())
    )

    return result
  }, [entries, search])

  // Group by first letter
  const grouped = useMemo(() => {
    const groups = new Map<string, DecryptedEntry[]>()

    for (const entry of filtered) {
      const letter = entry.word.charAt(0).toUpperCase() || '#'
      const existing = groups.get(letter) ?? []
      existing.push(entry)
      groups.set(letter, existing)
    }

    // Sort group keys
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  function getAuthorLabel(authorId: string): string {
    if (authorId === userId) return 'You'
    return partnerName ?? 'Partner'
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newWord.trim() || !newMeaning.trim() || submitting) return

    setSubmitting(true)
    try {
      const encryptedWord = await encrypt(newWord.trim())
      const encryptedMeaning = await encrypt(newMeaning.trim())
      const encryptedOrigin = newOrigin.trim()
        ? await encrypt(newOrigin.trim())
        : undefined

      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedWord,
          encryptedMeaning,
          encryptedOrigin,
        }),
      })

      if (res.ok) {
        setNewWord('')
        setNewMeaning('')
        setNewOrigin('')
        setShowAdd(false)
        await fetchEntries()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(entryId: string) {
    setDeleting(entryId)
    try {
      const res = await fetch(`/api/dictionary/${entryId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId))
        setRawEntries((prev) => prev.filter((e) => e.id !== entryId))
      }
    } finally {
      setDeleting(null)
    }
  }

  function showRandom() {
    if (entries.length === 0) return
    const idx = Math.floor(Math.random() * entries.length)
    setFlashcard(entries[idx])
    setFlashcardFlipped(false)
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-8 pb-24">
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-neutral-800/60" />
        </div>
        <div className="mb-4 h-10 animate-pulse rounded-xl bg-neutral-800/60" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-neutral-800/50 bg-neutral-900/40"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Our Dictionary
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          The words only you two understand.
        </p>
      </div>

      {/* Actions bar */}
      <div className="mb-4 flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words…"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 py-2.5 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        {/* Random button */}
        <button
          onClick={showRandom}
          disabled={entries.length === 0}
          title="Random entry"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800/50 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4" />
        </button>

        {/* Add button */}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 text-white transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Add form (expandable) */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-6 space-y-3 rounded-2xl border border-neutral-800/50 bg-neutral-900/60 p-4 backdrop-blur-sm animate-in slide-in-from-top-2"
        >
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Word or phrase"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <textarea
            value={newMeaning}
            onChange={(e) => setNewMeaning(e.target.value)}
            placeholder="What does it mean to you two?"
            rows={2}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <textarea
            value={newOrigin}
            onChange={(e) => setNewOrigin(e.target.value)}
            placeholder="Origin story (optional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newWord.trim() || !newMeaning.trim() || submitting}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 px-5 py-2 text-sm font-medium text-white transition-all disabled:opacity-40"
            >
              {submitting ? 'Adding…' : 'Add Entry'}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {entries.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800/50 bg-neutral-900/20 py-20 text-center">
          <div className="mb-3 rounded-full bg-neutral-800/50 p-4">
            <BookOpen className="h-8 w-8 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-neutral-300">
            Start building your private language
          </p>
          <p className="mt-1 max-w-[240px] text-xs text-neutral-500">
            Add the inside jokes, pet names, and made-up words only you two
            understand.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-600 px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Add First Word
          </button>
        </div>
      )}

      {/* Grouped list */}
      {grouped.map(([letter, group]) => (
        <div key={letter} className="mb-6">
          {/* Sticky letter header */}
          <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-black/80 py-1 backdrop-blur-sm">
            <span className="text-lg font-bold text-violet-400">{letter}</span>
            <div className="h-px flex-1 bg-neutral-800/50" />
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {group.map((entry) => (
              <article
                key={entry.id}
                className="group rounded-2xl border border-neutral-800/50 bg-neutral-900/60 p-4 backdrop-blur-sm transition-colors hover:border-neutral-700/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-neutral-100">
                      {entry.word}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-300">
                      {entry.meaning}
                    </p>
                    {entry.origin && (
                      <p className="mt-1.5 text-xs italic text-neutral-500">
                        <span className="font-medium not-italic text-neutral-600">
                          Origin:
                        </span>{' '}
                        {entry.origin}
                      </p>
                    )}
                    <span className="mt-2 inline-block text-[10px] font-medium text-neutral-600">
                      Added by {getAuthorLabel(entry.author_id)}
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                    className="shrink-0 rounded-lg p-1.5 text-neutral-700 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 disabled:opacity-50"
                    aria-label={`Delete ${entry.word}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}

      {/* No search results */}
      {search.trim() && filtered.length === 0 && entries.length > 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-neutral-500">
            No words matching &ldquo;{search}&rdquo;
          </p>
        </div>
      )}

      {/* Flashcard modal */}
      {flashcard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg p-4"
          onClick={() => setFlashcard(null)}
        >
          <button
            onClick={() => setFlashcard(null)}
            className="absolute right-4 top-4 rounded-full bg-neutral-800/80 p-2 text-neutral-400 transition-colors hover:text-neutral-200"
            aria-label="Close flashcard"
          >
            <X className="h-5 w-5" />
          </button>

          {/* 3D Flip card */}
          <div
            className="h-72 w-72 cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={(e) => {
              e.stopPropagation()
              setFlashcardFlipped(!flashcardFlipped)
            }}
          >
            <div
              className="relative h-full w-full transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: flashcardFlipped
                  ? 'rotateY(180deg)'
                  : 'rotateY(0deg)',
              }}
            >
              {/* Front — word */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-neutral-700/50 bg-gradient-to-br from-neutral-900 to-neutral-800 p-8 shadow-2xl"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-violet-400">
                  Our Word
                </p>
                <h2 className="text-center text-3xl font-bold text-white">
                  {flashcard.word}
                </h2>
                <p className="mt-6 text-xs text-neutral-600">tap to reveal</p>
              </div>

              {/* Back — meaning + origin */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-neutral-700/50 bg-gradient-to-br from-violet-950/80 to-neutral-900 p-8 shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <p className="mb-3 text-xs font-medium uppercase tracking-widest text-rose-400">
                  Meaning
                </p>
                <p className="text-center text-base leading-relaxed text-neutral-200">
                  {flashcard.meaning}
                </p>
                {flashcard.origin && (
                  <>
                    <div className="my-3 h-px w-12 bg-neutral-700" />
                    <p className="text-center text-xs italic text-neutral-400">
                      {flashcard.origin}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
