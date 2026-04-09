'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Entry {
  id: string
  text: string
  entry_date: string
}

export default function OnThisDay() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchOnThisDay = async () => {
      const { data, error } = await supabase.rpc('get_on_this_day')
      if (!error && data) {
        setEntries(data)
      }
      setLoading(false)
    }
    fetchOnThisDay()
  }, [])

  if (loading || entries.length === 0) return null

  const today = new Date()
  const formatted = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-3 text-sm font-semibold text-amber-800">On This Day - {formatted}</p>
      <div className="space-y-3">
        {entries.map((entry) => {
          const year = new Date(entry.entry_date).getFullYear()
          const preview = entry.text.length > 120
            ? entry.text.slice(0, 120) + '…'
            : entry.text
          return (
            <a
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="block rounded-xl bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="mb-1 text-xs font-medium text-amber-600">{year}</p>
              <p className="text-sm text-gray-700 leading-relaxed">{preview}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}
