import { useState, useEffect, useCallback } from 'react';
import { UserSession, LoginResponse } from '../types/auth';

const STORAGE_KEY = 'velocity_user_session';

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar en localStorage ante cambios
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });

      const data: LoginResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      const newSession: UserSession = {
        userId: data.userId,
        name: data.name,
        email,
        role: data.role,
        token: data.token
      };

      setSession(newSession);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    session,
    isAuthenticated: Boolean(session && session.token),
    role: session?.role || null,
    loading,
    error,
    login,
    logout
  };
}
