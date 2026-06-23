import { apiRequest } from '../config/api';

const BASE = '/questionnaire';

/** Full analytics: totals, profile breakdown, per-question results */
export async function fetchQuestionnaireAnalytics() {
    return apiRequest(`${BASE}/analytics`);
}

/** Paginated submissions list */
export async function fetchSubmissions({ page = 1, limit = 25, profile = '', category = '', search = '', dateFrom = '', dateTo = '' } = {}) {
    const params = new URLSearchParams();
    if (page)     params.set('page', page);
    if (limit)    params.set('limit', limit);
    if (profile)  params.set('profile', profile);
    if (category) params.set('category', category);
    if (search)   params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    return apiRequest(`${BASE}/submissions?${params.toString()}`);
}

/** Distinct profile list (for filter dropdown) */
export async function fetchProfiles() {
    return apiRequest(`${BASE}/profiles`);
}

/** Trigger CSV download */
export function downloadCSV({ profile = '', category = '', search = '', dateFrom = '', dateTo = '' } = {}) {
    const params = new URLSearchParams();
    if (profile)  params.set('profile', profile);
    if (category) params.set('category', category);
    if (search)   params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);

    // We need the auth token — get it from localStorage (Supabase stores it there)
    // For simplicity we trigger via window.open; the server will validate cookie/token via header
    // Instead, fetch the blob and download
    return _downloadFile(`${BASE}/export/csv?${params.toString()}`, `questionnaire_${Date.now()}.csv`);
}

/** Trigger Excel download */
export function downloadExcel({ profile = '', category = '', search = '', dateFrom = '', dateTo = '' } = {}) {
    const params = new URLSearchParams();
    if (profile)  params.set('profile', profile);
    if (category) params.set('category', category);
    if (search)   params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo)   params.set('dateTo', dateTo);
    return _downloadFile(`${BASE}/export/excel?${params.toString()}`, `questionnaire_${Date.now()}.xlsx`);
}

/** Internal: fetch binary and trigger download */
async function _downloadFile(endpoint, filename) {
    const { supabase } = await import('../config/supabase');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
