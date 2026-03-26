import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: "Dad's Diary",
  description: 'Capture moments that matter.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {user && <Header userEmail={user.email ?? null} />}
        <main>{children}</main>
      </body>
    </html>
  )
}
