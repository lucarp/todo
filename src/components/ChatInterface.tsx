// src/components/ChatInterface.tsx
'use client'

import { useState, useRef, useEffect, FormEvent, Fragment } from 'react'; // Added Fragment
import { Message, SenderInfo } from '@/types';
import { addChatMessage } from '@/app/actions';
import { useUser } from '@/hooks/useUser';
import { Popover, Transition } from '@headlessui/react' // Import Headless UI
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


interface ChatInterfaceProps {
    taskId: number;
    initialMessages: Message[];
}

const emailPrefixRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s+/;

export default function ChatInterface({ taskId, initialMessages }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // State to store message ID -> public token mapping
    const [messageTokens, setMessageTokens] = useState<Map<number, string>>(new Map());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user } = useUser();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const getSenderInfo = (message: Message): SenderInfo => { /* ... keep existing ... */
         // Placeholder for AI - needs real logic
         if (message.sender_email === 'ai@assistant.placeholder') {
             return { type: 'ai', name: 'AI Assistant' };
         }
         // Check if message is from the current user
        if (message.user_id && user && message.user_id === user.id) {
             return { type: 'user', name: 'You' };
        }
        // Check if it's an external reply or sent via email prefix
        if (message.is_external || message.sender_email) {
             return { type: 'external', name: message.sender_email || 'External User' };
        }
         // Fallback/Unknown sender
        return { type: 'external', name: 'Unknown Sender' };
    };

    const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const content = newMessage.trim();
        if (!content || isSending) return;

        setIsSending(true);
        setError(null);

        // --- Optimistic Update ---
         const tempId = Date.now(); // Temporary ID for optimistic update
        const optimisticMessage: Message = { /* ... keep existing setup ... */
             id: tempId, // Use temporary ID
            task_id: taskId,
            user_id: user?.id || null, // Assign current user ID
            sender_email: null, // Will be set by action if needed
            content: content,
            is_external: false,
            created_at: new Date().toISOString(),
        };
        const emailMatch = content.match(emailPrefixRegex);
         if (emailMatch) {
            optimisticMessage.content = content.replace(emailPrefixRegex, '').trim(); // Show only message part
         }
         setMessages(prev => [...prev, optimisticMessage]);
         setNewMessage('');
        // --- End Optimistic Update ---


        try {
            const result = await addChatMessage(taskId, content);

            if (result?.error) {
                setError(result.error);
                setMessages(prev => prev.filter(m => m.id !== tempId)); // Revert optimistic
            } else if (result?.newMessage) {
                // Replace optimistic message with real one
                setMessages(prev => prev.map(m => m.id === tempId ? result.newMessage : m));
                // If a token was generated, store it
                if (result.publicToken) {
                    setMessageTokens(prev => new Map(prev).set(result.newMessage.id, result.publicToken || ''));
                }
            }
            // Handle cases where action might not return newMessage if needed
        } catch (err) {
            console.error("Client-side error sending message:", err);
            setError('Failed to send message.');
            setMessages(prev => prev.filter(m => m.id !== tempId)); // Revert optimistic
        } finally {
            setIsSending(false);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
        }
    };

    // Function to copy text to clipboard
    const copyToClipboard = (text: string) => {
         navigator.clipboard.writeText(text).then(() => {
            // Optional: Show success toast/message
            alert("Link copied to clipboard!");
         }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("Failed to copy link.");
         });
    }

    return (
        <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Discussion / Chat</h3>
            {/* Message History */}
            <div className="h-80 overflow-y-auto bg-gray-50 p-4 rounded border border-gray-200 space-y-4 mb-4">
                {messages.map((message) => {
                    const sender = getSenderInfo(message);
                    const isCurrentUser = sender.type === 'user';
                    const isAI = sender.type === 'ai';
                    const publicToken = messageTokens.get(message.id); // Check if token exists for this msg
                    const publicLink = publicToken ? `${baseUrl}/public/task/${publicToken}` : null;

                    return (
                        <div key={message.id} className={`flex group ${isCurrentUser ? 'justify-end' : 'items-start space-x-3'}`}>
                            {/* Avatar for non-user */}
                            {!isCurrentUser && ( /* ... keep avatar logic ... */
                                 <span className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                    isAI ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-600' // Style for AI vs External
                                }`}>
                                    {isAI ? 'AI' : sender.name.substring(0, 1).toUpperCase() /* Initials */}
                                </span>
                            )}

                            {/* Message Bubble */}
                            <div className={`relative max-w-[75%] ${isCurrentUser ? '' : 'flex-1'}`}>
                                <div className={`p-3 rounded-lg border shadow-sm ${isCurrentUser ? 'bg-blue-100 border-blue-200' : 'bg-white border-gray-200'}`}>
                                    <div className="prose prose-sm max-w-none text-gray-800 chat-message-content">
                                         <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                             {message.content}
                                         </ReactMarkdown>
                                     </div>
                                    <p className="text-xs text-gray-400 mt-1 text-right">
                                         {sender.name} - {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                     </p>
                                </div>

                                {/* Link Icon & Tooltip (Only for current user messages with a generated link) */}
                                {isCurrentUser && publicLink && (
                                     <Popover className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {() => (
                                            <>
                                                <Popover.Button
                                                    className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    title="Get public share link"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                </Popover.Button>
                                                <Transition
                                                    as={Fragment}
                                                    enter="transition ease-out duration-200"
                                                    enterFrom="opacity-0 translate-y-1"
                                                    enterTo="opacity-100 translate-y-0"
                                                    leave="transition ease-in duration-150"
                                                    leaveFrom="opacity-100 translate-y-0"
                                                    leaveTo="opacity-0 translate-y-1"
                                                >
                                                    <Popover.Panel className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 max-w-sm px-4 sm:px-0">
                                                        <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                                                            <div className="relative bg-white p-3">
                                                                <p className="text-xs font-medium text-gray-700 mb-1">Public Share Link (One-time use):</p>
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={publicLink}
                                                                    className="w-full p-1 text-xs border border-gray-300 rounded bg-gray-50 mb-2 focus:outline-none"
                                                                />
                                                                 <button
                                                                    onClick={() => copyToClipboard(publicLink)}
                                                                    className="w-full px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
                                                                 >
                                                                    Copy Link
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Popover.Panel>
                                                </Transition>
                                            </>
                                        )}
                                    </Popover>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendMessage}>
                 {/* ... error and helper text ... */}
                  {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                 <p className="text-xs text-gray-500 mb-1">Prefix message with an email (e.g., `name@example.com message text...`) to share & notify.</p>
                <div className="flex items-center space-x-3">
                     <textarea /* ... keep existing props ... */
                         value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        rows={2}
                        className="flex-1 shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border border-gray-300 rounded-md p-2 disabled:opacity-50"
                        placeholder="Type your message..."
                        disabled={isSending}
                        required
                    />
                    <button type="submit" /* ... keep existing props ... */
                         disabled={isSending || !newMessage.trim()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {/* ... Send Icon ... */}
                          {isSending ? 'Sending...' : (
                            <>
                            Send
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}