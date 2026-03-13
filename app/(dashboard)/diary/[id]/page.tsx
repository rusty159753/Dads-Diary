'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface Entry {
  id: string
  title: string
  body: string
  entry_date: string
  tags?: string[]
}

export default function EntryPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<Entry | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (params.id) fetchEntry()
  }, [params.id])

  const fetchEntry = async () => {
    const { data } = await supabase
      .from('entries')
      .select('*')
      .eq('id', params.id)
      .single()
    setEntry(data)
  }

  if (!entry) return <div>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 mr-4">
          ← Back to Diary
        </button>
      </div>

      <article className="bg-white rounded-2xl shadow-xl p-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{entry.title}</h1>
          <p className="text-2xl text-gray-500">
            {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
          </p>
        </header>
        
        <div className="prose prose-lg max-w-none">
          <p>{entry.body}</p>
        </div>
      </article>
    </div>
  )
}
