// src/components/TaskItem.tsx
'use client';

import Link from 'next/link';
import { Task, TaskStatus } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react'; // Import React
import { updateTaskStatus } from '@/app/actions';

// ... keep helper functions (getRowColorClasses, getStatusBadgeClasses) ...
const getRowColorClasses = (colorTag: string | null): string => { /* ... */ };
const getStatusBadgeClasses = (status: TaskStatus): string => { /* ... */ };


// Define props including potential style and others from dnd-kit
interface TaskItemProps extends React.HTMLAttributes<HTMLTableRowElement> { // Accept standard tr attributes
  task: Task;
  style?: React.CSSProperties; // Accept style prop for dnd
}

// ***** Use React.forwardRef *****
const TaskItem = React.forwardRef<HTMLTableRowElement, TaskItemProps>(
    ({ task, style, ...props }, ref) => { // Destructure style and props, get ref
        const router = useRouter();
        const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status);
        const [isUpdating, setIsUpdating] = useState(false);

        const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
            e.stopPropagation(); // ***** FIX POINT 2: Stop propagation HERE *****
            if (isUpdating) return;
            // ... rest of handleStatusChange logic ...
             const newStatus = e.target.value as TaskStatus;
            if (newStatus === currentStatus) return;

            setIsUpdating(true);
            const oldStatus = currentStatus;
            setCurrentStatus(newStatus);

            try {
                const result = await updateTaskStatus(task.id, newStatus);
                if (result?.error) {
                    console.error("Error updating status:", result.error);
                    setCurrentStatus(oldStatus);
                }
            } catch (err) {
                console.error("Client-side error updating status:", err);
                setCurrentStatus(oldStatus);
            } finally {
                setIsUpdating(false);
            }
        };

        const displayTags = task.tags?.filter(tag => !['To do', 'In Progress', 'Done'].includes(tag)) || [];
        const rowColorClass = getRowColorClasses(task.color_tag);
        const statusBadgeClass = getStatusBadgeClasses(currentStatus);
        const isTaskDone = currentStatus === 'Done';

        return (
            // No Link wrapper needed here, DnD container will handle item structure.
            // Pass ref, style, and spread props onto the tr element
            <tr
                ref={ref}
                style={style}
                {...props} // Apply listeners and attributes from useSortable
                className={`group transition-colors duration-150 ease-in-out ${rowColorClass} ${props.className || ''}`} // Combine classes
                // Add cursor-grab when draggable (optional)
                // className={`group transition-colors duration-150 ease-in-out ${rowColorClass} ${props.className || ''} cursor-grab`}
            >
                {/* Status Cell */}
                {/* Clicks inside TD should generally not activate drag unless specifically on handle */}
                <td className="px-4 py-3 whitespace-nowrap border-b border-gray-200 touch-none" onClick={(e) => e.stopPropagation()}> {/* touch-none helps prevent scroll */}
                    {/* Select element is focusable, stop propagation on its wrapper */}
                    <select
                        value={currentStatus}
                        onChange={handleStatusChange}
                        disabled={isUpdating}
                        className={`text-xs font-medium rounded px-2 py-1 border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 ${statusBadgeClass} ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                       {/* Options */}
                        <option value="To do">To do</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Done">Done</option>
                    </select>
                </td>
                {/* Task Name Cell - Link inside the cell now */}
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium border-b border-gray-200 ${isTaskDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                   {/* Wrap content in Link, stop propagation to prevent drag */}
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
                    {/* ... tags display ... */}
                     {displayTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {displayTags.map(tag => (
                                <span key={tag} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : (
                        '-'
                    )}
                </td>
            </tr>
        );
    }
);

TaskItem.displayName = 'TaskItem'; // Good practice for forwardRef
export default TaskItem;