'use client'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) alert(error.message)
    else router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Join Dad's Diary</h1>
          <p className="text-gray-500 mt-2">Start preserving your memories today</p>
        </div>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          onClick={handleSignup}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-4 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-800 transition-all"
        >
          Create Account
        </button>
        <button
          onClick={() => router.push('/login')}
          className="w-full border border-indigo-600 text-indigo-600 p-4 rounded-xl font-semibold hover:bg-indigo-50 transition-all"
        >
          Have an account? Sign in
        </button>
      </div>
    </div>
  )
}
