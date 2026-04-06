'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChildProfile {
  id: string
  name: string
}

interface UploadedPhoto {
  file: File
  preview: string
  uploading?: boolean
}

interface EntryFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function EntryForm({ onSuccess, onCancel }: EntryFormProps) {
  const [text, setText] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedChildren, setSelectedChildren] = useState<string[]>([])
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [childrenLoading, setChildrenLoading] = useState(true)
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
  const [photoUploadError, setPhotoUploadError] = useState('')
  
  const supabase = createClient()
  const charLimit = 3000
  const maxPhotoSize = 5 * 1024 * 1024 // 5MB
  const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp']

  // Fetch user's children
  useEffect(() => {
    const fetchChildren = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: err } = await supabase
        .from('childrenprofiles')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (err) {
        console.error('Failed to fetch children:', err)
      } else {
        setChildren(data || [])
      }
      setChildrenLoading(false)
    }

    fetchChildren()
  }, [])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setPhotoUploadError('')
    const newPhotos: UploadedPhoto[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      if (!allowedPhotoTypes.includes(file.type)) {
        setPhotoUploadError('Only JPEG, PNG, and WebP files are allowed')
        continue
      }

      // Validate file size
      if (file.size > maxPhotoSize) {
        setPhotoUploadError('Each photo must be under 5MB')
        continue
      }

      // Create preview
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          newPhotos.push({
            file,
            preview: event.target.result as string
          })
          setUploadedPhotos(prev => [...prev, newPhotos[newPhotos.length - 1]])
        }
      }
      reader.readAsDataURL(file)
    }

    // Reset file input
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const uploadPhotosToStorage = async (entryId: string, userId: string): Promise<string[]> => {
    // uploadedPhotos are in memory with previews. Need to upload to Supabase Storage
    // and get back the storage paths for entry_photos metadata insertion
    const storagePaths: string[] = []

    for (const photo of uploadedPhotos) {
      const fileExt = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
      const storagePath = `users/${userId}/entries/${entryId}/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('entries') // bucket name: entries
        .upload(storagePath, photo.file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Failed to upload photo ${photo.file.name}: ${uploadError.message}`)
      }

      storagePaths.push(storagePath)
    }

    return storagePaths
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

    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // Insert entry
      const { data: entryData, error: entryError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          text: text.trim(),
          entry_date: entryDate
        })
        .select()

      if (entryError) {
        setError(`Failed to create entry: ${entryError.message}`)
        setLoading(false)
        return
      }

      const entryId = entryData?.[0]?.id
      if (!entryId) {
        setError('Entry created but ID missing')
        setLoading(false)
        return
      }

      // Upload photos and store metadata
      if (uploadedPhotos.length > 0) {
        try {
          const storagePaths = await uploadPhotosToStorage(entryId, user.id)

          // Insert photo metadata
          const photoMetadata = storagePaths.map(path => ({
            entry_id: entryId,
            storage_path: path,
            original_filename: uploadedPhotos[storagePaths.indexOf(path)].file.name,
            file_size_bytes: uploadedPhotos[storagePaths.indexOf(path)].file.size
          }))

          const { error: photoError } = await supabase
            .from('entry_photos')
            .insert(photoMetadata)

          if (photoError) {
            // Note: photos are already in storage. Log but don't fail the entry.
            console.warn('Failed to insert photo metadata:', photoError)
          }
        } catch (photoUploadErr) {
          // Photos failed but entry exists. Log and continue.
          console.warn('Photo upload error:', photoUploadErr)
          setError(`Entry created but photo upload failed: ${String(photoUploadErr)}`)
        }
      }

      // Insert child tags if any selected
      if (selectedChildren.length > 0) {
        const childTagInserts = selectedChildren.map(childId => ({
          entry_id: entryId,
          child_id: childId
        }))

        const { error: childTagError } = await supabase
          .from('entry_children')
          .insert(childTagInserts)

        if (childTagError) {
          // Rollback: delete the entry if child insert fails
          await supabase
            .from('entries')
            .delete()
            .eq('id', entryId)

          setError(`Failed to tag children: ${childTagError.message}`)
          setLoading(false)
          return
        }
      }

      // Success
      setText('')
      setEntryDate(new Date().toISOString().split('T')[0])
      setSelectedChildren([])
      setUploadedPhotos([])
      onSuccess()
    } catch (err) {
      setError(`Unexpected error: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const toggleChild = (childId: string) => {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Text Input */}
      <div className="mb-6">
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
          What&apos;s on your mind?
        </label>
        <textarea
          id="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write your thoughts, moments, and experiences..."
          maxLength={charLimit}
          rows={6}
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

      {/* Photo Upload */}
      <div className="mb-6">
        <label htmlFor="photos" className="block text-sm font-medium text-gray-700 mb-2">
          Add photos (optional)
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

      {/* Photo Previews */}
      {uploadedPhotos.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Photos ({uploadedPhotos.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {uploadedPhotos.map((photo, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={photo.preview}
                  alt={`Preview ${idx + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
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
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors"
        >
          {loading ? 'Creating...' : 'Create Entry'}
        </button>
      </div>
    </form>
  )
}
