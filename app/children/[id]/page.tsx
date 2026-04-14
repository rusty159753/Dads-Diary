'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ChildProfile {
  id: string
  name: string
  birthdate: string | null
}

interface Entry {
  id: string
  text: string
  entry_date: string
  created_at: string
}

export default function ChildProfilePage() {
  const router = useRouter()
  const params = useParams()
  const childId = params.id as string
  const supabase = createClient()

  const [child, setChild] = useState<ChildProfile | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Load child profile - confirms ownership via user_id
      const { data: childData, error: childError } = await supabase
        .from('childrenprofiles')
        .select('id, name, birthdate')
        .eq('id', childId)
        .eq('user_id', user.id)
        .single()

      if (childError || !childData) {
        router.push('/children')
        return
      }
      setChild(childData)

      // Load all dad's non-deleted entries
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('id, text, entry_date, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })

      if (entriesError) {
        setError('Failed to load entries.')
        setLoading(false)
        return
      }
      setEntries(entriesData || [])

      // Load already-released entry IDs for this child
      const { data: releasesData, error: releasesError } = await supabase
        .from('releases')
        .select('entry_id')
        .eq('child_id', childId)
        .eq('dad_id', user.id)

      if (!releasesError && releasesData) {
        setReleasedIds(new Set(releasesData.map(r => r.entry_id)))
      }

      setLoading(false)
    }
    load()
  }, [childId, router])

  const toggleEntry = (entryId: string) => {
    // Cannot deselect already-released entries - releases are permanent
    if (releasedIds.has(entryId)) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) { next.delete(entryId) } else { next.add(entryId) }
      return next
    })
  }

  const handleRelease = async () => {
    if (selectedIds.size === 0) return
    setReleasing(true)
    setError('')
    setSuccessMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated.'); setReleasing(false); return }

    const rows = Array.from(selectedIds).map(entryId => ({
      dad_id: user.id,
      child_id: childId,
      entry_id: entryId,
      is_test: false,
    }))

    const { error: releaseError } = await supabase
      .from('releases')
      .insert(rows)

    if (releaseError) {
      setError('Release failed: ' + releaseError.message)
      setReleasing(false)
      return
    }

    // Update local state
    setReleasedIds(prev => new Set([...prev, ...selectedIds]))
    setSelectedIds(new Set())
    setSuccessMessage(`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} released to ${child?.name}.`)
    setReleasing(false)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  const truncate = (text: string, maxLen = 80) =>
    text.length > maxLen ? text.slice(0, maxLen) + '...' : text

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!child) return null

  const newlySelected = selectedIds.size
  const totalReleased = releasedIds.size

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push('/children')}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors mb-1 block"
            >
              ← Children
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{child.name}</h1>
            {child.birthdate && (
              <p className="text-sm text-gray-500 mt-0.5">Born {formatDate(child.birthdate)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{totalReleased} released</p>
            {newlySelected > 0 && (
              <p className="text-sm text-blue-600 font-medium">{newlySelected} selected</p>
            )}
          </div>
        </div>

        {/* Errors and success */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm mb-4">
            {successMessage}
          </div>
        )}

        {/* Release button */}
        {newlySelected > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-sm text-blue-800">
              Release {newlySelected} {newlySelected === 1 ? 'entry' : 'entries'} to {child.name}?
              Once released, this cannot be undone.
            </p>
            <button
              onClick={handleRelease}
              disabled={releasing}
              className="ml-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              {releasing ? 'Releasing...' : 'Confirm release'}
            </button>
          </div>
        )}

        {/* Entry list */}
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No entries yet. Write some entries first.</p>
            <button
              onClick={() => router.push('/entries')}
              className="mt-4 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              Go to entries
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const isReleased = releasedIds.has(entry.id)
              const isSelected = selectedIds.has(entry.id)

              return (
                <li
                  key={entry.id}
                  onClick={() => toggleEntry(entry.id)}
                  className={`
                    rounded-xl border px-5 py-4 flex items-start gap-4 transition-colors
                    ${isReleased
                      ? 'bg-green-50 border-green-200 cursor-default'
                      : isSelected
                        ? 'bg-blue-50 border-blue-300 cursor-pointer'
                        : 'bg-white border-gray-200 cursor-pointer hover:border-blue-200'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <div className={`
                    mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${isReleased
                      ? 'bg-green-500 border-green-500'
                      : isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300'
                    }
                  `}>
                    {(isReleased || isSelected) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Entry content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 mb-0.5">{formatDate(entry.entry_date)}</p>
                    <p className="text-gray-900 text-sm leading-relaxed">{truncate(entry.text)}</p>
                    {isReleased && (
                      <p className="text-xs text-green-600 font-medium mt-1">Released</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
