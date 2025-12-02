import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // SECURITY: Auth bypass ONLY allowed in development AND with explicit flag
  // This MUST NEVER be enabled in production environments
  const bypassAuth = process.env.BYPASS_AUTH === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (bypassAuth) {
    if (!isDevelopment) {
      // CRITICAL: Refuse to bypass auth in non-development environments
      console.error('SECURITY VIOLATION: BYPASS_AUTH=true in non-development environment. Ignoring.')
    } else {
      // Log warning even in development
      console.warn('[DEV ONLY] Authentication bypass is ACTIVE - do not use in production')

      // Landing page is always public
      if (request.nextUrl.pathname === '/') {
        return response
      }
      if (['/login', '/signup'].includes(request.nextUrl.pathname)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return response
    }
  }

  // Skip auth check if Supabase isn't configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Landing page is always public
    if (request.nextUrl.pathname === '/') {
      return response
    }
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    // Supabase connection failed - allow access to public pages
    console.warn('Supabase auth check failed:', error instanceof Error ? error.message : 'Unknown error')

    // For protected routes, redirect to login when auth is unavailable
    if (request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // For public pages (landing, login, signup), continue without auth
    return response
  }

  // Landing page - redirect logged-in users to dashboard
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Protected routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user && request.nextUrl.pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users from auth pages
  if (user && ['/login', '/signup'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}

