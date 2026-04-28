// Server-only - do not import in client components
import { createClient } from '@/lib/supabase/server'
import type { SubscriptionData } from '@/lib/subscription'

export async function getSubscription(): Promise<SubscriptionData | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return null

  return {
    status: data.status,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    gracePeriodEndsAt: data.grace_period_ends_at,
    planType: data.plan_type,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  }
}
