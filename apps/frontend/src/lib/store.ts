// ============================================================
// MangaScans — Zustand Auth Store
// ============================================================

import { create } from 'zustand';
import { api } from './api';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    plan: string;
    isAdmin: boolean;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (email, password) => {
        const res = await api.login(email, password);
        set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    },

    register: async (email, password, name) => {
        const res = await api.register(email, password, name);
        set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    },

    logout: () => {
        api.clearToken();
        set({ user: null, isAuthenticated: false, isLoading: false });
    },

    loadUser: async () => {
        try {
            const res = await api.getMe();
            set({ user: res.data, isAuthenticated: true, isLoading: false });
        } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
