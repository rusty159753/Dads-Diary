import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS } from '@/lib/stripe'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
  }

  // Get existing subscription row to check for Stripe customer ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  // Don't allow checkout if already active
  if (subscription?.status === 'active') {
    return NextResponse.json(
      { error: 'Already subscribed', code: 'already_subscribed' },
      { status: 400 }
    )
  }

  // Resolve or create Stripe customer
  let stripeCustomerId = subscription?.stripe_customer_id ?? null

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    stripeCustomerId = customer.id

    // Store customer ID on the subscription row using service role
    // We use the anon client here - the update will be blocked by RLS.
    // We rely on the webhook completing the link after checkout.
    // Store it now as an optimistic update if the user row allows it.
    // (Webhook will overwrite anyway.)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dads-diary-m0.vercel.app'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : user.email,
    mode: 'subscription',
    line_items: [
      {
        // Default to grandfathered price for all beta users
        price: PRICE_IDS.grandfathered,
        quantity: 1,
      },
    ],
    metadata: {
      supabase_user_id: user.id,
    },
    success_url: `${appUrl}/settings/subscription?success=true`,
    cancel_url: `${appUrl}/subscribe`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
