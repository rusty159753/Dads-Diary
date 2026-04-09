'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

interface ReminderSettings {
  enabled: boolean
  frequency: Frequency
  preferred_time: string
  preferred_day: number
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Once a month' },
]

const DEFAULTS: ReminderSettings = {
  enabled: true,
  frequency: 'weekly',
  preferred_time: '09:00',
  preferred_day: 0,
}

export default function ReminderSettingsPage() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSettings({
          enabled: data.enabled,
          frequency: data.frequency,
          preferred_time: data.preferred_time.slice(0, 5),
          preferred_day: data.preferred_day ?? 0,
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { error: upsertError } = await supabase
      .from('reminder_settings')
      .upsert({
        user_id: user.id,
        enabled: settings.enabled,
        frequency: settings.frequency,
        preferred_time: settings.preferred_time + ':00',
        preferred_day: ['weekly', 'biweekly'].includes(settings.frequency)
          ? settings.preferred_day
          : null,
      }, { onConflict: 'user_id' })

    if (upsertError) {
      setError('Failed to save settings. Please try again.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const showDayPicker = settings.frequency === 'weekly' || settings.frequency === 'biweekly'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>

        <h1 className="mb-6 text-2xl font-bold text-gray-900">Reminder Settings</h1>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Writing reminders</p>
              <p className="text-sm text-gray-500">Get notified to write in your diary</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {settings.enabled && (
            <>
              {/* Frequency */}
              <div>
                <p className="mb-2 font-medium text-gray-900">Frequency</p>
                <div className="space-y-2">
                  {FREQUENCIES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSettings(s => ({ ...s, frequency: value }))}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        settings.frequency === value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred time */}
              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Preferred time
                </label>
                <input
                  type="time"
                  value={settings.preferred_time}
                  onChange={e => setSettings(s => ({ ...s, preferred_time: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Day picker - only for weekly and biweekly */}
              {showDayPicker && (
                <div>
                  <p className="mb-2 font-medium text-gray-900">Preferred day</p>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((day, index) => (
                      <button
                        key={day}
                        onClick={() => setSettings(s => ({ ...s, preferred_day: index }))}
                        className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                          settings.preferred_day === index
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.slice(0, 1)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {DAYS[settings.preferred_day]}
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save settings'}
          </button>

        </div>
      </div>
    </div>
  )
}
