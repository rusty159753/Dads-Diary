'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({ email, password })
        if (authError) {
          setError(authError.message)
        } else if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setSuccess('Account created. Check your email to confirm, then sign in.')
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) {
          setError(authError.message)
        } else if (data.user) {
          router.push('/dashboard')
          router.refresh()
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess('Check your email for a password reset link.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      }
    })
  }

  if (isForgot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white shadow-sm rounded-3xl p-8 max-w-md w-full border border-gray-200">
          <h1 className="text-4xl font-bold text-center text-blue-600 mb-2">
            Dad&apos;s Diary
          </h1>
          <p className="text-gray-500 text-center mb-8">Reset your password</p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
                {success}
              </div>
            )}
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-gray-900"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all duration-300"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setIsForgot(false); setError(''); setSuccess('') }}
            className="w-full text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors py-2 mt-4"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-sm rounded-3xl p-8 max-w-md w-full border border-gray-200">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-2">
          Dad&apos;s Diary
        </h1>
        <p className="text-gray-500 text-center mb-8">Capture moments that matter.</p>

        <div className="space-y-4">
          <button
            onClick={handleGoogle}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all duration-300 shadow-sm hover:shadow-md"
            disabled={loading}
          >
            <span className="text-lg font-bold">G</span>
            Continue with Google
          </button>

          <div className="flex items-center py-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="px-4 text-xs text-gray-400 uppercase tracking-wider font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
                {success}
              </div>
            )}

            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-gray-900"
              required
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-gray-900"
              required
              minLength={6}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => { setIsForgot(true); setError('') }}
              className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all duration-300"
            >
              {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess('') }}
            className="w-full text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors py-2"
          >
            {isSignup
              ? 'Already have an account? Sign In'
              : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  )
}
