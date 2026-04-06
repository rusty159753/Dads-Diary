'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import EntryForm from '@/components/EntryForm'

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

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

      // For each entry, fetch its tagged children and photos
      const entriesWithChildren: EntryWithChildren[] = []
      for (const entry of entriesData || []) {
        const { data: childTagData, error: childError } = await supabase
          .from('entry_children')
          .select('child_id, childrenprofiles(id, name)')
          .eq('entry_id', entry.id)

        const { data: photoData, error: photoError } = await supabase
          .from('entry_photos')
          .select('id, storage_path')
          .eq('entry_id', entry.id)

        if (childError) {
          console.error(`Failed to fetch children for entry ${entry.id}:`, childError)
        }

        if (photoError) {
          console.error(`Failed to fetch photos for entry ${entry.id}:`, photoError)
        }

        const children = (childTagData || [])
          .flatMap((tag: { child_id: string; childrenprofiles: ChildProfile[] }) => tag.childrenprofiles)

        const photos = (photoData || []) as PhotoMetadata[]
        
        entriesWithChildren.push({
          ...entry,
          children,
          photos
        })
      }

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
