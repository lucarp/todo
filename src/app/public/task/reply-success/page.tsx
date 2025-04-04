// src/app/public/task/reply-success/page.tsx
import Link from 'next/link';

// This can be a simple Server Component
export default function ReplySuccessPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
             <div className="bg-white p-8 sm:p-10 rounded-xl shadow-2xl text-center max-w-lg w-full transform transition-all hover:scale-[1.02] duration-300">
                {/* Optional: Success Icon */}
                <div className="mb-5 text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">Thank You!</h1>
                <p className="text-gray-600 mb-6 text-base sm:text-lg">
                    Your reply has been successfully sent and added to the task discussion.
                </p>

                {/* LiquidLM Promotion */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5 mb-6">
                    <h2 className="text-lg font-semibold text-indigo-800 mb-2">Manage Your Tasks Effortlessly?</h2>
                    <p className="text-indigo-700 text-sm mb-4">
                       Like how this task was shared? Start organizing your own projects, collaborate seamlessly, and boost your productivity with <span className="font-bold">LiquidLM</span> - the awesome new tool for task management!
                    </p>
                    <Link
                        href="/login" // Login page handles redirect to signup if needed
                        className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-medium text-sm leading-tight uppercase rounded-md shadow-md hover:bg-indigo-700 hover:shadow-lg focus:bg-indigo-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-indigo-800 active:shadow-lg transition duration-150 ease-in-out"
                    >
                        Try LiquidLM for Free
                    </Link>
                </div>

                 <p className="text-xs text-gray-400">
                    You can now close this page.
                </p>
             </div>
         </div>
    );
}