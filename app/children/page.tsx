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
    setName(child.name)
    setBirthdate(child.birthdate || '')
    setEditingId(child.id)
    setShowForm(true)
    setDeleteConfirm(null)
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
      await fetchChildren()
      router.refresh()
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-900 to-slate-950">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Your Children</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
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
          <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              {editingId ? 'Edit child' : 'Add a child'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="childName" className="block text-sm font-medium text-slate-300 mb-1">
                  Name
                </label>
                <input
                  id="childName"
                  type="text"
                  placeholder="First name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="childBirthdate" className="block text-sm font-medium text-slate-300 mb-1">
                  Date of birth (optional)
                </label>
                <input
                  id="childBirthdate"
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-slate-100"
                  disabled={saving}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white py-2 px-6 rounded-xl font-semibold transition-all duration-300"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-200 py-2 px-4 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {children.length === 0 && !showForm ? (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No children added yet.</p>
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
              <li
                key={child.id}
                className="bg-slate-800/50 rounded-xl px-5 py-4 border border-slate-700/50 flex items-center justify-between"
              >
                <div>
                  <span className="text-slate-100 font-medium">{child.name}</span>
                  {child.birthdate && (
                    <span className="text-slate-500 text-sm ml-3">{child.birthdate}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(child)}
                    className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1 transition-colors"
                  >
                    Edit
                  </button>
                  {deleteConfirm === child.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-red-400">Delete?</span>
                      <button
                        onClick={() => handleDelete(child.id)}
                        disabled={saving}
                        className="text-sm text-red-400 hover:text-red-300 font-semibold px-2 py-1 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-sm text-slate-400 hover:text-slate-200 px-2 py-1 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(child.id)}
                      className="text-sm text-red-400/70 hover:text-red-400 px-3 py-1 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
