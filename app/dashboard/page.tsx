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
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Your Dashboard
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Entries section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Your Entries</h2>
              <a href="/entries"
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                View all
              </a>
            </div>
            <a href="/entries" className="block bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-300 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">+</div>
              <p className="text-gray-900 font-medium">Create a new entry</p>
              <p className="text-sm text-gray-500 mt-1">Capture your thoughts and moments</p>
            </a>
          </div>

          {/* Children section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700">Your Children</h2>
              <a href="/children"
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                Manage
              </a>
            </div>
            <ul className="space-y-2">
              {children.map((child) => (
                <li key={child.id} className="text-gray-900 bg-white rounded-xl px-4 py-3 border border-gray-200 flex items-center justify-between shadow-sm">
                  <span className="font-medium">{child.name}</span>
                  {child.birthdate && (
                    <span className="text-gray-500 text-sm">{child.birthdate}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
