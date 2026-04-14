'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ChildProfile {
  id: string
  name: string
  birthdate: string | null
}

export default function Children() {
  const [children, setChildren] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchChildren = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error: fetchError } = await supabase
      .from('childrenprofiles')
      .select('id, name, birthdate')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setChildren(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchChildren()
  }, [])

  const resetForm = () => {
    setName('')
    setBirthdate('')
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const startEdit = (child: ChildProfile) => {
    setDeleteConfirm(null)
    setName(child.name)
    setBirthdate(child.birthdate || '')
    setEditingId(child.id)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setSaving(false)
      return
    }

    if (editingId) {
      const { error: updateError } = await supabase
        .from('childrenprofiles')
        .update({ name, birthdate: birthdate || null })
        .eq('id', editingId)
        .eq('user_id', user.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }
    } else {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ id: user.id }, { onConflict: 'id' })

      if (upsertError) {
        setError('Account setup failed: ' + upsertError.message)
        setSaving(false)
        return
      }

      const { error: insertError } = await supabase
        .from('childrenprofiles')
        .insert({ user_id: user.id, name, birthdate: birthdate || null })

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }
    }

    resetForm()
    await fetchChildren()
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated.')
      setSaving(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('childrenprofiles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setDeleteConfirm(null)
      resetForm()
      await fetchChildren()
      router.refresh()
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Children</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Dashboard
            </button>
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
              >
                Add child
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit child' : 'Add a child'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="childName" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="childName"
                  type="text"
                  placeholder="First name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-gray-900"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="childBirthdate" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of birth (optional)
                </label>
                <input
                  id="childBirthdate"
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
                  disabled={saving}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-6 rounded-xl font-semibold transition-all duration-300"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700 py-2 px-4 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {children.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No children added yet.</p>
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              Add your first child
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {children.map((child) => (
              <li key={child.id} className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {deleteConfirm === child.id ? (
                  <div className="bg-red-50 border-l-4 border-red-500 px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-red-700 font-semibold text-sm">Delete {child.name}?</p>
                      <p className="text-red-600 text-xs mt-0.5">This cannot be undone.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(child.id)}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                      >
                        {saving ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white px-5 py-4 flex items-center justify-between">
                    <div>
                      <span className="text-gray-900 font-medium">{child.name}</span>
                      {child.birthdate && (
                        <span className="text-gray-500 text-sm ml-3">{child.birthdate}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/children/${child.id}`)}
                        className="text-sm text-blue-600 hover:text-blue-700 px-3 py-1 transition-colors"
                      >
                        Releases
                      </button>
                      <button
                        onClick={() => startEdit(child)}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { resetForm(); setDeleteConfirm(child.id) }}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-1 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
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
