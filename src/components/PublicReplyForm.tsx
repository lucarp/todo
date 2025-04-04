// src/components/PublicReplyForm.tsx
'use client'

import { useState, FormEvent } from 'react';
import { addPublicReply } from '@/app/actions'; // Import the server action

interface PublicReplyFormProps {
    token: string;
}

export default function PublicReplyForm({ token }: PublicReplyFormProps) {
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!replyContent.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const result = await addPublicReply(token, replyContent);

            if (result?.error) {
                setError(result.error);
            } else {
                setSuccessMessage("Your reply has been sent successfully!");
                setReplyContent(''); // Clear the form
                // Optionally disable form after success?
            }
        } catch (err) {
            console.error("Error submitting public reply:", err);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 mb-2">{successMessage}</p>}

            <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                placeholder="Type your reply here..."
                required
                disabled={isSubmitting || !!successMessage} // Disable if submitting or successful
            />
            <div className="mt-3 text-right">
                <button
                    type="submit"
                    disabled={isSubmitting || !replyContent.trim() || !!successMessage}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Sending...' : 'Send Reply'}
                </button>
            </div>
        </form>
    );
}