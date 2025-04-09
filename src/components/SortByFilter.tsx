// src/components/SortByFilter.tsx
'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

// Define sort options
const sortOptions = [
    { label: 'Order Added', value: 'default' }, // Represents default sort (sort_order/created_at)
    { label: 'Deadline', value: 'deadline_asc' },
    // Add more options here if needed later (e.g., Name A-Z)
    // { label: 'Name A-Z', value: 'name_asc' },
];

export default function SortByFilter() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Get current sort value from URL, default to 'default'
    const currentSortBy = searchParams.get('sortBy') || 'default';

    // Local state to manage the select value (optional but can improve UX)
    const [selectedValue, setSelectedValue] = useState(currentSortBy);

    // Sync local state if URL changes externally
    useEffect(() => {
        setSelectedValue(searchParams.get('sortBy') || 'default');
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSortValue = e.target.value;
        setSelectedValue(newSortValue); // Update local state immediately

        const params = new URLSearchParams(searchParams.toString());

        if (newSortValue === 'default') {
            params.delete('sortBy'); // Remove param if default
        } else {
            params.set('sortBy', newSortValue);
        }

        startTransition(() => {
             router.push(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    return (
        <div className="flex items-center">
             <label htmlFor="sort-by-select" className="text-sm text-gray-700 mr-2 whitespace-nowrap">
                Sort by:
            </label>
            <select
                id="sort-by-select"
                value={selectedValue}
                onChange={handleChange}
                disabled={isPending}
                className="block w-full pl-3 pr-8 py-1.5 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-70"
            >
                {sortOptions.map(option => (
                     <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
             {isPending && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
        </div>
    );
}