'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SubscribePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-900 mb-2">
            Dad&apos;s Diary
          </h1>
          <p className="text-stone-500 text-sm">
            Your free trial has ended. Subscribe to keep writing.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-4">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-stone-900">$10</span>
            <span className="text-stone-500">/month</span>
          </div>
          <p className="text-xs text-stone-400 mb-6">
            Founders pricing - locked in for life
          </p>

          <ul className="space-y-2 mb-6">
            {[
              'Unlimited journal entries',
              'Photo attachments',
              'On This Day memories',
              'Release diary to your children',
              'Weekly reminders',
              'Data export',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-stone-700">
                <span className="text-green-500 font-bold">+</span>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Subscribe now'}
          </button>

          {error && (
            <p className="text-red-500 text-xs text-center mt-3">{error}</p>
          )}
        </div>

        <p className="text-center text-xs text-stone-400">
          Your entries and photos are safe.{' '}
          <button
            onClick={() => router.push('/entries')}
            className="underline hover:text-stone-600"
          >
            Read your diary
          </button>
        </p>
      </div>
    </div>
  )
}
