import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  fullName: string;
  regimentalNumber: string;
  collegeRollNumber: string;
  email: string;
  phone?: string | null;
  year?: string;
  branch?: string;
  platoonName?: string;
  role: 'ADMIN_ANO' | 'PLATOON_SENIOR' | 'SENIOR' | 'CADET';
  status: 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'HOLD' | 'REJECTED' | 'INACTIVE' | 'PASSED_OUT';
  profilePhotoUrl?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string; status?: string; user?: UserProfile }>;
  registerCadet: (data: any) => Promise<{ success: boolean; message?: string; field?: string }>;
  logout: () => Promise<void>;
  setUserFromSession: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ncc_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ncc_auth_token');
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem('ncc_auth_token');
            setToken(null);
            setUser(null);
          }
        } catch (err) {
          console.error('Session verification error:', err);
          localStorage.removeItem('ncc_auth_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('ncc_auth_token', data.token);
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, message: data.message, user: data.user };
      } else {
        return {
          success: false,
          status: data.status,
          message: data.message || 'Authentication failed.',
        };
      }
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, message: 'Server connection error. Please try again.' };
    }
  };

  const registerCadet = async (formData: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message };
      } else {
        return {
          success: false,
          field: data.field,
          message: data.message || 'Registration failed.',
        };
      }
    } catch (err: any) {
      console.error('Register error:', err);
      return { success: false, message: 'Server connection error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('ncc_auth_token');
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const setUserFromSession = (profile: UserProfile) => {
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        registerCadet,
        logout,
        setUserFromSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
