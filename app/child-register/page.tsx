'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ChildRegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get('code') || ''
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [codeInput, setCodeInput] = useState(code)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [codeValid, setCodeValid] = useState<boolean | null>(null)
  const [childName, setChildName] = useState('')
  const [error, setError] = useState('')
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // Validate code on load if present in URL
  useEffect(() => {
    if (code) validateCode(code)
  }, [code])

  const validateCode = async (c: string) => {
    setValidating(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('child_access_codes')
      .select('id, child_profile_id, used_at, expires_at, childrenprofiles(name)')
      .eq('code', c.toUpperCase().trim())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (fetchError || !data) {
      setCodeValid(false)
      setChildName('')
      setError('This invite link is invalid or has expired. Ask your dad to generate a new one.')
    } else {
      setCodeValid(true)
      // @ts-ignore - Supabase join typing
      setChildName(data.childrenprofiles?.name || '')
    }
    setValidating(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    // Re-validate code and get child profile details
    const { data: codeData, error: codeError } = await supabase
      .from('child_access_codes')
      .select('id, child_profile_id, dad_id, used_at, expires_at')
      .eq('code', codeInput.toUpperCase().trim())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (codeError || !codeData) {
      setError('Invite code is no longer valid. Ask your dad to generate a new one.')
      setLoading(false)
      return
    }

    // Create the child's Supabase auth account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists')) {
        setShowLoginPrompt(true)
        setError('An account with this email already exists.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    if (!authData.user) {
      setError('Failed to create account.')
      setLoading(false)
      return
    }

    const childUserId = authData.user.id

    // Link the new auth user to the child profile
    const { error: accountError } = await supabase
      .from('child_accounts')
      .insert({
        child_user_id: childUserId,
        child_profile_id: codeData.child_profile_id,
        dad_id: codeData.dad_id,
      })

    if (accountError) {
      if (accountError.message.includes('unique') || accountError.code === '23505') {
        setShowLoginPrompt(true)
        setError('This diary has already been claimed by another account. Log in with the account used to register originally.')
      } else {
        setError('Account created but linking failed. Contact support.')
      }
      setLoading(false)
      return
    }

    // Mark the access code as used
    await supabase
      .from('child_access_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', codeData.id)

    router.push('/child-diary')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h1>
      {childName && (
        <p className="text-gray-600 mb-6">
          You have been invited to read diary entries shared with <strong>{childName}</strong>.
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-4">
          {error}
          {showLoginPrompt && (
            <button
              onClick={() => router.push("/auth")}
              className="block mt-2 text-blue-600 hover:text-blue-700 font-medium underline"
            >
              Log in with existing account
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!code && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite code</label>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); setCodeValid(null) }}
              onBlur={() => codeInput && validateCode(codeInput)}
              placeholder="Enter your invite code"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono uppercase placeholder-gray-400 text-gray-900"
              disabled={loading}
            />
            {validating && <p className="text-xs text-gray-400 mt-1">Checking code...</p>}
            {codeValid === true && <p className="text-xs text-green-600 mt-1">Valid invite code.</p>}
            {codeValid === false && <p className="text-xs text-red-600 mt-1">Invalid or expired code.</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 text-gray-900"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || codeValid === false || (!code && !codeInput)}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-2xl font-semibold transition-colors"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

export default function ChildRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
          <ChildRegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
