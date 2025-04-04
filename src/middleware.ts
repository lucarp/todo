// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
// We don't import createClient from here anymore
import { createServerClient, type CookieOptions } from '@supabase/ssr' // Import the core helper

export async function middleware(request: NextRequest) {
  // updateSession handles refreshing the session and setting up the initial response
  // It ensures cookies are handled correctly during the refresh process.
  let response = await updateSession(request)

  // Now, create a Supabase client instance *within* the middleware.
  // This instance will use the request cookies to determine auth state
  // and can use the response object to set cookies if needed (though updateSession does most of this).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Ensure cookies set by this client instance are added to the response
          // that updateSession prepared.
          request.cookies.set({ name, value, ...options }) // Reflect change in request cookies for subsequent operations
          response = NextResponse.next({ // Recreate response to apply cookie changes
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // Ensure cookies removed by this client instance are reflected in the response.
          request.cookies.set({ name, value: '', ...options }) // Reflect change in request cookies
          response = NextResponse.next({ // Recreate response to apply cookie changes
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Fetch the user data using the middleware-specific client
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // --- Redirect logic remains the same ---

  // If user is not logged in and trying to access protected routes
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user IS logged in and trying to access the login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Redirect to home/dashboard
    return NextResponse.redirect(url)
  }

  // Allow the request to proceed and return the response
  // (potentially modified by updateSession or the client instance above)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more exceptions.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}