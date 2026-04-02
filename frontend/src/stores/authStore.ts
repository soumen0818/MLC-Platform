import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<{ redirectTo: string }>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return { redirectTo: data.redirectTo };
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.error || 'Login failed');
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.user });
        } catch {
          get().logout();
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { data } = await api.post('/auth/change-password', {
          currentPassword,
          newPassword,
        });
        set({ token: data.token });
        // Refresh user data
        await get().fetchMe();
      },
    }),
    {
      name: 'mlc-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
