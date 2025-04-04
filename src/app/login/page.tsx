// src/app/login/page.tsx
'use client' // This needs to be a client component for form handling

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client' // Use browser client

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false) // Toggle between Login and Sign Up
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null) // For success messages like "Check your email"
  const router = useRouter()
  const supabase = createClient()

  const handleAuthAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    try {
      let response;
      if (isSigningUp) {
        // --- Sign Up ---
        response = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Optional: Redirect URL after email confirmation
            // emailRedirectTo: `${location.origin}/auth/callback`,
          },
        })
        if (response.error) throw response.error
        if (response.data.user && response.data.user.identities?.length === 0) {
           setMessage('Signup successful, but email confirmation might be required (check Supabase settings). Redirecting...')
           // Or handle email verification flow more explicitly
        } else {
           setMessage('Sign up successful! Check your email for confirmation link if enabled.')
           // Don't redirect immediately on signup if email confirmation is needed
           // Optionally clear form or show message
           // For simplicity now, we might still redirect or let middleware handle it after confirmation
           setTimeout(() => router.push('/'), 1500); // Redirect after a delay
        }


      } else {
        // --- Sign In ---
        response = await supabase.auth.signInWithPassword({
          email,
          password,
        })
         if (response.error) throw response.error
         setMessage('Login successful! Redirecting...')
         // Force a page reload to ensure middleware runs and redirects correctly
         // router.push('/') doesn't always trigger middleware immediately in some scenarios
         router.refresh(); // This is often better after login/logout
      }


    } catch (err: any) {
      console.error('Authentication error:', err)
      setError(err.message || 'An unexpected error occurred.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isSigningUp ? 'Create Account' : 'Welcome Back'}
        </h1>
        <form onSubmit={handleAuthAction}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSigningUp ? 'new-password' : 'current-password'}
              required
              minLength={6} // Supabase default minimum
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          {error && <p className="mb-4 text-sm text-red-600 text-center">{error}</p>}
          {message && <p className="mb-4 text-sm text-green-600 text-center">{message}</p>}
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isSigningUp ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSigningUp(!isSigningUp)
              setError(null) // Clear error on toggle
              setMessage(null)
            }}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {isSigningUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  )
}