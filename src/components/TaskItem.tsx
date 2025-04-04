// src/components/TaskItem.tsx
'use client';

import Link from 'next/link';
import { Task, TaskStatus } from '@/types';
import React, { useState } from 'react'; // Import React
import { updateTaskStatus, deleteTask } from '@/app/actions';

// Helper for row background color - Maps color_tag to Tailwind bg classes
// Ensure these colors provide good contrast with your text and status badges
const getRowColorClasses = (colorTag: string | null): string => {
    switch (colorTag) {
        case 'blue': return 'bg-blue-50 hover:bg-blue-100';
        case 'green': return 'bg-green-50 hover:bg-green-100';
        case 'yellow': return 'bg-yellow-50 hover:bg-yellow-100';
        case 'red': return 'bg-red-50 hover:bg-red-100';
        // Add more colors here if needed (e.g., purple, pink, indigo)
        // case 'purple': return 'bg-purple-50 hover:bg-purple-100';
        default: return 'bg-white hover:bg-gray-50'; // Default white background
    }
};

// Helper for status badge - Keep this as is
const getStatusBadgeClasses = (status: TaskStatus): string => {
    switch (status) {
        case 'To do': return 'bg-gray-200 text-gray-800';
        case 'In Progress': return 'bg-yellow-200 text-yellow-800';
        case 'Done': return 'bg-green-200 text-green-800';
        default: return 'bg-gray-200 text-gray-800';
    }
};

// Define props including potential style and others from dnd-kit
interface TaskItemProps extends React.HTMLAttributes<HTMLTableRowElement> {
  task: Task;
  style?: React.CSSProperties;
  onDelete?: (taskId: number) => void;
}

const TaskItem = React.forwardRef<HTMLTableRowElement, TaskItemProps>(
    ({ task, style, onDelete, ...props }, ref) => {
        const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status);
        const [isUpdating, setIsUpdating] = useState(false);
        const [isDeleting, setIsDeleting] = useState(false); // State for delete button

        const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
            e.stopPropagation();
            if (isUpdating || isDeleting) return;
            // ... rest of handleStatusChange logic ...
             const newStatus = e.target.value as TaskStatus;
            if (newStatus === currentStatus) return;
            setIsUpdating(true);
            const oldStatus = currentStatus;
            setCurrentStatus(newStatus);
            try {
                const result = await updateTaskStatus(task.id, newStatus);
                if (result?.error) setCurrentStatus(oldStatus);
            } catch (err) { setCurrentStatus(oldStatus); console.error('Error updating task status:', err); }
            finally { setIsUpdating(false); }
        };

        // --- Delete Handler ---
        const handleDeleteClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation(); // Prevent row click/drag
            if (isDeleting) return;

            const confirmed = window.confirm(`Are you sure you want to delete task "${task.name}"?`);
            if (!confirmed) return;

            setIsDeleting(true);
            try {
                const result = await deleteTask(task.id);
                if (result?.error) {
                    alert(`Error deleting task: ${result.error}`);
                    setIsDeleting(false); // Re-enable button on error
                } else {
                    console.log(`Task ${task.id} marked for deletion.`);
                    // Call the onDelete callback for parent component (optimistic UI)
                    if (onDelete) {
                        onDelete(task.id);
                    }
                    // No need to setIsDeleting(false) on success as component will unmount
                    // Revalidation will handle final state from server
                }
            } catch (err) {
                 console.error("Client-side error deleting task:", err);
                alert("An unexpected error occurred while deleting.");
                setIsDeleting(false);
            }
        };

        const displayTags = task.tags?.filter(tag => !['To do', 'In Progress', 'Done'].includes(tag)) || [];
        // ***** Get the row color class *****
        const rowColorClass = getRowColorClasses(task.color_tag);
        const statusBadgeClass = getStatusBadgeClasses(currentStatus);
        const isTaskDone = currentStatus === 'Done';

        return (
            <tr
                ref={ref}
                style={style}
                {...props} // Apply listeners and attributes from useSortable
                // ***** Apply the dynamic rowColorClass here *****
                className={`group transition-colors duration-150 ease-in-out ${rowColorClass} ${props.className || ''}`}
                // Optional: Add cursor-grab for visual cue
                // className={`group transition-colors ... ${rowColorClass} ... cursor-grab`}
            >
                {/* Status Cell */}
                <td className="px-4 py-3 whitespace-nowrap border-b border-gray-200 touch-none" onClick={(e) => e.stopPropagation()}>
                    <select
                        value={currentStatus}
                        onChange={handleStatusChange}
                        disabled={isUpdating || isDeleting}
                        className={`text-xs font-medium rounded px-2 py-1 border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${statusBadgeClass} ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        <option value="To do">To do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                    </select>
                </td>
                {/* Task Name Cell */}
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium border-b border-gray-200 ${isTaskDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                   <Link href={`/task/${task.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5">
                       {task.name}
                   </Link>
                </td>
                {/* Deadline Cell */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell border-b border-gray-200">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
                </td>
                {/* Tags Cell */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell border-b border-gray-200">
                     {displayTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {displayTags.map(tag => (<span key={tag} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">{tag}</span>))}
                        </div>
                    ) : ('-')}
                </td>
                {/* ***** Action Cell ***** */}
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium border-b border-gray-200">
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 rounded p-1"
                        title={`Delete task "${task.name}"`}
                    >
                       {isDeleting ? (
                            // Simple spinner/loading indicator
                            <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                       ) : (
                        // Trash Icon
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                       )}
                    </button>
                </td>
            </tr>
        );
    }
);

TaskItem.displayName = 'TaskItem';
export default TaskItem;