// src/app/actions.ts
'use server'

// Import the base client creator
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
// Keep the import for the cookie-based client for other actions
import { createClient as createServerClientCookie } from '@/lib/supabase/server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { TaskStatus, Task, Message } from '@/types'
import { v4 as uuidv4 } from 'uuid';
import { sendTaskShareEmail } from '@/lib/email';

function parseStringToArray(input: string | null | undefined): string[] | null {
    if (!input?.trim()) {
        return null;
    }
    // Split, trim, filter empty, ensure unique
    const array = input.split(',')
                       .map(item => item.trim())
                       .filter(item => item !== '');
    return Array.from(new Set(array)); // Use Set for uniqueness
}

// Helper to parse tags from a comma-separated string
function parseTags(tagsString: string | null | undefined): string[] | null {
    if (!tagsString?.trim()) {
        return null;
    }
    return tagsString.split(',')
                     .map(tag => tag.trim())
                     .filter(tag => tag !== '') // Remove empty tags
                     .filter((tag, index, self) => self.indexOf(tag) === index); // Make unique
}

const emailPrefixRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s+/;


export async function addTask(formData: FormData) {
    const supabase = createServerClientCookie()
  
    const { data: { user }, error: authError } = await supabase.auth.getUser()
  
    if (authError || !user) {
      console.error('Auth error in addTask:', authError)
      redirect('/login')
    }
  
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const deadline = formData.get('deadline') as string | null // Should be YYYY-MM-DD format
    const colorTag = formData.get('color_tag') as string | null
    const tagsInput = formData.get('tags') as string | null
    const initialStatus: TaskStatus = 'To do'; // New tasks always start as 'To do'
  
    // Basic validation
    if (!name || name.trim() === '') {
      // Consider returning an error message instead of just logging
      console.error('Task name is required')
      return { error: 'Task name is required' }
    }
  
    const tags = parseTags(tagsInput);
  
    // The database trigger will handle adding the 'To do' tag automatically.
    // No need to manually add initialStatus to the tags array here if trigger exists.
  
    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        deadline: deadline || null,
        color_tag: colorTag || null,
        tags: tags, // Pass the parsed tags
        status: initialStatus,
        // 'completed' field might become redundant. Decide if you want to keep it synced with status='Done'.
        // For simplicity, let's update it along with status later if needed, or remove it.
        completed: false // Set initial completed state
      })
  
    if (error) {
      console.error('Error inserting task:', error)
      return { error: `Database error: ${error.message}` }
    }
  
    // Revalidate the task list page cache
    revalidatePath('/', 'page') // Use 'page' for App Router path revalidation
  
    // Redirect back to the list after successful insertion
    redirect('/')
  }
  

export async function addChatMessage(taskId: number, content: string) {
    const supabase = createServerClientCookie() // Use server client

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('Auth error in addChatMessage');
        return { error: 'Authentication required' };
    }

    let messageToSend = content.trim();
    let targetEmail: string | null = null;
    let generatedToken: string | null = null; // To store the generated token
    let publicLink: string | null = null; // To store the full link

    // Check for email prefix
    const emailMatch = messageToSend.match(emailPrefixRegex);
    if (emailMatch) {
        targetEmail = emailMatch[0].trim();
        messageToSend = messageToSend.replace(emailPrefixRegex, '').trim();
    }

    if (!messageToSend) {
        return { error: "Message content cannot be empty." };
    }

    // 1. Insert the message FIRST to get its ID
    const { data: newMessageData, error: insertMsgError } = await supabase
        .from('messages')
        .insert({
            task_id: taskId,
            user_id: user.id,
            sender_email: targetEmail, // Store target email even if not sending link, could be useful
            content: messageToSend,
            is_external: false,
        })
        .select()
        .single();

    if (insertMsgError) {
        console.error('Error inserting message:', insertMsgError);
        return { error: `Database error: ${insertMsgError.message}` };
    }

    const insertedMessage = newMessageData as Message;

    // 2. If email prefix was present, generate token and attempt email sending
    if (targetEmail) {
        try {
            generatedToken = uuidv4(); // Generate a unique token
            const expiryDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            const expiresAt = new Date(Date.now() + expiryDurationMs).toISOString();

            // Insert token details into the database
            const { error: tokenInsertError } = await supabase
                .from('task_access_tokens')
                .insert({
                    token: generatedToken,
                    task_id: taskId,
                    message_id: insertedMessage.id, // Link to the message just created
                    target_email: targetEmail,
                    created_by_user_id: user.id,
                    expires_at: expiresAt,
                });

            if (tokenInsertError) {
                console.error("Error inserting access token:", tokenInsertError);
                // Proceed without link/email? Or return error? For now, log and continue.
                // Maybe return a partial success message?
                generatedToken = null; // Ensure token isn't returned if DB insert failed
            } else {
                // Construct the public link (replace with your actual domain)
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'; // Get base URL from env
                publicLink = `${baseUrl}/public/task/${generatedToken}`;

                // Fetch task name for the email subject/body
                const { data: taskData, error: taskFetchError } = await supabase
                    .from('tasks')
                    .select('name')
                    .eq('id', taskId)
                    .single();

                if (taskFetchError || !taskData) {
                     console.error("Error fetching task name for email:", taskFetchError);
                     // Proceed without email?
                } else {
                     // Attempt to send the email
                    await sendTaskShareEmail({
                        to: targetEmail,
                        taskName: taskData.name,
                        messageContent: messageToSend,
                        publicLink: publicLink,
                        senderName: user.email || 'A user', // Use sender's email or a default
                    });
                    console.log(`Email potentially sent to ${targetEmail} with link: ${publicLink}`);
                }
            }
        } catch (err) {
             console.error("Error during token generation or email sending:", err);
             // Ensure token/link aren't returned on error
             generatedToken = null;
             publicLink = null;
        }
    }

    // Revalidate the task detail page
    revalidatePath(`/task/${taskId}`, 'page');

    // Return success, the new message, and the generated token/link if applicable
    return {
        success: true,
        newMessage: insertedMessage,
        publicToken: generatedToken, // Send back only the token
    };
}

// --- Action for Public Reply (Modified) ---
export async function addPublicReply(token: string, replyContent: string) {

    replyContent = replyContent.trim();
    if (!replyContent) {
         return { error: "Reply cannot be empty." };
    }

    // --- Use Service Role Client ---
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) { /* ... error handling ... */
         console.error("Server environment variables for Supabase URL or Service Key are missing.");
        return { error: "Server configuration error." };
    }
    const supabaseService = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    // --- End Service Role Client ---


     // 1. Validate the token (still needed to find the task_id etc.)
    const { data: tokenData, error: tokenFetchError } = await supabaseService
        .from('task_access_tokens')
        .select('id, task_id, target_email, expires_at, used_at')
        .eq('token', token)
        .single();

    // Perform validation checks (exist, expiry) - No need to check used_at here for replying
    if (tokenFetchError || !tokenData) {
        console.error(`Invalid or non-existent token attempted for reply: ${token}`, tokenFetchError);
         // Don't expose detailed errors, just indicate failure
        return { error: "Failed to send reply. Invalid link." };
    }
    if (new Date(tokenData.expires_at) < new Date()) {
        return { error: "Failed to send reply. Link has expired." };
    }

    // 2. Insert the reply message using the SERVICE client
    const { error: insertReplyError } = await supabaseService
        .from('messages')
        .insert({ /* ... message details ... */
            task_id: tokenData.task_id,
            user_id: null,
            sender_email: tokenData.target_email,
            content: replyContent,
            is_external: true,
        });

    if (insertReplyError) {
        console.error("Error inserting public reply:", insertReplyError);
        return { error: "Failed to save reply. Please try again later." };
    }

    // 3. Revalidate the original task detail page cache
    revalidatePath(`/task/${tokenData.task_id}`, 'page');

    console.log(`Public reply added successfully for token: ${token}`);

    // ***** 4. Redirect to success page *****
    redirect('/public/task/reply-success'); // Redirect on success
    // We no longer return { success: true } because redirect() stops execution
}

// ***** Add export here *****
export async function updateTaskStatus(taskId: number, newStatus: TaskStatus) {
    'use server' // Redundant if already at top level, but doesn't hurt

    const supabase = createServerClientCookie()

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('Auth error in updateTaskStatus');
        return { error: 'Authentication required' };
    }

    const isCompleted = newStatus === 'Done';

    const { error } = await supabase
        .from('tasks')
        .update({
            status: newStatus,
            completed: isCompleted
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating task status:', error);
        return { error: `Database error: ${error.message}` };
    }

    revalidatePath('/', 'page');
    revalidatePath(`/task/${taskId}`, 'page');

    return { success: true };
}


// ***** Add export here *****
export async function updateTaskDetails(taskId: number, formData: FormData) {
    // ... implementation as provided before ...
       const supabase = createServerClientCookie()
 
       const { data: { user }, error: authError } = await supabase.auth.getUser();
       if (authError || !user) {
           console.error('Auth error in updateTaskDetails');
           return { error: 'Authentication required' };
       }
 
       const name = formData.get('name') as string | null;
       const description = formData.get('description') as string | null;
       const deadline = formData.get('deadline') as string | null;
       const colorTag = formData.get('color_tag') as string | null;
       const tagsInput = formData.get('tags') as string | null;
       const participantsInput = formData.get('participants') as string | null;
 
       if (!name || name.trim() === '') {
           return { error: 'Task name cannot be empty.' };
       }
 
       const updatePayload: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'status' | 'completed'>> = {
           name: name.trim(),
           description: description?.trim() || null,
           deadline: deadline && deadline.trim() !== '' ? deadline.trim() : null,
           color_tag: colorTag === '' ? null : colorTag,
           tags: parseStringToArray(tagsInput),
           participants: parseStringToArray(participantsInput),
       };
 
        // Fetch current task to preserve status tag (handled by trigger, but good practice)
        const { data: currentTask, error: fetchError } = await supabase
            .from('tasks')
            .select('status, tags')
            .eq('id', taskId)
            .eq('user_id', user.id)
            .single();
 
         if (fetchError || !currentTask) {
             console.error('Error fetching current task status for tag merge:', fetchError);
             return { error: 'Failed to read current task status before update.' };
        }
 
        // Filter out status tags from user input before update
        let finalTags = updatePayload.tags || [];
        finalTags = finalTags.filter(tag => !['To do', 'In Progress', 'Done'].includes(tag));
        updatePayload.tags = finalTags.length > 0 ? finalTags : null;
 
 
       const { error } = await supabase
           .from('tasks')
           .update(updatePayload)
           .eq('id', taskId)
           .eq('user_id', user.id);
 
       if (error) {
           console.error('Error updating task details:', error);
           return { error: `Database error: ${error.message}` };
       }
 
       revalidatePath('/', 'page');
       revalidatePath(`/task/${taskId}`, 'page');
 
       return { success: true };
 }

 // --- Action for Reordering (Using individual UPDATES) ---
export async function reorderTasks(orderedTaskIds: number[]) {
    const supabase = createServerClientCookie(); // Use cookie client for user context

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('Auth error in reorderTasks');
        return { error: 'Authentication required' };
    }

    try {
        // Create promises for each update operation
        const updatePromises = orderedTaskIds.map((id, index) =>
            supabase
                .from('tasks')
                .update({ sort_order: index }) // Only update sort_order
                .eq('id', id) // Target the specific task
                .eq('user_id', user.id) // Crucial: Ensure user owns the task (RLS check)
        );

        // Execute all update promises concurrently
        const results = await Promise.all(updatePromises);

        // Check if any of the updates failed
        const firstError = results.find(result => result.error);
        if (firstError && firstError.error) {
            console.error("Error updating task order:", firstError.error);
             if (firstError.error.code === '42501') {
                 console.error("RLS policy prevented update. Check ownership/policies.");
                 return { error: "Permission denied to update task order." };
             }
            // You might want more granular error handling or potentially revert changes
            // For now, return the first error encountered
            return { error: `Database error during update: ${firstError.error.message}` };
        }

        // If all updates succeeded
        revalidatePath('/', 'page');
        console.log(`Task order updated successfully for user ${user.id}`);
        return { success: true };

    } catch (err) {
        console.error("Unexpected error in reorderTasks:", err);
        return { error: "An unexpected server error occurred." };
    }
}

// --- New Delete Task Action ---
export async function deleteTask(taskId: number) {
    const supabase = createServerClientCookie(); // Use cookie client

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('Auth error in deleteTask');
        return { error: 'Authentication required' };
    }

    // Delete the task matching the ID and ensuring the user owns it
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id); // RLS enforces this, but explicit check is good practice

    if (error) {
        console.error('Error deleting task:', error);
        // Check for specific errors if needed
         if (error.code === '42501') {
             return { error: "Permission denied." };
         }
        return { error: `Database error: ${error.message}` };
    }

    // Revalidate the task list page
    revalidatePath('/', 'page');
    console.log(`Task ${taskId} deleted successfully for user ${user.id}`);
    return { success: true };
}