'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import EntryForm from '@/components/EntryForm'
import OnThisDay from '@/components/OnThisDay'

interface ChildProfile {
  id: string
  name: string
}

interface PhotoMetadata {
  id: string
  storage_path: string
}

interface EntryWithChildren {
  id: string
  text: string
  entry_date: string
  created_at: string
  children: ChildProfile[]
  photos: PhotoMetadata[]
}

export default function Entries() {
  const router = useRouter()
  const [entries, setEntries] = useState<EntryWithChildren[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const supabase = createClient()

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setAuthenticated(true)
    }
    checkAuth()
  }, [router])

  const fetchEntries = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      const user = session.user

      // Fetch entries with their tagged children
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('id, text, entry_date, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (entriesError) {
        setError(`Failed to load entries: ${entriesError.message}`)
        setLoading(false)
        return
      }

      // Batch fetch all child tags and photos in two queries instead of N+1 loops
      const entryIds = (entriesData || []).map(e => e.id)

      const [childTagResult, photoResult] = await Promise.all([
        entryIds.length > 0
          ? supabase
              .from('entry_children')
              .select('entry_id, childrenprofiles(id, name)')
              .in('entry_id', entryIds)
          : Promise.resolve({ data: [], error: null }),
        entryIds.length > 0
          ? supabase
              .from('entry_photos')
              .select('id, entry_id, storage_path')
              .in('entry_id', entryIds)
          : Promise.resolve({ data: [], error: null })
      ])

      if (childTagResult.error) {
        console.error('Failed to fetch child tags:', childTagResult.error)
      }
      if (photoResult.error) {
        console.error('Failed to fetch photos:', photoResult.error)
      }

      // Index by entry_id for O(1) lookup
      const childrenByEntry: Record<string, ChildProfile[]> = {}
      for (const tag of (childTagResult.data || [])) {
        const t = tag as { entry_id: string; childrenprofiles: ChildProfile[] }
        if (!childrenByEntry[t.entry_id]) childrenByEntry[t.entry_id] = []
        if (t.childrenprofiles) {
          const cp = Array.isArray(t.childrenprofiles) ? t.childrenprofiles : [t.childrenprofiles]
          childrenByEntry[t.entry_id].push(...cp)
        }
      }

      const photosByEntry: Record<string, PhotoMetadata[]> = {}
      for (const photo of (photoResult.data || [])) {
        const p = photo as { id: string; entry_id: string; storage_path: string }
        if (!photosByEntry[p.entry_id]) photosByEntry[p.entry_id] = []
        photosByEntry[p.entry_id].push({ id: p.id, storage_path: p.storage_path })
      }

      const entriesWithChildren: EntryWithChildren[] = (entriesData || []).map(entry => ({
        ...entry,
        children: childrenByEntry[entry.id] || [],
        photos: photosByEntry[entry.id] || []
      }))

      setEntries(entriesWithChildren)
    } catch (err) {
      setError(`Unexpected error: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchEntries()
    }
  }, [authenticated])

  const handleEntryCreated = () => {
    setShowForm(false)
    fetchEntries()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  if (!authenticated) {
    return null
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <OnThisDay />
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Entries</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-2xl font-semibold transition-all duration-300 shadow-sm hover:shadow-md"
          >
            {showForm ? 'Cancel' : 'New Entry'}
          </button>
        </div>

        {showForm && (
          <div className="mb-8">
            <EntryForm
              onSuccess={handleEntryCreated}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl mb-8">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 py-12">
            Loading entries...
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-gray-500 mb-4">No entries yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-2xl font-semibold transition-all duration-300"
            >
              Create your first entry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      {formatDate(entry.entry_date)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={`/entries/${entry.id}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                  >
                    View
                  </a>
                </div>

                <p className="text-gray-900 mb-3 leading-relaxed">
                  {truncateText(entry.text)}
                </p>

                {/* Photo count indicator */}
                {entry.photos.length > 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    📷 {entry.photos.length} photo{entry.photos.length !== 1 ? 's' : ''}
                  </p>
                )}

                {entry.children.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {entry.children.map((child) => (
                      <span
                        key={child.id}
                        className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-200"
                      >
                        {child.name}
                      </span>
                    ))}
                  </div>
                )}
                {entry.children.length === 0 && (
                  <p className="text-xs text-gray-400 italic">
                    Visible to all children
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
