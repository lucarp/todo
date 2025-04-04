// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  // Create a server supabase client with cookies from the request
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // @ts-expect-error - TODO: Remove this when type inference issue is resolved
          return cookieStore.getAll(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // @ts-expect-error - TODO: Remove this when type inference issue is resolved
            cookieStore.setAll({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.error('Cookie set error:', error)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            // @ts-expect-error - TODO: Remove this when type inference issue is resolved
            cookieStore.setAll({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.error('Cookie remove error:', error)
          }
        },
      },
    }
  )
}