// src/components/TaskItem.tsx
'use client';

import Link from 'next/link';
import { Task, TaskStatus } from '@/types';
import React, { useState } from 'react'; // Import React
import { updateTaskStatus } from '@/app/actions';

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
}

const TaskItem = React.forwardRef<HTMLTableRowElement, TaskItemProps>(
    ({ task, style, ...props }, ref) => {
        const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status);
        const [isUpdating, setIsUpdating] = useState(false);

        const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
            e.stopPropagation();
            if (isUpdating) return;
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
                        disabled={isUpdating}
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
            </tr>
        );
    }
);

TaskItem.displayName = 'TaskItem';
export default TaskItem;