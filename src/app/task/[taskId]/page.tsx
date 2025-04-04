// src/app/task/[taskId]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Task, Message } from '@/types'; // Import Message type
import ChatInterface from '@/components/ChatInterface'; // Import Chat Component
import TaskDetailHeader from '@/components/TaskDetailHeader'; // Extract header logic

export const dynamic = 'force-dynamic';

interface TaskDetailPageProps {
    params: { taskId: string };
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
    const cookieStore = cookies();
    const supabase = createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/login');
    }

    const taskId = parseInt(params.taskId, 10);
    if (isNaN(taskId)) {
        notFound();
    }

    // Fetch Task Data
    const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (taskError && taskError.code !== 'PGRST116') {
        console.error('Error fetching task details:', taskError);
        return <div className="p-4 text-red-600">Error loading task details.</div>;
    }
    if (!task) {
        notFound();
    }

    // Fetch Messages for the Task
    const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true }); // Get messages in chronological order

    if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        // Decide how to handle - show task without chat? Show error?
         return <div className="p-4 text-red-600">Error loading task messages.</div>;
    }

    const typedTask = task as Task;
    const typedMessages: Message[] = messages || [];

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Link href="/" className="mb-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                 {/* Back arrow svg */}
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /> </svg>
                Back to List
            </Link>

            <div className="bg-white shadow-md rounded-lg p-6">
                {/* Task Header & Details (Moved to component for cleaner code) */}
                <TaskDetailHeader task={typedTask} />

                {/* --- Chat Area --- */}
                <ChatInterface taskId={typedTask.id} initialMessages={typedMessages} />
                {/* --- End Chat Area --- */}
            </div>
        </div>
    );
}