import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, authService } from '../services/auth.service';
import { socketService } from '../services/socket.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pw: string, remember?: boolean) => Promise<User>;
  registerCustomer: (email: string, pw: string, pw2?: string) => Promise<User>;
  registerOrg: (form: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const current = await authService.getMe();
      setUser(current);
      if (current) {
        socketService.connect();
        if (current.orgId) {
          socketService.joinOrganization(current.orgId);
        }
        if (current.serviceId) {
          socketService.joinService(current.serviceId);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pw: string, remember = false) => {
    const u = await authService.login(email, pw, remember);
    setUser(u);
    socketService.connect();
    if (u.orgId) {
      socketService.joinOrganization(u.orgId);
    }
    if (u.serviceId) {
      socketService.joinService(u.serviceId);
    }
    return u;
  };

  const registerCustomer = async (email: string, pw: string, pw2?: string) => {
    const u = await authService.registerCustomer(email, pw, pw2);
    setUser(u);
    socketService.connect();
    return u;
  };

  const registerOrg = async (form: any) => {
    const org = await authService.registerOrg(form);
    await refreshUser();
    return org;
  };

  const logout = async () => {
    await authService.logout();
    socketService.disconnect();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        registerCustomer,
        registerOrg,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
