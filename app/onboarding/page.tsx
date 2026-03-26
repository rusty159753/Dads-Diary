'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Onboarding() {
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated. Please sign in again.')
      setLoading(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('users')
      .upsert({ id: user.id }, { onConflict: 'id' })

    if (upsertError) {
      setError('Account setup failed: ' + upsertError.message)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('childrenprofiles')
      .insert({
        user_id: user.id,
        name,
        birthdate: birthdate || null,
      })

    if (insertError) {
      setError(insertError.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-sm rounded-3xl p-8 max-w-md w-full border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">
          Welcome to Dad&apos;s Diary
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Add your first child to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Child&apos;s name
            </label>
            <input
              id="name"
              type="text"
              placeholder="First name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-gray-900"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="birthdate" className="block text-sm font-medium text-gray-700 mb-1">
              Date of birth (optional)
            </label>
            <input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all duration-300"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
