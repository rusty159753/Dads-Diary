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
    <header className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <span className="text-blue-600 font-semibold text-sm">Dad&apos;s Diary</span>
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="text-gray-500 text-sm hidden sm:block">{userEmail}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  )
}
