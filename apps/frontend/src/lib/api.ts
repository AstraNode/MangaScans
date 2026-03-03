// ============================================================
// MangaScans — API Client
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
    private token: string | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('mangascans_token');
        }
    }

    setToken(token: string) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('mangascans_token', token);
        }
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('mangascans_token');
        }
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Remove Content-Type for FormData
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        return data;
    }

    // ── Auth ───────────────────────────────────────────────────

    async register(email: string, password: string, name: string) {
        const data = await this.request<any>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });
        if (data.data?.token) this.setToken(data.data.token);
        return data;
    }

    async login(email: string, password: string) {
        const data = await this.request<any>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (data.data?.token) this.setToken(data.data.token);
        return data;
    }

    async getMe() {
        return this.request<any>('/api/auth/me');
    }

    // ── Projects ───────────────────────────────────────────────

    async createProject(data: { title: string; sourceLanguage?: string; targetLanguage?: string; translationStyle?: string }) {
        return this.request<any>('/api/projects', { method: 'POST', body: JSON.stringify(data) });
    }

    async getProjects(page = 1, limit = 20) {
        return this.request<any>(`/api/projects?page=${page}&limit=${limit}`);
    }

    async getProject(id: string) {
        return this.request<any>(`/api/projects/${id}`);
    }

    async deleteProject(id: string) {
        return this.request<any>(`/api/projects/${id}`, { method: 'DELETE' });
    }

    // ── Pages ──────────────────────────────────────────────────

    async uploadPages(projectId: string, files: File[]) {
        const formData = new FormData();
        files.forEach((file) => formData.append('pages', file));

        return this.request<any>(`/api/pages/upload/${projectId}`, {
            method: 'POST',
            body: formData,
        });
    }

    async getPage(id: string) {
        return this.request<any>(`/api/pages/${id}`);
    }

    async updateBubbles(pageId: string, bubbles: Array<{ id: string; translatedText: string; fontSize?: number; fontFamily?: string }>) {
        return this.request<any>(`/api/pages/${pageId}/bubbles`, {
            method: 'PUT',
            body: JSON.stringify({ bubbles }),
        });
    }

    async reprocessPage(pageId: string) {
        return this.request<any>(`/api/pages/${pageId}/reprocess`, { method: 'POST' });
    }

    async downloadProject(projectId: string) {
        const response = await fetch(`${API_BASE}/api/pages/download/${projectId}`, {
            headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!response.ok) throw new Error('Download failed');
        return response.blob();
    }

    // ── Admin ──────────────────────────────────────────────────

    async getAdminStats() {
        return this.request<any>('/api/admin/stats');
    }

    async getAdminJobs(status = 'active', page = 0) {
        return this.request<any>(`/api/admin/jobs?status=${status}&page=${page}`);
    }

    async getAdminErrors() {
        return this.request<any>('/api/admin/errors');
    }
}

export const api = new ApiClient();
