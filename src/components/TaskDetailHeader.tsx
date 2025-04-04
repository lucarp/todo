// src/components/TaskDetailHeader.tsx
'use client'

import { Task, TaskStatus } from '@/types';
import { useState, FormEvent } from 'react';
import { updateTaskStatus, updateTaskDetails } from '@/app/actions';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper to map color tags to Tailwind classes for the detail badge
const getTagClasses = (colorTag: string | null): string => {
    switch (colorTag) {
        case 'blue': return 'bg-blue-100 text-blue-800';
        case 'green': return 'bg-green-100 text-green-800';
        case 'yellow': return 'bg-yellow-100 text-yellow-800';
        case 'red': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

// Helper for status display
const getStatusBadgeClasses = (status: TaskStatus): string => {
    switch (status) {
        case 'To do': return 'bg-gray-200 text-gray-800';
        case 'In Progress': return 'bg-yellow-200 text-yellow-800';
        case 'Done': return 'bg-green-200 text-green-800';
        default: return 'bg-gray-200 text-gray-800';
    }
}

// Color options - customize as needed
const colorOptions = [
    { label: 'Default', value: '', bgClass: 'bg-gray-200' }, // Use empty string for null/default value in form
    { label: 'Blue', value: 'blue', bgClass: 'bg-blue-500' },
    { label: 'Green', value: 'green', bgClass: 'bg-green-500' },
    { label: 'Yellow', value: 'yellow', bgClass: 'bg-yellow-400' },
    { label: 'Red', value: 'red', bgClass: 'bg-red-500' },
];


interface TaskDetailHeaderProps {
    task: Task;
}

export default function TaskDetailHeader({ task }: TaskDetailHeaderProps) {

    // --- States remain the same ---
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editedName, setEditedName] = useState(task.name);
    const [editedDescription, setEditedDescription] = useState(task.description || '');
    const initialDeadline = task.deadline ? task.deadline.split('T')[0] : '';
    const [editedDeadline, setEditedDeadline] = useState(initialDeadline);
    const [editedTags, setEditedTags] = useState(task.tags?.filter(t => !['To do', 'In Progress', 'Done'].includes(t)).join(', ') || '');
    const [editedColorTag, setEditedColorTag] = useState(task.color_tag || '');
    const [editedParticipants, setEditedParticipants] = useState(task.participants?.join(', ') || '');
    const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // --- Handlers remain the same ---
    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => { /* ... keep existing ... */
         e.stopPropagation();
        if (isUpdatingStatus || isEditing) return; // Don't allow status change while editing other fields or if already updating status
        const newStatus = e.target.value as TaskStatus;
        if (newStatus === currentStatus) return;

        setIsUpdatingStatus(true);
        const oldStatus = currentStatus;
        setCurrentStatus(newStatus); // Optimistic update

        try {
            const result = await updateTaskStatus(task.id, newStatus);
            if (result?.error) {
                console.error("Error updating status:", result.error);
                setCurrentStatus(oldStatus); // Revert
                // TODO: Show toast error
            }
            // Revalidation in action handles success
        } catch (err) {
            console.error("Client-side error updating status:", err);
            setCurrentStatus(oldStatus); // Revert
             // TODO: Show toast error
        } finally {
            setIsUpdatingStatus(false);
        }
    };
    const handleEditClick = () => { /* ... keep existing ... */
         // Reset form to current task state before editing
        setEditedName(task.name);
        setEditedDescription(task.description || '');
        setEditedDeadline(task.deadline ? task.deadline.split('T')[0] : '');
        setEditedTags(task.tags?.filter(t => !['To do', 'In Progress', 'Done'].includes(t)).join(', ') || '');
        setEditedColorTag(task.color_tag || '');
        setEditedParticipants(task.participants?.join(', ') || '');
        setSaveError(null); // Clear previous errors
        setIsEditing(true);
    };
    const handleCancelClick = () => { /* ... keep existing ... */
         setIsEditing(false);
        setSaveError(null);
    };
    const handleSaveSubmit = async (event: FormEvent<HTMLFormElement>) => { /* ... keep existing ... */
         event.preventDefault();
        setIsSaving(true);
        setSaveError(null);

        const formData = new FormData(event.currentTarget);

        try {
            const result = await updateTaskDetails(task.id, formData); // Call the server action

            if (result?.error) {
                setSaveError(result.error);
                setIsSaving(false);
            } else {
                setIsEditing(false); // Exit edit mode on success
                setIsSaving(false);
                // Data refresh is handled by revalidatePath in the action
                // Optionally show a success toast here
            }
        } catch (err) {
            console.error("Client-side error saving task details:", err);
            setSaveError('An unexpected error occurred. Please try again.');
            setIsSaving(false);
        }
    };

    // --- Calculate display values (used when NOT editing) ---
    const displayTags = task.tags?.filter(tag => !['To do', 'In Progress', 'Done'].includes(tag)) || [];
    const statusBadgeClass = getStatusBadgeClasses(currentStatus);

    return (
        // Outermost div for layout
        <div className="mb-6 pb-4 border-b border-gray-200">

            {/* --- SECTION 1: Always Visible Header Row --- */}
            {/* This row now ONLY contains the title (or input) and the appropriate buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
                {isEditing ? (
                    // Name input is part of the form, so it goes inside the form element below
                    // We leave a placeholder space or adjust layout if needed, or render title here too
                     <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words invisible">
                           {/* Invisible placeholder to maintain height approx */}
                           {editedName || " "}
                      </h2>
                ) : (
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">
                        {task.name}
                    </h2>
                )}

                {/* Edit/Save/Cancel Buttons - These buttons control the mode, not submit the form */}
                <div className="flex-shrink-0 flex gap-2 items-center">
                    {isEditing ? (
                        <>
                             {/* Save and Cancel Buttons will be rendered *inside* the form below */}
                        </>
                    ) : (
                        <button
                            type="button" // Crucial: NOT type="submit"
                            onClick={handleEditClick}
                            className="px-3 py-1 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
                        >
                            Edit Task
                        </button>
                    )}
                </div>
            </div>

            {/* --- SECTION 2: Form (Rendered only when editing) --- */}
            {isEditing ? (
                <form onSubmit={handleSaveSubmit}>
                    {/* Name Input (moved inside form) */}
                     <div className="mb-3"> {/* Add margin if needed */}
                          <label htmlFor="task-name-edit" className="sr-only">Task Name</label>
                         <input
                            id="task-name-edit"
                            type="text"
                            name="name" // Name attribute for FormData
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            required
                            className="text-xl sm:text-2xl font-bold text-gray-800 border border-gray-300 rounded px-2 py-1 w-full focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isSaving}
                        />
                    </div>

                     {/* Display Save Error (inside form, near buttons) */}
                     {saveError && <p className="text-sm text-red-600 mb-3 text-right">{saveError}</p>}


                    {/* --- All other input fields go inside the form --- */}

                    {/* Deadline */}
                    <div className="flex items-center text-sm text-gray-600 mb-2 gap-2">
                         <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> </svg>
                         <label htmlFor="deadline-edit" className="w-20 flex-shrink-0">Deadline:</label>
                         <input
                            id="deadline-edit"
                            type="date"
                            name="deadline"
                            value={editedDeadline}
                            onChange={(e) => setEditedDeadline(e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-0.5 focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Participants */}
                     <div className="flex items-center text-sm text-gray-600 mb-2 gap-2">
                         <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> </svg>
                         <label htmlFor="participants-edit" className="w-20 flex-shrink-0">Participants:</label>
                         <input
                            id="participants-edit"
                            type="text"
                            name="participants"
                            value={editedParticipants}
                            onChange={(e) => setEditedParticipants(e.target.value)}
                            placeholder="email1@eg.com, email2@eg.com"
                             className="flex-grow text-sm border border-gray-300 rounded px-2 py-0.5 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Status Dropdown (Visible but disabled inside edit form) */}
                    <div className="flex items-center text-sm text-gray-600 mb-4 gap-2">
                         <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg>
                         <span className="w-20 flex-shrink-0">Status:</span>
                         <select
                            value={currentStatus}
                            onChange={handleStatusChange} // Keep handler, but disabled state controls it
                            disabled={true} // Always disabled when editing other fields
                            className={`ml-0 text-xs font-medium rounded px-2 py-0.5 border border-transparent focus:outline-none ${statusBadgeClass} opacity-70 cursor-not-allowed`} // Style as disabled
                         >
                             <option value="To do">To do</option>
                             <option value="In Progress">In Progress</option>
                             <option value="Done">Done</option>
                         </select>
                         <span className="text-xs text-gray-500 italic ml-2">(Change status when not editing)</span>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <label htmlFor="description-edit" className="text-sm font-semibold text-gray-700 mb-1 block">Description</label>
                        {isEditing ? (
                    <textarea
                        id="description-edit"
                        // ... props for textarea ...
                        name="description"
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        rows={4}
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                        placeholder="Task description (Markdown supported)..."
                        disabled={isSaving}
                    ></textarea>
                 ) : (
                     task.description ? (
                         // ***** Render Markdown *****
                         // Apply prose class for Tailwind Typography styling if installed
                        <div className="prose prose-sm max-w-none text-gray-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {task.description}
                            </ReactMarkdown>
                        </div>
                     ) : (
                        <p className="text-sm text-gray-500 italic">No description provided.</p>
                     )
                 )}
                    </div>

                    {/* Tags */}
                    <div className="mb-4">
                        <label htmlFor="tags-edit" className="text-sm font-semibold text-gray-700 mb-1 block">Tags</label>
                         <input
                             id="tags-edit"
                            type="text"
                            name="tags"
                            value={editedTags}
                            onChange={(e) => setEditedTags(e.target.value)}
                            placeholder="tag1, tag2, tag3"
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                            disabled={isSaving}
                        />
                         <p className="mt-1 text-xs text-gray-500">Comma-separated. Status tags are managed automatically.</p>
                    </div>

                    {/* Color Tag */}
                    <div className="mb-4">
                         <h4 className="block text-sm font-semibold text-gray-700 mb-2">Color Tag</h4>
                         <div className="flex flex-wrap gap-3">
                            {colorOptions.map((option) => (
                                <label key={option.value || 'default-edit'} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="color_tag" // Used by FormData
                                        value={option.value} // Value sent in form
                                        checked={editedColorTag === option.value} // Control checked state
                                        onChange={(e) => setEditedColorTag(e.target.value)}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        disabled={isSaving}
                                    />
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${option.value ? 'text-white' : 'text-gray-700'} ${option.bgClass}`}>
                                        {option.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {saveError && isEditing && <p className="text-sm text-red-600 mb-3 text-right">{saveError}</p>}

                    {/* Save/Cancel Buttons (inside form when editing) */}
                    {isEditing && (
                        <div className="flex justify-end gap-2 mt-4">
                            {/* ... buttons ... */}
                            <button type="button" onClick={handleCancelClick} /* ... */>Cancel</button>
                            <button type="submit" /* ... */>{isSaving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    )}

                </form>
            ) : (
                // --- SECTION 3: Display Fields (Rendered when not editing) ---
                <>
                    {/* Metadata Row */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-6 gap-y-2 text-sm text-gray-600 mb-4">
                        {/* Deadline */}
                        <div className="flex items-center">
                             <svg className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> </svg>
                            Deadline: <span className="font-medium ml-1">{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Not Set'}</span>
                        </div>
                        {/* Participants */}
                        <div className="flex items-center">
                             <svg className="h-4 w-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /> </svg>
                            Participants: <span className="font-medium ml-1">{task.participants?.join(', ') || 'None'}</span>
                        </div>
                         {/* Status Dropdown (Enabled when not editing) */}
                         <div className="flex items-center text-sm text-gray-600 gap-2">
                             <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"> <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg>
                             <span className="w-20 flex-shrink-0">Status:</span>
                             <select
                                value={currentStatus}
                                onChange={handleStatusChange}
                                disabled={isUpdatingStatus} // Only disabled if status itself is updating
                                className={`ml-0 text-xs font-medium rounded px-2 py-0.5 border border-transparent focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-indigo-500 ${statusBadgeClass} ${isUpdatingStatus ? 'opacity-70 cursor-not-allowed' : ''}`}
                             >
                                 <option value="To do">To do</option>
                                 <option value="In Progress">In Progress</option>
                                 <option value="Done">Done</option>
                             </select>
                         </div>
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                         {task.description ? (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
                         ) : (
                            <p className="text-sm text-gray-500 italic">No description provided.</p>
                         )}
                    </div>

                    {/* Tags */}
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Tags</h4>
                         {displayTags.length > 0 ? (
                             <div className="flex flex-wrap gap-2">
                                {displayTags.map(tag => (
                                    <span key={tag} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                         ) : (
                             <p className="text-sm text-gray-500 italic">No additional tags.</p>
                         )}
                    </div>

                     {/* Color Tag */}
                     <div className="mb-4">
                         <h4 className="block text-sm font-semibold text-gray-700 mb-2">Color Tag</h4>
                         {task.color_tag ? (
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getTagClasses(task.color_tag)}`}>
                                {task.color_tag.charAt(0).toUpperCase() + task.color_tag.slice(1)} Tag
                            </span>
                         ) : (
                            <span className="text-sm text-gray-500 italic">Default</span>
                         )}
                    </div>
                </>
            )}
        </div> // End outermost div
    );
}