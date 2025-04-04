// src/app/public/task/[token]/page.tsx
import { createClient } from '@/lib/supabase/server' // Use server client for direct DB access
import { notFound } from 'next/navigation'
import { Task, Message } from '@/types'
import PublicReplyForm from '@/components/PublicReplyForm'; // Client component for the form

export const dynamic = 'force-dynamic'; // Ensure fresh check on each load

interface PublicTaskPageProps {
  params: { token: string }
}

// Data type combining necessary info
interface PublicTaskData {
    task: Pick<Task, 'id' | 'name' | 'description'>;
    message: Pick<Message, 'id' | 'content' | 'created_at'>;
    tokenData: { id: number; target_email: string; }; // Need token ID & email for reply
}

// Server function to validate token and fetch data
async function getPublicTaskData(token: string): Promise<PublicTaskData | { error: string } | null> {
    const supabase = createClient(); // Create server client instance

    // 1. Find the token, check expiry and used status
    const { data: tokenData, error: tokenFetchError } = await supabase
        .from('task_access_tokens')
        .select('id, task_id, message_id, target_email, expires_at, used_at')
        .eq('token', token)
        .single();

    if (tokenFetchError || !tokenData) {
        return null; // Not found
    }

    if (new Date(tokenData.expires_at) < new Date()) {
        return { error: "This link has expired." };
    }

    // --- Strict One-Time Use Logic ---
    // If the token has already been used, deny access
    if (tokenData.used_at) {
         return { error: "This link has already been used to view the message." };
    }

    // --- Mark Token as Used (CRITICAL STEP) ---
    // This should ideally be atomic, but a simple update after select is common
    const { error: updateError } = await supabase
        .from('task_access_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id); // Use the specific token ID

    if (updateError) {
         console.error("Failed to mark token as used:", updateError);
         // Decide how to handle - maybe still show data but log error? Or deny access?
         // Let's deny access if we can't mark it used, to be safe.
         return { error: "An error occurred while accessing this link. Please try again later." };
    }
    // --- End One-Time Use Logic ---


    // 2. Fetch Task Name/Description (using task_id from token)
    // Note: No RLS applies here as it's unauthenticated access
    const { data: taskData, error: taskFetchError } = await supabase
        .from('tasks')
        .select('id, name, description')
        .eq('id', tokenData.task_id)
        .single();

    if (taskFetchError || !taskData) {
         console.error(`Public view: Task not found for id ${tokenData.task_id}`, taskFetchError);
         return { error: "The associated task could not be found." }; // Task might have been deleted
    }

    // 3. Fetch the specific Message (using message_id from token)
    const { data: messageData, error: messageFetchError } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .eq('id', tokenData.message_id)
        .single();

     if (messageFetchError || !messageData) {
         console.error(`Public view: Message not found for id ${tokenData.message_id}`, messageFetchError);
         return { error: "The specific message could not be found." }; // Message might have been deleted
    }

    // Return combined data
    return {
        task: taskData,
        message: messageData,
        tokenData: { id: tokenData.id, target_email: tokenData.target_email }
    };
}


export default async function PublicTaskPage({ params }: PublicTaskPageProps) {
  const token = params.token;
  const result = await getPublicTaskData(token);

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
        <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
             {/* Header */}
            <div className="bg-indigo-600 p-4 sm:p-5">
                 <h1 className="text-xl sm:text-2xl font-bold text-white break-words">Task: {task.name}</h1>
             </div>

             <div className="p-4 sm:p-6 space-y-6">
                {/* Task Description (Optional) */}
                {task.description && (
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h2>
                        <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
                     </div>
                )}

                 {/* Shared Message */}
                 <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Message Shared With You:</h2>
                     <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        <p className="text-gray-800">{message.content}</p>
                        <p className="text-xs text-gray-500 mt-2 text-right">
                            Received: {new Date(message.created_at).toLocaleString()}
                        </p>
                     </div>
                </div>

                {/* Reply Form */}
                <div>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Your Reply:</h2>
                    <PublicReplyForm token={token} />
                </div>
             </div>

             {/* Footer Info */}
             <div className="bg-gray-50 px-4 py-3 sm:px-6 text-center text-xs text-gray-500">
                This is a one-time secure link shared with {tokenData.target_email}. Replying will add your message to the original task discussion.
            </div>
        </div>
    </div>
  );
}