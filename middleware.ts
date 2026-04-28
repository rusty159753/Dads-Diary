import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set(name, value)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set(name, value, options as Record<string, unknown> & { path: string })
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set(name, '')
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set(name, '', options as Record<string, unknown> & { path: string })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/auth', '/child-register', '/subscribe']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (user) {
    const pathname = request.nextUrl.pathname

    // Dad-only routes - child accounts must not access these
    const dadOnlyPaths = ['/entries', '/children', '/settings', '/onboarding', '/dashboard']
    const isDadOnly = dadOnlyPaths.some(p => pathname.startsWith(p))

    // Child-only routes - dad accounts should not land here
    const childOnlyPaths = ['/child-diary']
    const isChildOnly = childOnlyPaths.some(p => pathname.startsWith(p))

    // Determine if this user is a child account
    let isChild = false
    if (isDadOnly || isChildOnly) {
      const { data: childAccount } = await supabase
        .from('child_accounts')
        .select('child_user_id')
        .eq('child_user_id', user.id)
        .maybeSingle()

      isChild = !!childAccount

      if (isChild && isDadOnly) {
        const url = request.nextUrl.clone()
        url.pathname = '/child-diary'
        return NextResponse.redirect(url)
      }

      if (!isChild && isChildOnly) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Subscription check for dad accounts on dad-only routes
    // Skip for /settings/subscription so they can always manage billing
    if (isDadOnly && !isChild && !pathname.startsWith('/settings/subscription')) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (sub) {
        const now = new Date()
        let hasAccess = false
        let archived = false

        switch (sub.status) {
          case 'trialing':
            hasAccess = sub.trial_ends_at != null && new Date(sub.trial_ends_at) > now
            break
          case 'active':
            hasAccess = true
            break
          case 'past_due':
            hasAccess =
              sub.grace_period_ends_at != null &&
              new Date(sub.grace_period_ends_at) > now
            archived = !hasAccess
            break
          case 'canceled':
            hasAccess =
              sub.current_period_end != null &&
              new Date(sub.current_period_end) > now
            archived = !hasAccess
            break
          case 'archived':
            archived = true
            hasAccess = false
            break
        }

        if (archived) {
          // Archived accounts: allow reads, block write routes
          const writeRoutes = ['/onboarding']
          const isWriteRoute = writeRoutes.some(r => pathname.startsWith(r))
          const isEditRoute = /^\/entries\/[^/]+\/edit/.test(pathname)

          if (isWriteRoute || isEditRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/subscribe'
            return NextResponse.redirect(url)
          }

          // Allow reads - set cookie so UI can show resubscribe banner
          response.cookies.set('subscription_status', 'archived', {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
          })
        } else if (!hasAccess) {
          // Trial expired with no active subscription
          const url = request.nextUrl.clone()
          url.pathname = '/subscribe'
          return NextResponse.redirect(url)
        } else {
          // Active access - set status cookie for UI warning banners
          response.cookies.set('subscription_status', sub.status, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
          })
        }
      }
      // If no subscription row found, allow access.
      // The DB trigger creates rows for new signups; backfill covers existing users.
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
