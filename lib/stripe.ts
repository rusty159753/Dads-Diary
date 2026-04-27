import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

// Stripe client for server-side use only
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Price IDs from environment variables
export const PRICE_IDS = {
  grandfathered: process.env.STRIPE_GRANDFATHERED_PRICE_ID!,
  standard: process.env.STRIPE_STANDARD_PRICE_ID!,
}
