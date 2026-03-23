'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  userEmail: string | null
}

export default function Header({ userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <header className="w-full bg-slate-900 border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
      <span className="text-blue-400 font-semibold text-sm">Dad&apos;s Diary</span>
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  )
}
