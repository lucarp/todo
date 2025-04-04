// src/types/index.ts
export type TaskStatus = 'To do' | 'In Progress' | 'Done';

export interface Task {
    id: number;
    user_id: string;
    name: string;
    description: string | null; // Added
    completed: boolean; // We might phase this out in favor of status='Done'
    deadline: string | null;
    color_tag: string | null;
    tags: string[] | null;      // Added
    status: TaskStatus;         // Added
    participants: string[] | null;
    created_at: string;
}

export interface Message {
    id: number;
    task_id: number;
    user_id: string | null; // User who sent it internally
    sender_email: string | null; // Email if sent via prefix or reply
    content: string;
    is_external: boolean;
    created_at: string; // ISO date string
}

// Helper type for message sender info
export interface SenderInfo {
    type: 'user' | 'ai' | 'external';
    name: string; // 'You', 'AI Assistant', or email address
    avatar?: string; // Optional avatar URL or initials
}