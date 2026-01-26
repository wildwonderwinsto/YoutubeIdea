

// YouTube API key is now handled by the backend server
export function getBackendUrl(): string {
    return import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
}
