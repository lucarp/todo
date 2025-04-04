// src/app/task/new/page.tsx
'use client'

import { useState, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { addTask } from '@/app/actions'; // Import the server action
import Link from 'next/link';

// Color options - customize as needed
const colorOptions = [
    { label: 'Default', value: null, bgClass: 'bg-gray-200' },
    { label: 'Blue', value: 'blue', bgClass: 'bg-blue-500' },
    { label: 'Green', value: 'green', bgClass: 'bg-green-500' },
    { label: 'Yellow', value: 'yellow', bgClass: 'bg-yellow-400' },
    { label: 'Red', value: 'red', bgClass: 'bg-red-500' },
];

export default function NewTaskPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null); // Ref for potential reset

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(event.currentTarget);

        try {
            const result = await addTask(formData); // Call the server action

            if (result?.error) {
                setError(result.error);
                setIsSubmitting(false);
            } else {
                // Redirect is handled by the server action on success
                // Optionally reset form: formRef.current?.reset();
            }
        } catch (err) {
            console.error("Client-side error submitting form:", err);
            setError('An unexpected error occurred. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
            <Link href="/" className="mb-6 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to List
            </Link>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Create New Task</h1>

            <form ref={formRef} onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
                {/* Task Name */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Task Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isSubmitting}
                    />
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        rows={4}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Add more details about the task..."
                        disabled={isSubmitting}
                    ></textarea>
                     <p className="mt-1 text-xs text-gray-500">You can use plain text for now. Rich text editor is not implemented.</p>
                </div>

                {/* Deadline */}
                 <div>
                    <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                        Deadline (Optional)
                    </label>
                    <input
                        type="date"
                        id="deadline"
                        name="deadline"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isSubmitting}
                    />
                </div>

                 {/* Tags */}
                 <div>
                    <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                        Tags (Optional, comma-separated)
                    </label>
                    <input
                        type="text"
                        id="tags"
                        name="tags"
                        placeholder="e.g., work, urgent, frontend"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isSubmitting}
                    />
                </div>

                {/* Color Tag */}
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color Tag (Optional)
                    </label>
                    <div className="flex flex-wrap gap-3">
                        {colorOptions.map((option) => (
                            <label key={option.value || 'default'} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="color_tag"
                                    value={option.value ?? ''} // Send empty string for default
                                    defaultChecked={option.value === null}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                    disabled={isSubmitting}
                                />
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${option.value ? 'text-white' : 'text-gray-700'} ${option.bgClass}`}>
                                    {option.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                {/* Submit Button */}
                <div className="pt-4 text-right">
                     <Link href="/" className="mr-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Cancel
                     </Link>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Task'}
                    </button>
                </div>
            </form>
        </div>
    );
}