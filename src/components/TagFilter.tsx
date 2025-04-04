// src/components/TagFilter.tsx
'use client'

import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation'; // Import usePathname

interface TagFilterProps {
    allTags: string[];
}

export default function TagFilter({ allTags }: TagFilterProps) {
    const pathname = usePathname(); // Get the current base path (e.g., '/')
    const searchParams = useSearchParams();
    const currentTags = new Set(searchParams.get('tags')?.split(',') || []);

    // Function to create the href for tag links
    const createTagHref = (tag: string): string => {
        const newTags = new Set(currentTags); // Clone current tags
        if (newTags.has(tag)) {
            newTags.delete(tag); // Toggle off
        } else {
            newTags.add(tag); // Toggle on
        }

        // Create new search params object
        const params = new URLSearchParams(searchParams.toString());
        if (newTags.size > 0) {
            // Sort tags alphabetically for consistent URL
            params.set('tags', Array.from(newTags).sort().join(','));
        } else {
            params.delete('tags'); // Remove 'tags' param if empty
        }
        // Keep other existing search params intact
        return `${pathname}?${params.toString()}`; // Combine pathname and new params
    };

    // Href for clearing all tag filters
     const clearFilterHref = (): string => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('tags');
        return `${pathname}?${params.toString()}`;
     }

    // Don't render the filter section if there are no tags at all for the user
    if (allTags.length === 0) {
        return null;
    }

    return (
        <div className="mb-4 pb-4 border-b border-gray-200 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600 mr-2 flex-shrink-0">Filter by Tag:</span>
            {allTags.map((tag) => {
                const isActive = currentTags.has(tag);
                return (
                    <Link
                        key={tag}
                        href={createTagHref(tag)}
                        scroll={false} // Prevent page scroll on navigation
                        className={`inline-block px-3 py-1 text-xs font-medium rounded-full cursor-pointer transition-colors duration-150 ease-in-out whitespace-nowrap
                            ${isActive
                                ? 'bg-indigo-600 text-white ring-2 ring-offset-1 ring-indigo-400 hover:bg-indigo-700' // Active style
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300' // Inactive style
                            }`}
                    >
                        {tag}
                    </Link>
                );
            })}
            {/* Show Clear button only if any tags are currently selected */}
            {currentTags.size > 0 && (
                 <Link
                    href={clearFilterHref()}
                    scroll={false}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2 flex-shrink-0"
                    title="Clear tag filter"
                >
                   (Clear Filter)
                </Link>
            )}
        </div>
    );
}