import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ReactNode } from 'react'

interface Props {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) notFound()

  return (
    <div>
      <h1>Shared Diary Entry</h1>
      <p>Content for token: {token}</p>
    </div>
  )
}
