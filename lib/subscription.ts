// Pure helper functions - no server imports, safe to use in client components

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
      return (
        sub.gracePeriodEndsAt != null &&
        new Date(sub.gracePeriodEndsAt) > now
      )
    case 'canceled':
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
