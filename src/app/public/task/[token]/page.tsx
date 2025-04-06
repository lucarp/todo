// src/app/public/task/[token]/page.tsx
import { createClient as createSupabaseClient } from '@supabase/supabase-js'; // Import base client
import { cookies } from 'next/headers'; // Not needed here, remove if unused elsewhere
import { notFound } from 'next/navigation';
import { Task, Message } from '@/types';
import PublicReplyForm from '@/components/PublicReplyForm';

export const dynamic = 'force-dynamic';

interface PublicTaskPageProps {
  params: { token: string }
}

interface PublicTaskData { /* ... interface definition ... */
     task: Pick<Task, 'id' | 'name' | 'description'>;
    message: Pick<Message, 'id' | 'content' | 'created_at'>;
    tokenData: { id: number; target_email: string; };
}

async function getPublicTaskData(token: string): Promise<PublicTaskData | { error: string } | null> {
    // ***** Use Service Role Client for ALL reads in this function *****
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Public Page: Server environment variables for Supabase URL or Service Key are missing.");
        return { error: "Server configuration error. Cannot load task data." };
    }

    // Create the Service Role Client (bypasses RLS)
    const supabaseService = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    // ***** End Service Role Client Setup *****


    console.log(`Public Page: Validating token: ${token}`);

    // 1. Find the token using the SERVICE client
    const { data: tokenData, error: tokenFetchError } = await supabaseService // Use service client
        .from('task_access_tokens')
        .select('id, task_id, message_id, target_email, expires_at, used_at')
        .eq('token', token)
        .single();

    // ... logging and token validation checks (expiry, found) ...
    if (tokenFetchError) console.error("Public Page: Token Fetch Error:", tokenFetchError);
    console.log("Public Page: Fetched Token Data:", tokenData);
    if (tokenFetchError || !tokenData) { /* ... return null ... */ return null;}
    console.log("Public Page: Checking expiry...");
    if (new Date(tokenData.expires_at) < new Date()) { /* ... return error ... */ return { error: "This link has expired." }; }
    console.log("Public Page: Checking if used...");
    if (tokenData.used_at) { /* ... return error ... */ return { error: "This link has already been used to view the message." };}

    // Mark Token as Used using SERVICE client
    console.log("Public Page: Marking token as used...");
    const { error: updateError } = await supabaseService // Use service client
        .from('task_access_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

    if (updateError) { /* ... return error ... */
        console.error("Failed to mark token as used:", updateError);
        return { error: "An error occurred while accessing this link. Please try again later." };
    }

    // 2. Fetch Task Name/Description using SERVICE client
    console.log(`Public Page: Fetching task ID: ${tokenData.task_id}`);
    const { data: taskData, error: taskFetchError } = await supabaseService // Use service client
        .from('tasks')
        .select('id, name, description')
        .eq('id', tokenData.task_id)
        .single();

    if (taskFetchError) console.error("Public Page: Task Fetch Error:", taskFetchError);
    console.log("Public Page: Fetched Task Data:", taskData);
    if (taskFetchError || !taskData) {
         console.log("Public Page: Associated task not found.");
         return { error: "The associated task could not be found." };
    }

    // 3. Fetch the specific Message using SERVICE client
    console.log(`Public Page: Fetching message ID: ${tokenData.message_id}`);
    const { data: messageData, error: messageFetchError } = await supabaseService // Use service client
        .from('messages')
        .select('id, content, created_at')
        .eq('id', tokenData.message_id)
        .single();

    if (messageFetchError) console.error("Public Page: Message Fetch Error:", messageFetchError);
    console.log("Public Page: Fetched Message Data:", messageData);
     if (messageFetchError || !messageData) {
         console.log("Public Page: Associated message not found.");
         return { error: "The specific message could not be found." };
    }

    // Return combined data
    console.log("Public Page: Data fetched successfully.");
    return {
        task: taskData,
        message: messageData,
        tokenData: { id: tokenData.id, target_email: tokenData.target_email }
    };
}


// --- Main Page Component ---
export default async function PublicTaskPage({ params }: PublicTaskPageProps) {
  const token = params.token;
  const result = await getPublicTaskData(token);

  // ... rest of the component remains the same (error handling, rendering) ...
     // Handle Not Found or Error States
      if (!result) {
        notFound(); // Token doesn't exist
      }
      if ('error' in result) {
        // Display specific error message
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                 <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
                    <h1 className="text-xl font-semibold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-700">{result.error}</p>
                    <p className="text-sm text-gray-500 mt-4">If you believe this is an error, please contact the person who sent you the link.</p>
                 </div>
             </div>
        );
      }

      // If data is valid:
      const { task, message, tokenData } = result;

      return (
        <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
           {/* ... rest of JSX rendering ... */}
            <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
                 <div className="bg-indigo-600 p-4 sm:p-5"><h1 className="text-xl sm:text-2xl font-bold text-white break-words">Task: {task.name}</h1></div>
                 <div className="p-4 sm:p-6 space-y-6">
                    {task.description && ( <div> <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h2> <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p> </div> )}
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Message Shared With You:</h2>
                         <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                            <p className="text-gray-800">{message.content}</p>
                            <p className="text-xs text-gray-500 mt-2 text-right"> Received: {new Date(message.created_at).toLocaleString()} </p>
                         </div>
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Reply:</h2>
                        <PublicReplyForm token={token} />
                    </div>
                 </div>
                 <div className="bg-gray-50 px-4 py-3 sm:px-6 text-center text-xs text-gray-500"> This is a one-time secure link shared with {tokenData.target_email}. Replying will add your message to the original task discussion. </div>
            </div>
        </div>
      );
}