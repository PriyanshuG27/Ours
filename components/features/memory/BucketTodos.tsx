'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useE2EEKey } from '@/hooks/use-e2ee-key'
import { useSpaceStore } from '@/store/space.store'

interface Todo {
  id: string
  encrypted_text: string
  is_completed: boolean
  assigned_to: string | null
}

interface DecryptedTodo extends Todo {
  text: string
}

export function BucketTodos({ itemId }: { itemId: string }) {
  const { encrypt, decrypt, key } = useE2EEKey()
  const { userId, partnerId, partnerName } = useSpaceStore()
  const [todos, setTodos] = useState<DecryptedTodo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch(`/api/bucket/${itemId}/todos?_t=${Date.now()}`)
      if (!res.ok) throw new Error('Failed to fetch todos')
      const data = await res.json()

      const decryptedTodos = await Promise.all(
        (data.todos as Todo[]).map(async (todo) => {
          try {
            const text = await decrypt(todo.encrypted_text)
            return { ...todo, text }
          } catch {
            return { ...todo, text: '[unable to decrypt]' }
          }
        })
      )
      setTodos(decryptedTodos)
    } catch {} finally {
      setLoading(false)
    }
  }, [itemId, decrypt])

  useEffect(() => {
    if (key && userId) {
      fetchTodos()

      const channel = supabase
        .channel(`bucket-todos-${itemId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bucket_todos',
            filter: `bucket_item_id=eq.${itemId}`,
          },
          () => {
            fetchTodos()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [key, userId, itemId, fetchTodos])

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim() || !key) return

    const text = newTodo.trim()
    setNewTodo('')

    try {
      const encryptedText = await encrypt(text)
      await fetch(`/api/bucket/${itemId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedText }),
      })
      await fetchTodos()
    } catch {}
  }

  const toggleTodo = async (todo: DecryptedTodo) => {
    try {
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t))
      )
      await fetch(`/api/bucket/${itemId}/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !todo.is_completed }),
      })
    } catch (err) {
      await fetchTodos() // revert
    }
  }

  const toggleAssignment = async (todo: DecryptedTodo) => {
    // Cycle: null -> userId -> partnerId -> null
    let newAssigned: string | null = null
    if (todo.assigned_to === null) {
      newAssigned = userId
    } else if (todo.assigned_to === userId) {
      newAssigned = partnerId
    } else {
      newAssigned = null
    }

    try {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, assigned_to: newAssigned } : t))
      )
      await fetch(`/api/bucket/${itemId}/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: newAssigned }),
      })
    } catch (err) {
      await fetchTodos()
    }
  }

  const deleteTodo = async (todoId: string) => {
    try {
      setTodos((prev) => prev.filter((t) => t.id !== todoId))
      await fetch(`/api/bucket/${itemId}/todos/${todoId}`, {
        method: 'DELETE',
      })
    } catch (err) {
      await fetchTodos()
    }
  }

  if (loading) {
    return (
      <div className="mt-4 animate-pulse space-y-2">
        <div className="h-8 w-full rounded-lg bg-neutral-800/50" />
        <div className="h-8 w-full rounded-lg bg-neutral-800/50" />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-3">
      <h4 className="text-xs font-medium text-neutral-400">Planning Checklist</h4>
      
      <div className="flex flex-col gap-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={`flex items-center justify-between gap-3 rounded-lg border border-neutral-800/50 bg-neutral-800/20 px-3 py-2 transition-colors ${
              todo.is_completed ? 'opacity-50' : ''
            }`}
          >
            <button
              onClick={() => toggleTodo(todo)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                  todo.is_completed
                    ? 'border-violet-500 bg-violet-500 text-white'
                    : 'border-neutral-600 bg-transparent'
                }`}
              >
                {todo.is_completed && <Check className="h-3 w-3" />}
              </div>
              <span
                className={`text-sm transition-colors ${
                  todo.is_completed ? 'text-neutral-500 line-through' : 'text-neutral-200'
                }`}
              >
                {todo.text}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAssignment(todo)}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold uppercase transition-colors ${
                  todo.assigned_to === userId
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : todo.assigned_to === partnerId
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-neutral-800 text-neutral-500 border border-neutral-700/50 hover:bg-neutral-700'
                }`}
                title={
                  todo.assigned_to === userId
                    ? 'Assigned to you'
                    : todo.assigned_to === partnerId
                    ? `Assigned to ${partnerName || 'Partner'}`
                    : 'Click to assign'
                }
              >
                {todo.assigned_to === userId
                  ? 'Me'
                  : todo.assigned_to === partnerId
                  ? (partnerName?.[0] || 'P')
                  : '+'}
              </button>

              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-neutral-600 transition-colors hover:text-rose-500 ml-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddTodo} className="mt-1 flex items-center gap-2">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        />
        <button
          type="submit"
          disabled={!newTodo.trim()}
          className="flex flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800 px-3 py-2 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
