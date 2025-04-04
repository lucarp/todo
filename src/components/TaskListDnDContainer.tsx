// src/components/TaskListDnDContainer.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    // CollisionDetection // Included in DndContextProps if needed, no direct import needed typically
    // Modifier // Not usually imported directly
    // type SensorDescriptor, // Not needed for basic use
    // type SensorOptions // Not needed for basic use
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers';

import { Task } from '@/types';
import SortableTaskItem from './SortableTaskItem';
import { reorderTasks } from '@/app/actions';


interface TaskListDnDContainerProps {
    initialTasks: Task[];
    filterActive: boolean;
}

export default function TaskListDnDContainer({ initialTasks, filterActive }: TaskListDnDContainerProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);

    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);

    const sensors = useSensors(
         useSensor(PointerSensor, {
             activationConstraint: { distance: 10, },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
       // ... implementation from previous step ...
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = tasks.findIndex((task) => task.id === active.id);
        const newIndex = tasks.findIndex((task) => task.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        const orderedIds = reorderedTasks.map(task => task.id);
        setTasks(reorderedTasks); // Optimistic update
        try {
            const result = await reorderTasks(orderedIds);
            if (result?.error) {
                console.error("Failed to save task order:", result.error);
                alert(`Error saving order: ${result.error}. Reverting.`);
                setTasks(tasks); // Revert
            }
        } catch (err) {
            console.error("Error calling reorderTasks action:", err);
            alert(`Error saving order. Please try again. Reverting.`);
            setTasks(tasks); // Revert
        }
    };

    // --- Callback for handling deletion from TaskItem ---
    const handleTaskDelete = useCallback((taskId: number) => {
        // Optimistically remove the task from the local state
        setTasks(currentTasks => currentTasks.filter(task => task.id !== taskId));
         console.log(`Optimistically removed task ${taskId} from UI.`);
         // Server revalidation will confirm or correct this if delete action failed somehow
    }, []); // Empty dependency array, setTasks is stable

    const dndDisabled = filterActive;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            // ***** REMOVE disabled prop from DndContext *****
            // disabled={dndDisabled}
        >
            <table className="min-w-full">
                 <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Deadline</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Tags</th>
                    </tr>
                </thead>
                <SortableContext
                    items={tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                    // ***** KEEP disabled prop here *****
                    disabled={dndDisabled}
                >
                     <tbody className="bg-white">
                        {tasks.length === 0 && !dndDisabled && ( <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 border-b border-gray-200">No tasks yet! Add one?</td></tr> )}
                        {tasks.length === 0 && dndDisabled && ( <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 border-b border-gray-200">No tasks match the selected tags.</td></tr> )}
                        {tasks.map((task) => (
                            <SortableTaskItem key={task.id} task={task} onDelete={handleTaskDelete} />
                        ))}
                    </tbody>
                </SortableContext>
            </table>
             {dndDisabled && (
                 <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                     Task reordering is disabled while filters are active.
                 </div>
             )}
        </DndContext>
    );
}