// src/app/page.tsx
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link';
import { redirect } from 'next/navigation'

import TagFilter from '@/components/TagFilter'; // Import the filter component
import { Task } from '@/types';
import SignOutButton from '@/components/SignOutButton';
import TaskListDnDContainer from '@/components/TaskListDnDContainer';

export const dynamic = 'force-dynamic';

interface TaskListPageProps {
  searchParams?: {
    tags?: string; // Comma-separated list of tags
    // Add other potential filters here later (e.g., status, search term)
  };
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

export default async function TaskListPage({ searchParams }: TaskListPageProps) {
  const cookieStore = cookies()
  const supabase = createClient()

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login')

  // --- Fetch Tags (keep existing logic) ---
  const { data: distinctTagsData, error: tagsError } = await supabase.rpc('get_distinct_tags_for_user');
  const allTags: string[] = distinctTagsData || [];

  // --- Fetch Tasks with Filtering AND Sorting ---
  const selectedTags = searchParams?.tags?.split(',').filter(Boolean) || [];

  let query = supabase
    .from('tasks')
    .select('*')
    // ***** Order by sort_order first, then created_at *****
    .order('sort_order', { ascending: true, nullsFirst: false }) // NULLS LAST (false means last for ASC)
    .order('created_at', { ascending: true });

  if (selectedTags.length > 0) {
    query = query.filter('tags', 'cs', `{${selectedTags.join(',')}}`);
  }

  const { data: tasks, error: tasksFetchError } = await query;

  if (tasksFetchError) { /* ... error handling ... */
       console.error('Error fetching tasks:', tasksFetchError);
       return <div className="p-4 text-red-600">Error loading tasks. Please try again later.</div>;
  }

  const typedTasks: Task[] = tasks as Task[] || [];

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header Section (keep as is) */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Tasks</h1>
             <div className="flex items-center gap-4">
                <Link href="/task/new" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Add New Task</Link>
                <SignOutButton />
             </div>
        </div>

         {/* Tag Filter (keep as is) */}
        <TagFilter allTags={allTags} />

        {/* Task List Table Area - Pass tasks to the DND Container */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Let the DND Container render the table */}
            <TaskListDnDContainer initialTasks={typedTasks} filterActive={selectedTags.length > 0}/>
        </div>
    </div>
  );
}