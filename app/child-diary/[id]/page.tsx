'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Entry {
  id: string
  text: string
  entry_date: string
  created_at: string
}

export default function ChildEntryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const entryId = params.id as string
  const supabase = createClient()

  const [entry, setEntry] = useState<Entry | null>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Confirm this is a child account
      const { data: accountData } = await supabase
        .from('child_accounts')
        .select('child_profile_id')
        .eq('child_user_id', user.id)
        .maybeSingle()

      if (!accountData) {
        router.push('/dashboard')
        return
      }

      // Load the entry - RLS ensures child can only read visible entries
      const { data: entryData, error: entryError } = await supabase
        .from('entries')
        .select('id, text, entry_date, created_at')
        .eq('id', entryId)
        .is('deleted_at', null)
        .maybeSingle()

      if (entryError || !entryData) {
        setError('Entry not found or not available.')
        setLoading(false)
        return
      }

      setEntry(entryData)

      // Load photos
      const { data: photosData } = await supabase
        .from('entry_photos')
        .select('storage_path')
        .eq('entry_id', entryId)

      const urls: string[] = []
      for (const photo of photosData || []) {
        const { data: urlData } = await supabase.storage
          .from('entries')
          .createSignedUrl(photo.storage_path, 3600)
        if (urlData?.signedUrl) urls.push(urlData.signedUrl)
      }
      setPhotoUrls(urls)
      setLoading(false)
    }
    load()
  }, [entryId, router])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/child-diary')}
            className="text-sm text-blue-600 hover:text-blue-800 mb-6 block"
          >
            ← Back to diary
          </button>
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error || 'Entry not found.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/child-diary')}
          className="text-sm text-blue-600 hover:text-blue-800 mb-6 block"
        >
          ← Back to diary
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-4">{formatDate(entry.entry_date)}</p>
          <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base">{entry.text}</p>

          {photoUrls.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {photoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Entry photo"
                  className="rounded-xl object-cover w-full max-w-sm"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
