// src/components/DoneTaskFilter.tsx
'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react'; // For smoother navigation

export default function DoneTaskFilter() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const hideDone = searchParams.get('hideDone') === 'true';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        const params = new URLSearchParams(searchParams.toString());

        if (isChecked) {
            params.set('hideDone', 'true');
        } else {
            params.delete('hideDone');
        }

        // Use transition for smoother navigation without full page reload feel
        startTransition(() => {
             router.push(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    return (
        <div className="flex items-center mb-4">
            <input
                id="hide-done-checkbox"
                type="checkbox"
                checked={hideDone}
                onChange={handleChange}
                disabled={isPending} // Disable while transitioning
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2 disabled:opacity-70"
            />
            <label htmlFor="hide-done-checkbox" className="text-sm text-gray-700">
                Hide Completed Tasks
            </label>
             {isPending && <span className="text-xs text-gray-500 ml-2">(Updating...)</span>}
        </div>
    );
}