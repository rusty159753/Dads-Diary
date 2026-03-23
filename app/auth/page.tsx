'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: authError } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
    } else if (data.user) {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }
  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback` }
    })
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4">
      <div className="bg-slate-800/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 max-w-md w-full border border-slate-700/50">
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
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            </svg>
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
            
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
              required
              disabled={loading}
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 text-slate-100"
              required
              minLength={6}
              disabled={loading}
            />
            
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white py-3 px-6 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsSignup(!isSignup)}
            className="w-full text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors py-2"
          >
            {isSignup 
              ? "Already have an account? Sign In" 
              : "Need an account? Create one"
            }
          </button>
        </div>
      </div>
    </div>
  )
}
