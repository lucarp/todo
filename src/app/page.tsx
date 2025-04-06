// src/app/page.tsx
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react'; // Import Suspense

import TagFilter from '@/components/TagFilter';
import DoneTaskFilter from '@/components/DoneTaskFilter';
import { Task } from '@/types';
import SignOutButton from '@/components/SignOutButton';
import TaskListDnDContainer from '@/components/TaskListDnDContainer';

export const dynamic = 'force-dynamic';

// Define Props using the Promise pattern for searchParams
interface TaskListPageProps {
  // No dynamic params for the root page
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// *** Ensure this function exists in Supabase SQL Editor ***
/*
   CREATE OR REPLACE FUNCTION get_distinct_tags_for_user()
   RETURNS TEXT[] AS $$
   SELECT array_agg(DISTINCT tag ORDER BY tag) -- Order tags alphabetically
   FROM (
       SELECT unnest(tags) as tag
       FROM tasks
       WHERE user_id = auth.uid() AND tags IS NOT NULL AND tags <> '{}'::text[]
   ) AS distinct_tags;
   $$ LANGUAGE sql SECURITY DEFINER;

   GRANT EXECUTE ON FUNCTION get_distinct_tags_for_user() TO authenticated;
*/

// ----- Inner Component for Data Fetching based on Search Params -----
// This component will receive the resolved searchParams or await the promise itself
async function FilteredTaskList({ searchParamsPromise }: { searchParamsPromise: TaskListPageProps['searchParams'] }) {
    const supabase = createClient(); // Get client instance here

    // ***** Await the searchParams Promise *****
    const resolvedSearchParams = await searchParamsPromise;

    // --- Read parameters correctly from the resolved object ---
    const tagsQueryParam = resolvedSearchParams?.tags;
    const selectedTags = typeof tagsQueryParam === 'string'
        ? tagsQueryParam.split(',').filter(Boolean)
        : [];
    const shouldHideDone = resolvedSearchParams?.hideDone === 'true';

    // --- Fetch Tasks with Filtering logic ---
    console.log('--- Fetching Filtered Task List ---');
    console.log('Using Tags:', selectedTags);
    console.log('Using Hide Done:', shouldHideDone);

    let query = supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (selectedTags.length > 0) {
      query = query.filter('tags', 'cs', `{${selectedTags.join(',')}}`);
    }
    if (shouldHideDone) {
        query = query.neq('status', 'Done');
    }

    const { data: tasks, error: tasksFetchError } = await query;

    if (tasksFetchError) {
        console.error('Error fetching tasks:', tasksFetchError);
        return <div className="p-4 text-red-600">Error loading tasks. Please try again later.</div>;
    }
    const typedTasks: Task[] = tasks || [];

    return (
         <TaskListDnDContainer
            initialTasks={typedTasks}
            // Determine if DND should be disabled based on resolved params
            filterActive={selectedTags.length > 0 || shouldHideDone}
        />
    );
}
// ----- End Inner Component -----


// ----- Main Page Component -----
export default async function TaskListPage({ searchParams }: TaskListPageProps) { // searchParams is now a Promise
  const supabase = createClient()

  // Perform checks/fetches independent of task filters first
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login')

  // --- Fetch Tags (independent of task filter) ---
  const { data: distinctTagsData } = await supabase.rpc('get_distinct_tags_for_user');
  const allTags: string[] = distinctTagsData || [];

  // ***** Generate a key based on the searchParams *Promise* reference (or resolve it first) *****
  // To ensure the key changes when the URL changes client-side, we need to resolve
  // the promise here too to get the *current* values for the key.
  const resolvedSearchParamsForKey = await searchParams;
  const filterKey = `tags=${resolvedSearchParamsForKey?.tags || ''}&hideDone=${resolvedSearchParamsForKey?.hideDone || 'false'}`;


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Tasks</h1>
             <div className="flex items-center gap-4">
                <Link href="/task/new" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Add New Task</Link>
                <SignOutButton />
             </div>
        </div>

         {/* Filters Row */}
         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4 pb-4 border-b border-gray-200">
             <div className="flex-grow"><TagFilter allTags={allTags} /></div>
             <div className="flex-shrink-0 pt-1"><DoneTaskFilter /></div>
         </div>

        {/* Task List Table Area */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
             {/* Use Suspense for the async component */}
             <Suspense fallback={<div className="p-10 text-center text-gray-500">Loading tasks...</div>}>
                 {/* Pass the searchParams *Promise* and the *key* */}
                 <FilteredTaskList key={filterKey} searchParamsPromise={searchParams} />
             </Suspense>
        </div>
    </div>
  );
}