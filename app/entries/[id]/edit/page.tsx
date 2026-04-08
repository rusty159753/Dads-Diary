'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface ChildProfile {
  id: string
  name: string
}

interface EntryData {
  id: string
  text: string
  entry_date: string
}

interface PhotoMetadata {
  id: string
  storage_path: string
  original_filename: string
}

interface UploadedPhoto {
  file: File
  preview: string
}

export default function EditEntry() {
  const router = useRouter()
  const params = useParams()
  const entryId = params.id as string

  const [text, setText] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [childrenLoading, setChildrenLoading] = useState(true)
  const [existingPhotos, setExistingPhotos] = useState<PhotoMetadata[]>([])
  const [newPhotos, setNewPhotos] = useState<UploadedPhoto[]>([])
  const [photoUploadError, setPhotoUploadError] = useState('')
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<{ [key: string]: string }>({})

  const supabase = createClient()
  const charLimit = 3000

  // Fetch entry and children
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Fetch children first
      const { data: childrenData, error: childrenError } = await supabase
        .from('childrenprofiles')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (!childrenError && childrenData) {
        setChildren(childrenData)
      }
      setChildrenLoading(false)

      // Fetch entry
      const { data: entryData, error: entryError } = await supabase
        .from('entries')
        .select('id, text, entry_date')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single()

      if (entryError || !entryData) {
        setError('Entry not found or access denied')
        setLoading(false)
        return
      }

      setText(entryData.text)
      setEntryDate(entryData.entry_date)

      // Fetch tagged children for this entry
      const { data: taggedChildren } = await supabase
        .from('entry_children')
        .select('child_id')
        .eq('entry_id', entryId)

      if (taggedChildren) {
        setSelectedChildren(taggedChildren.map(t => t.child_id))
      }

      // Fetch existing photos
      const { data: photoData, error: photoError } = await supabase
        .from('entry_photos')
        .select('id, storage_path, original_filename')
        .eq('entry_id', entryId)

      if (!photoError && photoData) {
        setExistingPhotos(photoData)

        // Generate signed URLs for existing photos
        const urls: { [key: string]: string } = {}
        for (const photo of photoData) {
          try {
            const { data, error: urlError } = await supabase.storage
              .from('entries')
              .createSignedUrl(photo.storage_path, 3600)

            if (!urlError && data) {
              urls[photo.id] = data.signedUrl
            }
          } catch (err) {
            console.error(`Failed to generate URL for photo ${photo.id}:`, err)
          }
        }
        setExistingPhotoUrls(urls)
      }

      setLoading(false)
    }

    fetchData()
  }, [entryId, router])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setPhotoUploadError('')
    const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxPhotoSize = 5 * 1024 * 1024

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!allowedPhotoTypes.includes(file.type)) {
        setPhotoUploadError('Only JPEG, PNG, and WebP files are allowed')
        continue
      }

      if (file.size > maxPhotoSize) {
        setPhotoUploadError('Each photo must be under 5MB')
        continue
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result
        if (result) {
          setNewPhotos(prev => [...prev, {
            file,
            preview: result as string
          }])
        }
      }
      reader.readAsDataURL(file)
    }

    e.target.value = ''
  }

  const removeNewPhoto = (index: number) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExistingPhoto = async (photoId: string, storagePath: string) => {
    setDeletingPhotoId(photoId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setDeletingPhotoId(null)
        return
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('entries')
        .remove([storagePath])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
      }

      // Delete metadata record
      const { error: dbError } = await supabase
        .from('entry_photos')
        .delete()
        .eq('id', photoId)

      if (dbError) {
        setError(`Failed to delete photo: ${dbError.message}`)
      } else {
        setExistingPhotos(prev => prev.filter(p => p.id !== photoId))
      }
    } catch (err) {
      setError(`Unexpected error: ${String(err)}`)
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const uploadNewPhotos = async (userId: string): Promise<boolean> => {
    if (newPhotos.length === 0) return true

    for (const photo of newPhotos) {
      const fileExt = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      const storagePath = `users/${userId}/entries/${entryId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('entries')
        .upload(storagePath, photo.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        setError(`Failed to upload photo: ${uploadError.message}`)
        return false
      }

      // Insert metadata
      const { error: metadataError } = await supabase
        .from('entry_photos')
        .insert({
          entry_id: entryId,
          storage_path: storagePath,
          original_filename: photo.file.name,
          file_size_bytes: photo.file.size
        })

      if (metadataError) {
        setError(`Failed to save photo metadata: ${metadataError.message}`)
        return false
      }
    }

    return true
  }

  const toggleChild = (childId: string) => {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!text.trim()) {
      setError('Entry text cannot be empty')
      return
    }

    if (text.length > charLimit) {
      setError(`Entry exceeds ${charLimit} character limit`)
      return
    }

    // Validate date is not in the future
    const selectedDateTime = new Date(entryDate + 'T00:00:00').getTime()
    const todayDateTime = new Date().setHours(0, 0, 0, 0)
    if (selectedDateTime > todayDateTime) {
      setError('Entry date cannot be in the future')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setSaving(false)
        return
      }

      // Update entry
      const { error: updateError } = await supabase
        .from('entries')
        .update({
          text: text.trim(),
          entry_date: entryDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId)
        .eq('user_id', user.id)

      if (updateError) {
        setError(`Failed to update entry: ${updateError.message}`)
        setSaving(false)
        return
      }

      // Update child tags
      // First, delete existing tags
      const { error: deleteError } = await supabase
        .from('entry_children')
        .delete()
        .eq('entry_id', entryId)

      if (deleteError) {
        setError(`Failed to update tags: ${deleteError.message}`)
        setSaving(false)
        return
      }

      // Then, insert new tags if any
      if (selectedChildren.length > 0) {
        const childTagInserts = selectedChildren.map(childId => ({
          entry_id: entryId,
          child_id: childId
        }))

        const { error: insertError } = await supabase
          .from('entry_children')
          .insert(childTagInserts)

        if (insertError) {
          setError(`Failed to update tags: ${insertError.message}`)
          setSaving(false)
          return
        }
      }

      // Upload new photos
      const photosUploaded = await uploadNewPhotos(user.id)
      if (!photosUploaded) {
        setSaving(false)
        return
      }

      setSuccess('Entry updated successfully')
      setTimeout(() => {
        router.push(`/entries/${entryId}`)
      }, 1500)
    } catch (err) {
      setError(`Unexpected error: ${String(err)}`)
    } finally {
      setSaving(false)
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

  if (error && loading === false) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl">
            <p className="font-medium mb-4">{error}</p>
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
        <Link
          href={`/entries/${entryId}`}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-8 inline-block transition-colors"
        >
          ← Back to entry
        </Link>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Entry</h1>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl mb-6">
              {success}
            </div>
          )}

          {/* Text Input */}
          <div className="mb-6">
            <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
              Entry text
            </label>
            <textarea
              id="text"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={charLimit}
              rows={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <div className="text-xs text-gray-500 mt-2">
              {text.length} / {charLimit} characters
            </div>
          </div>

          {/* Date Input */}
          <div className="mb-6">
            <label htmlFor="entryDate" className="block text-sm font-medium text-gray-700 mb-2">
              Entry Date
            </label>
            <input
              id="entryDate"
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Existing Photos */}
          {existingPhotos.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current photos ({existingPhotos.length})
              </label>
              <div className="grid grid-cols-3 gap-3">
                {existingPhotos.map(photo => (
                  <div key={photo.id} className="relative group">
                    {existingPhotoUrls[photo.id] ? (
                      <img
                        src={existingPhotoUrls[photo.id]}
                        alt={photo.original_filename}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 text-center p-2">
                        Loading...
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                      {photo.original_filename}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingPhoto(photo.id, photo.storage_path)}
                      disabled={deletingPhotoId === photo.id}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Photo Upload */}
          <div className="mb-6">
            <label htmlFor="photos" className="block text-sm font-medium text-gray-700 mb-2">
              Add more photos (optional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
              <input
                id="photos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <label htmlFor="photos" className="cursor-pointer block">
                <p className="text-gray-600 font-medium">Click to select photos</p>
                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP up to 5MB each</p>
              </label>
            </div>
            {photoUploadError && (
              <p className="text-xs text-red-600 mt-2">{photoUploadError}</p>
            )}
          </div>

          {/* New Photo Previews */}
          {newPhotos.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                New photos ({newPhotos.length})
              </p>
              <div className="grid grid-cols-3 gap-3">
                {newPhotos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={photo.preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Child Tag Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag children (optional)
            </label>
            {childrenLoading ? (
              <p className="text-sm text-gray-500">Loading children...</p>
            ) : children.length === 0 ? (
              <p className="text-sm text-gray-500">No children created yet</p>
            ) : (
              <div className="space-y-2">
                {children.map(child => (
                  <label key={child.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedChildren.includes(child.id)}
                      onChange={() => toggleChild(child.id)}
                      className="w-4 h-4 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">{child.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedChildren.length === 0 && children.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                If no children are tagged, this entry will be visible to all children
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Link
              href={`/entries/${entryId}`}
              className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
