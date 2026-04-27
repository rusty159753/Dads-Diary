import { createClient } from '@/lib/supabase/server'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'archived'

export interface SubscriptionData {
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  gracePeriodEndsAt: string | null
  planType: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

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
    status: data.status as SubscriptionStatus,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    gracePeriodEndsAt: data.grace_period_ends_at,
    planType: data.plan_type,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  }
}

// Returns true if the user has full read and write access
export function hasFullAccess(sub: SubscriptionData | null): boolean {
  if (!sub) return false
  const now = new Date()

  switch (sub.status) {
    case 'trialing':
      return sub.trialEndsAt != null && new Date(sub.trialEndsAt) > now
    case 'active':
      return true
    case 'past_due':
      // 7-day grace period after payment failure
      return (
        sub.gracePeriodEndsAt != null &&
        new Date(sub.gracePeriodEndsAt) > now
      )
    case 'canceled':
      // Access through end of paid period
      return (
        sub.currentPeriodEnd != null &&
        new Date(sub.currentPeriodEnd) > now
      )
    case 'archived':
      return false
    default:
      return false
  }
}

// Returns true if the account is archived (read-only, no writes)
export function isArchived(sub: SubscriptionData | null): boolean {
  if (!sub) return false
  return sub.status === 'archived'
}

// Returns a human-readable label for the subscription status
export function statusLabel(sub: SubscriptionData | null): string {
  if (!sub) return 'No subscription'

  switch (sub.status) {
    case 'trialing': {
      if (!sub.trialEndsAt) return 'Trial'
      const days = Math.ceil(
        (new Date(sub.trialEndsAt).getTime() - Date.now()) / 86400000
      )
      return days > 0 ? `Trial - ${days} day${days === 1 ? '' : 's'} left` : 'Trial expired'
    }
    case 'active':
      return sub.cancelAtPeriodEnd ? 'Active (cancels at period end)' : 'Active'
    case 'past_due':
      return 'Payment failed - grace period active'
    case 'canceled':
      return 'Canceled'
    case 'archived':
      return 'Archived - read only'
    default:
      return 'Unknown'
  }
}
