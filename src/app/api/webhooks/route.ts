import Stripe from 'stripe';
import { supabase } from '@/lib/supabase/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Stripe webhook events we care about for subscription management.
 */
const RELEVANT_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed',
]);

/**
 * Update or create a user's subscription in Supabase.
 * Called when Stripe sends subscription lifecycle events.
 */
async function upsertUserSubscription(
  customerId: string,
  subscriptionId: string
): Promise<void> {
  // Fetch the subscription from Stripe to get current state
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.warn(`No user_id in subscription metadata for ${subscriptionId}`);
    return;
  }

  // Extract relevant fields
  const status = subscription.status;
  const currentPeriodEnd = new Date(
    subscription.current_period_end * 1000
  ).toISOString();
  const currentPeriodStart = new Date(
    subscription.current_period_start * 1000
  ).toISOString();

  // Upsert into subscriptions table
  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  if (error) {
    throw new Error(
      `Failed to upsert subscription for user ${userId}: ${error.message}`
    );
  }
}

/**
 * Handle POST from Stripe webhook.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    console.error('Missing signature or webhook secret');
    return new Response('Webhook configuration error', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${message}`);
    return new Response(`Webhook error: ${message}`, { status: 400 });
  }

  // Only process relevant events
  if (!RELEVANT_EVENTS.has(event.type)) {
    return new Response('Event ignored', { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle subscription mode
        if (session.mode === 'subscription' && session.subscription) {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          await upsertUserSubscription(customerId, subscriptionId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        await upsertUserSubscription(customerId, subscription.id);
        break;
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Webhook processing failed: ${message}`);
    return new Response(`Processing error: ${message}`, { status: 500 });
  }
}
