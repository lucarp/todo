// src/components/TaskListDnDContainer.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    // ***** Add useSensors here *****
    useSensors,
    DragEndEvent,
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


// ... keep interface TaskListDnDContainerProps ...
interface TaskListDnDContainerProps {
    initialTasks: Task[];
    filterActive: boolean;
}

export default function TaskListDnDContainer({ initialTasks, filterActive }: TaskListDnDContainerProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);

    useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);

    // ***** useSensors is now correctly imported *****
    const sensors = useSensors(
         useSensor(PointerSensor, {
             activationConstraint: {
                 distance: 10,
             },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
       // ... implementation from previous step ...
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = tasks.findIndex((task) => task.id === active.id);
        const newIndex = tasks.findIndex((task) => task.id === over.id);

        if (oldIndex === -1 || newIndex === -1) {
            console.error("Could not find dragged item indices. Aborting reorder.");
            return;
        }

        const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
        const orderedIds = reorderedTasks.map(task => task.id);

        setTasks(reorderedTasks); // Optimistic update

        try {
            const result = await reorderTasks(orderedIds);

            if (result?.error) {
                console.error("Failed to save task order:", result.error);
                alert(`Error saving order: ${result.error}. Reverting.`);
                // Revert UI
                setTasks(tasks);
            } else {
                console.log("Task order saved successfully.");
            }
        } catch (err) {
            console.error("Error calling reorderTasks action:", err);
            alert(`Error saving order. Please try again. Reverting.`);
            // Revert UI
            setTasks(tasks);
        }
    };

    const dndDisabled = filterActive;

    return (
        <DndContext
            // Pass the configured sensors
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            disabled={dndDisabled}
        >
            {/* ... rest of the component ... */}
             <table className="min-w-full">
                 <thead /* ... */ >{/* ... */}</thead>
                <SortableContext
                    items={tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                    disabled={dndDisabled}
                >
                     <tbody className="bg-white">
                         {/* ... empty states ... */}
                        {tasks.map((task) => (
                            <SortableTaskItem key={task.id} task={task} />
                        ))}
                    </tbody>
                </SortableContext>
            </table>
             {/* ... Disabled message ... */}
        </DndContext>
    );
}