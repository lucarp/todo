// src/app/page.tsx
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import TagFilter from '@/components/TagFilter';
import DoneTaskFilter from '@/components/DoneTaskFilter';
import SortByFilter from '@/components/SortByFilter'; // Import SortByFilter
import { Task } from '@/types';
import SignOutButton from '@/components/SignOutButton';
import TaskListDnDContainer from '@/components/TaskListDnDContainer';

export const dynamic = 'force-dynamic';

interface TaskListPageProps {
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

/// ----- Inner Component for Data Fetching -----
async function FilteredTaskList({ searchParamsPromise }: { searchParamsPromise: TaskListPageProps['searchParams'] }) {
  const supabase = createClient();
  const resolvedSearchParams = await searchParamsPromise;

  // --- Read ALL parameters ---
  const tagsQueryParam = resolvedSearchParams?.tags;
  const selectedTags = typeof tagsQueryParam === 'string'
      ? tagsQueryParam.split(',').filter(Boolean) : [];
  const shouldHideDone = resolvedSearchParams?.hideDone === 'true';
  // Read sortBy parameter, default to 'default' (which means sort_order/created_at)
  const sortBy = typeof resolvedSearchParams?.sortBy === 'string'
      ? resolvedSearchParams.sortBy : 'default';

  // --- Fetch Tasks with Filtering & Sorting logic ---
  console.log('--- Fetching Filtered Task List ---');
  console.log('Using Tags:', selectedTags);
  console.log('Using Hide Done:', shouldHideDone);
  console.log('Using SortBy:', sortBy); // Log the sort parameter

  let query = supabase.from('tasks').select('*');

  // Apply Filters FIRST
  if (selectedTags.length > 0) {
    query = query.filter('tags', 'cs', `{${selectedTags.join(',')}}`);
  }
  if (shouldHideDone) {
      query = query.neq('status', 'Done');
  }

  // Apply Sorting LAST
  if (sortBy === 'deadline_asc') {
      // Sort by deadline (nulls last), then by the default sort order as fallback
      query = query.order('deadline', { ascending: true, nullsFirst: false });
      query = query.order('sort_order', { ascending: true, nullsFirst: false }); // Fallback sort
      query = query.order('created_at', { ascending: true }); // Secondary fallback sort

  }
  // Add more sort options here if needed
  // else if (sortBy === 'name_asc') {
  //    query = query.order('name', { ascending: true });
  //    query = query.order('sort_order', { ascending: true, nullsFirst: false }); // Fallback
  //    query = query.order('created_at', { ascending: true }); // Fallback
  // }
  else {
      // Default Sort Order (using sort_order from DnD, then created_at)
      query = query.order('sort_order', { ascending: true, nullsFirst: false });
      query = query.order('created_at', { ascending: true });
  }

  const { data: tasks, error: tasksFetchError } = await query;

  // ... error handling ...
  if (tasksFetchError) { /* ... */ return <div>Error...</div>; }
  const typedTasks: Task[] = tasks || [];

  return (
       <TaskListDnDContainer
          initialTasks={typedTasks}
          // Update filterActive logic if sortBy should also disable DND
          // For now, only tags/hideDone disable it
          filterActive={selectedTags.length > 0 || shouldHideDone}
      />
  );
}
// ----- End Inner Component -----


// ----- Main Page Component -----
export default async function TaskListPage({ searchParams }: TaskListPageProps) {
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession();
if (!session) redirect('/login')

const { data: distinctTagsData } = await supabase.rpc('get_distinct_tags_for_user');
const allTags: string[] = distinctTagsData || [];

// Generate key including sortBy
const resolvedSearchParamsForKey = await searchParams;
const filterKey = `tags=${resolvedSearchParamsForKey?.tags || ''}&hideDone=${resolvedSearchParamsForKey?.hideDone || 'false'}&sortBy=${resolvedSearchParamsForKey?.sortBy || 'default'}`; // Add sortBy to key


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

       {/* Filters Row - Adjusted Layout */}
       <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4 pb-4 border-b border-gray-200">
           {/* Tag Filter */}
           <div className="flex-grow order-1 md:order-1"> {/* Takes available space */}
               <TagFilter allTags={allTags} />
           </div>
           {/* Other Filters (Hide Done & Sort By) */}
           <div className="flex flex-col sm:flex-row gap-4 md:gap-6 order-2 md:order-2 flex-shrink-0"> {/* Group these */}
               <div className="pt-1"><DoneTaskFilter /></div>
                {/* ***** Render SortByFilter ***** */}
               <div className="pt-1"><SortByFilter /></div>
           </div>
       </div>


      {/* Task List Table Area */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
           <Suspense fallback={<div className="p-10 text-center text-gray-500">Loading tasks...</div>}>
               <FilteredTaskList key={filterKey} searchParamsPromise={searchParams} />
           </Suspense>
      </div>
  </div>
);
}