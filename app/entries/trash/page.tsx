'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DeletedEntry {
  id: string
  text: string
  entry_date: string
  deleted_at: string
}

export default function TrashPage() {
  const router = useRouter()
  const supabase = createClient()

  const [entries, setEntries] = useState<DeletedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data, error: fetchError } = await supabase
        .from('entries')
        .select('id, text, entry_date, deleted_at')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (fetchError) {
        setError('Failed to load deleted entries.')
      } else {
        setEntries(data || [])
      }
      setLoading(false)
    }
    load()
  }, [router])

  const handleRestore = async (entryId: string) => {
    setRestoringId(entryId)
    const { error: restoreError } = await supabase
      .from('entries')
      .update({ deleted_at: null })
      .eq('id', entryId)

    if (restoreError) {
      setError('Failed to restore entry. Please try again.')
      setRestoringId(null)
      return
    }

    setEntries(prev => prev.filter(e => e.id !== entryId))
    setRestoringId(null)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    })

  const formatDeletedAt = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/entries')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to entries
          </button>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Deleted Entries</h1>
        <p className="text-sm text-gray-500 mb-6">Restore any entry to make it visible again.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">No deleted entries.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{formatDate(entry.entry_date)}</p>
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                      {entry.text || <span className="italic text-gray-400">No text</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Deleted {formatDeletedAt(entry.deleted_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(entry.id)}
                    disabled={restoringId === entry.id}
                    className="shrink-0 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-xl transition-colors"
                  >
                    {restoringId === entry.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
