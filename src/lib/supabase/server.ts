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
        // Use the simpler .get() method provided by the cookieStore instance
        get(name: string) {
          // @ts-expect-error - TODO: Remove this when type inference issue is resolved
          return cookieStore.get(name)?.value
        },
        // Use the simpler .set() method
        set(name: string, value: string, options: CookieOptions) {
          try {
            // @ts-expect-error - TODO: Remove this when type inference issue is resolved
            cookieStore.set({ name, value, ...options }) // Use .set directly
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.error('Supabase server client cookie set error:', error)
          }
        },
        // Use the simpler .delete() or .set with empty value (delete is cleaner if available)
        remove(name: string, options: CookieOptions) {
          try {
            // Prefer .delete() if the CookieStore type supports it, otherwise use .set
            // Assuming .set({ name, value: '', ...options }) works based on previous context
            // @ts-expect-error - TODO: Remove this when type inference issue is resolved
             cookieStore.set({ name, value: '', ...options })
            // Or if delete exists: cookieStore.delete({ name, ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
             console.error('Supabase server client cookie remove error:', error)
          }
        },
      },
    }
  )
}