// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Define public paths that should bypass the auth check
const publicPaths = ['/login', '/public/:path*']; // Add /public/ pattern

// Helper function to check if a pathname matches any public path pattern
function isPublicPath(pathname: string, paths: string[]): boolean {
    return paths.some((path) => {
        // Simple wildcard matching for now
        if (path.endsWith(':path*')) {
            const basePath = path.replace('/:path*', ''); // e.g., /public
            return pathname.startsWith(basePath + '/');
        }
        // Exact match
        return pathname === path;
    });
}


export async function middleware(request: NextRequest) {
  // Always update session if possible (harmless for public paths)
  let response = await updateSession(request)

  // Create client (needed for potential redirect IF user is logged in)
  const supabase = createServerClient( /* ... config ... */
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) { return request.cookies.get(name)?.value },
            set(name: string, value: string, options: CookieOptions) {
              request.cookies.set({ name, value, ...options })
              response = NextResponse.next({ request: { headers: request.headers } })
              response.cookies.set({ name, value, ...options })
            },
            remove(name: string, options: CookieOptions) {
              request.cookies.set({ name, value: '', ...options })
              response = NextResponse.next({ request: { headers: request.headers } })
              response.cookies.set({ name, value: '', ...options })
            },
          },
        }
    )


  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // --- Modified Redirect Logic ---

  // 1. Check if the current path is public
  const isPathPublic = isPublicPath(pathname, publicPaths);

  // 2. If user is NOT logged in AND the path is NOT public, redirect to login
  if (!user && !isPathPublic) {
    console.log(`Middleware: Unauthenticated user accessing protected path ${pathname}. Redirecting to /login.`);
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Optionally preserve the original path for redirect after login
    // url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url)
  }

  // 3. If user IS logged in AND they are trying to access login, redirect to dashboard
  // (Keep this logic)
  if (user && pathname === '/login') {
     console.log(`Middleware: Authenticated user accessing /login. Redirecting to /.`);
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 4. Allow access to all other cases:
  //    - Public paths (regardless of auth status)
  //    - Protected paths when user is authenticated
  console.log(`Middleware: Allowing access to ${pathname}. User authenticated: ${!!user}. Is public: ${isPathPublic}`);
  return response
}

// Keep the config.matcher as is, it defines which requests run the middleware *at all*
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}