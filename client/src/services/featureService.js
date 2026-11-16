import { apiRequest } from '../config/api';

/** Online Reading content management */
export const reading = {
    listBooks: () => apiRequest('/reading/books'),
    askSidStatus: () => apiRequest('/reading/ask-sid-status'),
    reindex: () => apiRequest('/reading/reindex', { method: 'POST', body: {} }),
    createBook: (body) => apiRequest('/reading/books', { method: 'POST', body }),
    updateBook: (id, body) => apiRequest(`/reading/books/${id}`, { method: 'PUT', body }),
    deleteBook: (id, title) => apiRequest(`/reading/books/${id}`, { method: 'DELETE', body: { confirm: true, confirmTitle: title } }),
    listChapters: (bookId) => apiRequest(`/reading/books/${bookId}/chapters`),
    getChapter: (id) => apiRequest(`/reading/chapters/${id}`),
    createChapter: (bookId, body) => apiRequest(`/reading/books/${bookId}/chapters`, { method: 'POST', body }),
    updateChapter: (id, body) => apiRequest(`/reading/chapters/${id}`, { method: 'PUT', body }),
    publishChapter: (id) => apiRequest(`/reading/chapters/${id}/publish`, { method: 'POST', body: {} }),
    unpublishChapter: (id) => apiRequest(`/reading/chapters/${id}/unpublish`, { method: 'POST', body: {} }),
    deleteChapter: (id) => apiRequest(`/reading/chapters/${id}`, { method: 'DELETE', body: { confirm: true } }),
    importDocx: (bookId, file, dryRun) => { const fd = new FormData(); fd.append('file', file); if (dryRun) fd.append('dryRun', 'true'); return apiRequest(`/reading/books/${bookId}/import-docx`, { method: 'POST', body: fd }); },
    reorder: (bookId, chapterIds) => apiRequest(`/reading/books/${bookId}/order`, { method: 'PUT', body: { chapterIds } }),
};

/** Entitlements, launch offer, webhooks, audit */
export const entitlements = {
    overview: () => apiRequest('/entitlements/overview'),
    list: (params) => apiRequest(`/entitlements?${new URLSearchParams(params).toString()}`),
    detail: (id) => apiRequest(`/entitlements/${id}`),
    action: (id, body) => apiRequest(`/entitlements/${id}/action`, { method: 'POST', body }),
    openLaunch: (reason) => apiRequest('/entitlements/launch', { method: 'POST', body: { startsAt: 'now', reason } }),
    reconcile: (email) => apiRequest('/entitlements/reconcile', { method: 'POST', body: { email } }),
    webhooks: (params) => apiRequest(`/entitlements/webhooks?${new URLSearchParams(params).toString()}`),
    audit: () => apiRequest('/entitlements/audit'),
};

/** Digital Companion PDF files */
export const companion = {
    list: () => apiRequest('/companion-files'),
    upload: (file, kind) => { const fd = new FormData(); if (kind === 'book_pdf') fd.append('kind', 'book_pdf'); fd.append('file', file); return apiRequest('/companion-files', { method: 'POST', body: fd }); },
    retry: (id) => apiRequest(`/companion-files/${id}/retry`, { method: 'POST', body: {} }),
    makeCurrent: (id) => apiRequest(`/companion-files/${id}/make-current`, { method: 'POST', body: {} }),
    remove: (id) => apiRequest(`/companion-files/${id}`, { method: 'DELETE' }),
};
