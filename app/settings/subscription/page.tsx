'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { statusLabel } from '@/lib/subscription'
import type { SubscriptionData } from '@/lib/subscription'

export default function SubscriptionPage() {
  const router = useRouter()
  const [showSuccess, setShowSuccess] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Read success param without useSearchParams (avoids Suspense requirement)
    const params = new URLSearchParams(window.location.search)
    setShowSuccess(params.get('success') === 'true')
  }, [])

  useEffect(() => {
    async function fetchSubscription() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setSubscription({
          status: data.status,
          trialEndsAt: data.trial_ends_at,
          currentPeriodEnd: data.current_period_end,
          gracePeriodEndsAt: data.grace_period_ends_at,
          planType: data.plan_type,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
        })
      }

      setLoading(false)
    }

    fetchSubscription()
  }, [router])

  async function handlePortal() {
    setPortalLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPortalLoading(false)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-400 text-sm">Loading...</p>
      </div>
    )
  }

  const showSubscribeButton =
    !subscription?.stripeSubscriptionId ||
    subscription.status === 'archived' ||
    subscription.status === 'canceled'

  const nextBillingDate =
    subscription?.status === 'active' && !subscription.cancelAtPeriodEnd
      ? subscription.currentPeriodEnd
      : null

  const accessUntil =
    subscription?.cancelAtPeriodEnd || subscription?.status === 'canceled'
      ? subscription.currentPeriodEnd
      : null

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-sm mx-auto">
        <button
          onClick={() => router.push('/entries')}
          className="text-stone-400 text-sm mb-6 hover:text-stone-600"
        >
          Back to entries
        </button>

        <h1 className="text-xl font-bold text-stone-900 mb-6">Subscription</h1>

        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
            Subscription active. Welcome aboard.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-4 space-y-4">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Status</p>
            <p className="text-sm font-medium text-stone-900">
              {statusLabel(subscription)}
            </p>
          </div>

          {subscription?.planType && (
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Plan</p>
              <p className="text-sm font-medium text-stone-900 capitalize">
                {subscription.planType === 'grandfathered'
                  ? 'Founders - $10/month'
                  : 'Standard - $20/month'}
              </p>
            </div>
          )}

          {subscription?.status === 'trialing' && subscription.trialEndsAt && (
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Trial ends</p>
              <p className="text-sm font-medium text-stone-900">
                {formatDate(subscription.trialEndsAt)}
              </p>
            </div>
          )}

          {nextBillingDate && (
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">
                Next billing date
              </p>
              <p className="text-sm font-medium text-stone-900">
                {formatDate(nextBillingDate)}
              </p>
            </div>
          )}

          {accessUntil && (
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">
                Access until
              </p>
              <p className="text-sm font-medium text-stone-900">
                {formatDate(accessUntil)}
              </p>
            </div>
          )}

          {subscription?.status === 'past_due' && subscription.gracePeriodEndsAt && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              Payment failed. Grace period ends {formatDate(subscription.gracePeriodEndsAt)}. Update your payment method to avoid losing access.
            </div>
          )}
        </div>

        {showSubscribeButton ? (
          <button
            onClick={() => router.push('/subscribe')}
            className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium text-sm hover:bg-stone-700 transition-colors"
          >
            Subscribe
          </button>
        ) : (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="w-full border border-stone-300 text-stone-700 py-3 rounded-xl font-medium text-sm hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {portalLoading ? 'Loading...' : 'Manage billing'}
          </button>
        )}

        <p className="text-center text-xs text-stone-400 mt-4">
          Manage billing opens Stripe&apos;s secure portal to update payment, cancel, or view invoices.
        </p>
      </div>
    </div>
  )
}
