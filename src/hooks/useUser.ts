// src/hooks/useUser.ts
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useUser() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true; // Prevent state update on unmounted component

        async function getUserData() {
            setLoading(true);
            const { data: { user: currentUser }, error } = await supabase.auth.getUser();

            if (isMounted) {
                if (error) {
                    console.error("Error fetching user in hook:", error);
                }
                setUser(currentUser ?? null);
                setLoading(false);
            }
        }

        getUserData();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (isMounted) {
                     setUser(session?.user ?? null);
                     setLoading(false); // Update loading state on auth change too
                }
            }
        );

        // Cleanup listener on unmount
        return () => {
            isMounted = false;
            authListener?.subscription?.unsubscribe();
        };
    }, [supabase]); // Re-run if supabase client instance changes (though unlikely)

    return { user, loading };
}