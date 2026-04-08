'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface ChildProfile {
  id: string
  name: string
}

interface PhotoMetadata {
  id: string
  storage_path: string
}

interface EntryDetail {
  id: string
  text: string
  entry_date: string
  created_at: string
  updated_at: string
  children: ChildProfile[]
  photos: PhotoMetadata[]
}

export default function EntryDetail() {
  const router = useRouter()
  const params = useParams()
  const entryId = params.id as string

  const [entry, setEntry] = useState<EntryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoUrls, setPhotoUrls] = useState<{ [key: string]: string }>({})
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchEntry = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Fetch entry
      const { data: entryData, error: entryError } = await supabase
        .from('entries')
        .select('id, text, entry_date, created_at, updated_at')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (entryError || !entryData) {
        setError('Entry not found or access denied')
        setLoading(false)
        return
      }

      // Fetch tagged children
      const { data: childTagData, error: childError } = await supabase
        .from('entry_children')
        .select('child_id, childrenprofiles(id, name)')
        .eq('entry_id', entryId)

      // Fetch photos
      const { data: photoData, error: photoError } = await supabase
        .from('entry_photos')
        .select('id, storage_path')
        .eq('entry_id', entryId)

      const children = (childTagData || [])
        .flatMap((tag: { child_id: string; childrenprofiles: ChildProfile[] }) => tag.childrenprofiles)

      const photos = (photoData || []) as PhotoMetadata[]

      // Generate signed URLs for photos
      const urls: { [key: string]: string } = {}
      for (const photo of photos) {
        try {
          const { data, error: urlError } = await supabase.storage
            .from('entries')
            .createSignedUrl(photo.storage_path, 3600) // Valid for 1 hour

          if (!urlError && data) {
            urls[photo.id] = data.signedUrl
          }
        } catch (err) {
          console.error(`Failed to generate URL for photo ${photo.id}:`, err)
        }
      }

      setPhotoUrls(urls)
      setEntry({
        ...entryData,
        children,
        photos
      })
      setLoading(false)
    }

    fetchEntry()
  }, [entryId, router])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setDeleting(false)
        return
      }

      // Soft delete: set deleted_at timestamp
      const { error: deleteError } = await supabase
        .from('entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('user_id', user.id)

      if (deleteError) {
        setError(`Failed to delete entry: ${deleteError.message}`)
        setDeleting(false)
        return
      }

      // Redirect after successful delete
      router.push('/entries')
    } catch (err) {
      setError(`Unexpected error: ${String(err)}`)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-gray-500">Loading entry...</p>
        </div>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl">
            <p className="font-medium mb-4">{error || 'Entry not found'}</p>
            <Link
              href="/entries"
              className="text-red-600 hover:text-red-700 underline text-sm"
            >
              Back to entries
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/entries"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block transition-colors"
          >
            ← Back to entries
          </Link>
          
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            {/* Date and metadata */}
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-1">
                {formatDate(entry.entry_date)}
              </p>
              <p className="text-xs text-gray-400">
                Created {new Date(entry.created_at).toLocaleDateString()} at {formatTime(entry.created_at)}
              </p>
              {entry.updated_at !== entry.created_at && (
                <p className="text-xs text-gray-400">
                  Last edited {new Date(entry.updated_at).toLocaleDateString()} at {formatTime(entry.updated_at)}
                </p>
              )}
            </div>

            {/* Entry text */}
            <div className="mb-6 prose prose-sm max-w-none">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-base">
                {entry.text}
              </p>
            </div>

            {/* Photos */}
            {entry.photos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Photos ({entry.photos.length})
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {entry.photos.map(photo => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhotoId(photo.id)}
                      className="relative group rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {photoUrls[photo.id] ? (
                        <img
                          src={photoUrls[photo.id]}
                          alt="Entry photo"
                          className="w-full h-24 object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-400">
                          Loading...
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to view
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Photo Modal */}
            {selectedPhotoId && (
              <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Photo
                    </h3>
                    <button
                      onClick={() => setSelectedPhotoId(null)}
                      className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 rounded-lg min-h-96">
                    {photoUrls[selectedPhotoId] ? (
                      <img
                        src={photoUrls[selectedPhotoId]}
                        alt="Full size photo"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <p className="text-gray-500">Loading...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tagged children */}
            {entry.children.length > 0 && (
              <div className="mb-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Tagged children
                </p>
                <div className="flex gap-2 flex-wrap">
                  {entry.children.map(child => (
                    <span
                      key={child.id}
                      className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-200"
                    >
                      {child.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {entry.children.length === 0 && (
              <div className="pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-400 italic">
                  Visible to all children
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
          >
            Delete
          </button>
          <Link
            href={`/entries/${entry.id}/edit`}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            Edit
          </Link>
        </div>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete entry?</h3>
              <p className="text-gray-600 mb-6">
                This entry will be permanently deleted. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
