'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import MediaUpload from '@/components/MediaUpload'

interface Entry {
  id: string
  title: string
  body: string
  entry_date: string
  tags?: string[]
}

export default function EntryPage() {
  const params = useParams() as { id: string }
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

  if (!entry) return <div className="p-12 text-center">Loading...</div>

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center mb-8">
        <button 
          onClick={() => router.back()} 
          className="text-gray-500 hover:text-gray-700 mr-4 text-lg font-medium"
        >
          ← Back to Diary
        </button>
      </div>

      {/* Entry Content */}
      <article className="bg-white rounded-2xl shadow-xl p-12 mb-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{entry.title}</h1>
          <p className="text-2xl text-gray-500">
            {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
          </p>
        </header>
        
        <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: entry.body.replace(/\n/g, '<br/>') }} />
        </div>
      </article>

      {/* Add More Media */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-12 border border-blue-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          📸 Photos & Memories
        </h2>
        <MediaUpload 
          entryId={entry.id} 
          onUpload={(url) => {
            console.log('New media:', url)
            // Refresh page to show new media
            window.location.reload()
          }}
        />
      </div>
    </div>
  )
}
