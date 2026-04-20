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

  const publicPaths = ['/auth', '/child-register']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (user) {
    const pathname = request.nextUrl.pathname

    // Dad-only routes - child accounts must not access these
    const dadOnlyPaths = ['/entries', '/children', '/settings', '/onboarding']
    const isDadOnly = dadOnlyPaths.some(p => pathname.startsWith(p))

    // Child-only routes - dad accounts should not land here
    const childOnlyPaths = ['/child-diary']
    const isChildOnly = childOnlyPaths.some(p => pathname.startsWith(p))

    if (isDadOnly || isChildOnly) {
      const { data: childAccount } = await supabase
        .from('child_accounts')
        .select('child_user_id')
        .eq('child_user_id', user.id)
        .maybeSingle()

      const isChild = !!childAccount

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
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
