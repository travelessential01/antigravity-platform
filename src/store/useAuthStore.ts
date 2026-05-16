import { create } from 'zustand';

interface AuthState {
    isAuthenticated: boolean;
    userToken: string | null;
    userRole: string | null;
    setAuth: (token: string, role: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isAuthenticated: false,
    userToken: null,
    userRole: null,
    setAuth: (token, role) => set({ isAuthenticated: true, userToken: token, userRole: role }),
    logout: () => set({ isAuthenticated: false, userToken: null, userRole: null }),
}));
