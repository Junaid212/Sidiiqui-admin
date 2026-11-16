import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Make an authenticated API request to the backend
 */
export async function apiRequest(endpoint, options = {}) {
    // Get the current session from Supabase to automatically retrieve the latest access token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const config = {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };

    // Auto-serialize plain object body to JSON if not FormData or already stringified
    if (config.body && !(config.body instanceof FormData) && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    // Don't set Content-Type for FormData (browser will set multipart boundary)
    if (!(config.body instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);
    // A proxy in front of the server (for example nginx refusing a large upload) answers with an HTML page, not JSON.
    let data;
    try { data = await response.json(); }
    catch {
        if (response.status === 413) throw new Error('The file is too large for the server. Please contact the developer.');
        if (response.status === 502 || response.status === 504) throw new Error('The server took too long to answer. Please try again, or contact the developer if it keeps happening.');
        throw new Error(`The server sent an unexpected answer (${response.status}). Please try again.`);
    }

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}
