// src/components/SortableTaskItem.tsx
'use client'

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import TaskItem from './TaskItem'; // The original display component

interface SortableTaskItemProps {
    task: Task;
    onDelete?: (taskId: number) => void;
}

export default function SortableTaskItem({ task, onDelete }: SortableTaskItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging, // Use this to style the item while dragging
    } = useSortable({ id: task.id }); // Use the unique task ID

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1, // Make item semi-transparent while dragging
        // Add box shadow or other visual cues when dragging if desired
        // boxShadow: isDragging ? '0 0 10px rgba(0,0,0,0.2)' : 'none',
    };

    // We need to render the `tr` and its contents here
    // Pass the refs, styles, and listeners to the `tr`
    return (
        <TaskItem ref={setNodeRef} style={style} task={task} {...attributes} {...listeners} onDelete={onDelete} />
    );
}