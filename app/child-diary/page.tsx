'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Entry {
  id: string
  text: string
  entry_date: string
  created_at: string
  photos: { storage_path: string }[]
}

export default function ChildDiaryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [childName, setChildName] = useState('')
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Confirm this is a child account and get their profile name
      const { data: accountData, error: accountError } = await supabase
        .from('child_accounts')
        .select('child_profile_id, childrenprofiles(name)')
        .eq('child_user_id', user.id)
        .maybeSingle()

      if (accountError || !accountData) {
        // Not a child account - send to dashboard
        router.push('/dashboard')
        return
      }

      // @ts-ignore - Supabase join typing
      setChildName(accountData.childrenprofiles?.name || '')

      // Load released non-deleted entries via RLS - policy handles scoping
      const { data: entriesData, error: entriesError } = await supabase
        .from('entries')
        .select('id, text, entry_date, created_at')
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })

      if (entriesError) {
        setError('Failed to load entries.')
        setLoading(false)
        return
      }

      const entryIds = (entriesData || []).map(e => e.id)

      // Load photos for all entries
      const { data: photosData } = entryIds.length > 0
        ? await supabase
            .from('entry_photos')
            .select('entry_id, storage_path')
            .in('entry_id', entryIds)
        : { data: [] }

      const entriesWithPhotos = (entriesData || []).map(entry => ({
        ...entry,
        photos: (photosData || []).filter(p => p.entry_id === entry.id),
      }))

      setEntries(entriesWithPhotos)

      // Generate signed URLs for photos
      const urls: Record<string, string> = {}
      for (const photo of photosData || []) {
        const { data: urlData } = await supabase.storage
          .from('entries')
          .createSignedUrl(photo.storage_path, 3600)
        if (urlData?.signedUrl) urls[photo.storage_path] = urlData.signedUrl
      }
      setPhotoUrls(urls)

      setLoading(false)
    }
    load()
  }, [router])

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading your diary...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {childName ? `${childName}'s Diary` : 'Your Diary'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Entries shared with you by your dad</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-4">{error}</div>
        )}

        {entries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-gray-500">No entries have been shared with you yet.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                onClick={() => router.push(`/child-diary/${entry.id}`)}
                className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
              >
                <p className="text-sm text-gray-500 mb-3">{formatDate(entry.entry_date)}</p>
                <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                {entry.photos.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.photos.map((photo) => (
                      photoUrls[photo.storage_path] && (
                        <img
                          key={photo.storage_path}
                          src={photoUrls[photo.storage_path]}
                          alt="Entry photo"
                          className="rounded-xl object-cover w-32 h-32"
                        />
                      )
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
