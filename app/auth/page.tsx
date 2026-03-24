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

    setLoading(false)
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setSuccess('Check your email for a password reset link.')
    }
    setLoading(false)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
        <div className="bg-slate-800 shadow-2xl rounded-3xl p-8 max-w-md w-full border border-slate-700">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Dad&apos;s Diary
          </h1>
          <p className="text-slate-400 text-center mb-8">Reset your password</p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-500/20 border border-green-500/50 text-green-300 rounded-xl text-sm">
                {success}
              </div>
            )}
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
              required
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setIsForgot(false); setError(''); setSuccess('') }}
            className="w-full text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors py-2 mt-4"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
      <div className="bg-slate-800 shadow-2xl rounded-3xl p-8 max-w-md w-full border border-slate-700">
        <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Dad&apos;s Diary
        </h1>
        <p className="text-slate-400 text-center mb-8">Capture moments that matter.</p>

        <div className="space-y-4">
          <button
            onClick={handleGoogle}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl"
            disabled={loading}
          >
            <span className="text-lg font-bold">G</span>
            Continue with Google
          </button>

          <div className="flex items-center py-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="px-4 text-xs text-slate-500 uppercase tracking-wider font-medium">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-500/20 border border-green-500/50 text-green-300 rounded-xl text-sm">
                {success}
              </div>
            )}

            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
              required
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
              required
              minLength={6}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => { setIsForgot(true); setError('') }}
              className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess('') }}
            className="w-full text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors py-2"
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
