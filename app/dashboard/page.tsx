import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: children } = await supabase
    .from('childrenprofiles')
    .select('id, name, birthdate')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!children || children.length === 0) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-100 mb-8">
          Your Dashboard
        </h1>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-200">Your Children</h2>
            
              <a href="/children"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Manage children
            </a>
          </div>
          <ul className="space-y-2">
            {children.map((child) => (
              <li key={child.id} className="text-slate-200 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 flex items-center justify-between">
                <span>{child.name}</span>
                {child.birthdate && (
                  <span className="text-slate-500 text-sm">{child.birthdate}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
