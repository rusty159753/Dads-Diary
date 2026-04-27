import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Webhook handler uses the service role key to bypass RLS.
// This is correct - webhook events are server-to-server and trusted
// only after signature verification.
function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase service role configuration')
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// Grace period: 7 days after payment failure before account is archived
const GRACE_PERIOD_DAYS = 7

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header', code: 'missing_signature' },
      { status: 400 }
    )
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Webhook secret not configured', code: 'config_error' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook signature', code: 'invalid_signature' },
      { status: 400 }
    )
  }

  const supabase = getServiceRoleClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(supabase, invoice)
        break
      }

      default:
        // Unhandled event type - not an error, just ignore
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json(
      { error: 'Webhook handler failed', code: 'handler_error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const supabaseUserId = session.metadata?.supabase_user_id
  if (!supabaseUserId || !session.subscription) return

  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  )

  const priceId = stripeSubscription.items.data[0]?.price?.id ?? null
  const planType = stripeSubscription.items.data[0]?.price?.metadata?.plan_type ?? null

  await supabase
    .from('subscriptions')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: priceId,
      plan_type: planType,
      status: 'active',
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000
      ).toISOString(),
      grace_period_ends_at: null,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    })
    .eq('user_id', supabaseUserId)
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  stripeSubscription: Stripe.Subscription
) {
  const customerId = stripeSubscription.customer as string
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!sub) return

  const priceId = stripeSubscription.items.data[0]?.price?.id ?? null
  const planType = stripeSubscription.items.data[0]?.price?.metadata?.plan_type ?? null

  // Map Stripe status to our status
  let status: string
  switch (stripeSubscription.status) {
    case 'active':
      status = 'active'
      break
    case 'past_due':
      status = 'past_due'
      break
    case 'canceled':
      status = 'canceled'
      break
    case 'trialing':
      status = 'active' // Stripe-managed trial, treat as active
      break
    default:
      status = 'archived'
  }

  await supabase
    .from('subscriptions')
    .update({
      stripe_price_id: priceId,
      plan_type: planType,
      status,
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000
      ).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    })
    .eq('user_id', sub.user_id)
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  stripeSubscription: Stripe.Subscription
) {
  const customerId = stripeSubscription.customer as string
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!sub) return

  // Subscription deleted - mark canceled, access through current_period_end
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000
      ).toISOString(),
      cancel_at_period_end: true,
    })
    .eq('user_id', sub.user_id)
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!sub) return

  // Start the 7-day grace period
  const gracePeriodEndsAt = new Date()
  gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + GRACE_PERIOD_DAYS)

  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      grace_period_ends_at: gracePeriodEndsAt.toISOString(),
    })
    .eq('user_id', sub.user_id)
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, status')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!sub) return

  // Payment recovered - clear grace period, restore active status
  if (sub.status === 'past_due' || sub.status === 'archived') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        grace_period_ends_at: null,
      })
      .eq('user_id', sub.user_id)
  }
}
