import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: string) => void;
  loading: boolean;
  error: Error | null;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_SUPERADMIN_USER: User = {
  id: 'usr-admin-01',
  name: 'Carlos Mendoza',
  email: 'admin@rappidopanama.com',
  role: 'SUPERADMIN',
  baseWarehouseId: 'wh-main-01',
  baseWarehouseName: 'Bodega Central Tocumen',
  phone: '+507 6000-0001'
};

const isEmbeddedMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('embedded') === 'true' || window.self !== window.top;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return isEmbeddedMode() ? DEFAULT_SUPERADMIN_USER : null;
  });
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    return isEmbeddedMode() ? [DEFAULT_SUPERADMIN_USER] : [];
  });
  const [token, setTokenState] = useState<string | null>(api.getToken());
  const [loading, setLoading] = useState<boolean>(!isEmbeddedMode());
  const [error, setError] = useState<Error | null>(null);

  const initAuth = async () => {
    try {
      if (!isEmbeddedMode()) {
        setLoading(true);
      }
      setError(null);

      // Si tenemos token guardado, consultar perfil /me
      const currentToken = api.getToken();
      if (currentToken) {
        try {
          const meRes = await api.getMe();
          if (meRes?.user) {
            setCurrentUser(meRes.user);
            api.setActiveUserId(meRes.user.id);
            setTokenState(currentToken);
          }
        } catch (meErr) {
          console.warn('Token expirado o inválido:', meErr);
        }
      }

      // Cargar lista de usuarios para soporte RBAC / switcher
      try {
        const usersRes = await api.getUsers();
        if (usersRes?.users && usersRes.users.length > 0) {
          setAllUsers(usersRes.users);
          
          if (!currentUser) {
            const savedId = localStorage.getItem('isp_active_user_id');
            const found = usersRes.users.find(u => u.id === savedId) || usersRes.users[0];
            if (found) {
              setCurrentUser(found);
              api.setActiveUserId(found.id);
            }
          }
        } else if (isEmbeddedMode() && !currentUser) {
          setCurrentUser(DEFAULT_SUPERADMIN_USER);
          api.setActiveUserId(DEFAULT_SUPERADMIN_USER.id);
        }
      } catch (uErr) {
        console.warn('No se pudo listar usuarios:', uErr);
        if (isEmbeddedMode() && !currentUser) {
          setCurrentUser(DEFAULT_SUPERADMIN_USER);
          api.setActiveUserId(DEFAULT_SUPERADMIN_USER.id);
        }
      }
    } catch (err) {
      console.error('Error inicializando autenticación:', err);
      if (!isEmbeddedMode()) {
        setError(err as Error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setTokenState(res.token);
        localStorage.setItem('isp_active_user_id', res.user.id);
      } else {
        throw new Error(res.message || 'Error en el inicio de sesión');
      }
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setTokenState(null);
    setCurrentUser(null);
    localStorage.removeItem('isp_active_user_id');
  };

  const switchUser = (userId: string) => {
    const found = allUsers.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      api.setActiveUserId(found.id);
      localStorage.setItem('isp_active_user_id', found.id);
    }
  };

  const refreshUsers = async () => {
    await initAuth();
  };

  const isAuthenticated = Boolean(currentUser && (token || currentUser.id));

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      allUsers, 
      isAuthenticated,
      token,
      login, 
      logout, 
      switchUser, 
      loading, 
      error, 
      refreshUsers 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
};
