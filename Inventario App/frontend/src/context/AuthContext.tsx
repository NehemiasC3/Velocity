import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  switchUser: (userId: string) => void;
  loading: boolean;
  error: Error | null;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUsers();
      setAllUsers(res.users);

      // Default to admin or saved user in localStorage
      const savedId = localStorage.getItem('isp_active_user_id') || 'usr-admin-1';
      const found = res.users.find(u => u.id === savedId) || res.users[0];
      
      if (found) {
        setCurrentUser(found);
        api.setActiveUserId(found.id);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError(err as Error);
      setCurrentUser(null);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const switchUser = (userId: string) => {
    const found = allUsers.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      api.setActiveUserId(found.id);
      localStorage.setItem('isp_active_user_id', found.id);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, allUsers, switchUser, loading, error, refreshUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
};
