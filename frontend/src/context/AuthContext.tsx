import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/api';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ncc_auth_token') || localStorage.getItem('token');
      if (storedToken) {
        const apiBase = getApiBaseUrl();
        try {
          const res = await fetch(`${apiBase}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (res.ok && data.success && data.user) {
              setUser(data.user);
              setToken(storedToken);
              localStorage.setItem('ncc_current_user', JSON.stringify(data.user));
              setIsLoading(false);
              return;
            } else if (res.status === 401) {
              // Token expired or invalid on backend
              localStorage.removeItem('ncc_auth_token');
              localStorage.removeItem('token');
              localStorage.removeItem('ncc_current_user');
              setToken(null);
              setUser(null);
            }
          }
        } catch (err) {
          console.warn('Session verification fallback:', err);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('ncc_auth_token', data.token);
          localStorage.setItem('token', data.token);
          localStorage.setItem('ncc_current_user', JSON.stringify(data.user));
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
      }
      // If server returned HTML (static host preview like Netlify before backend is configured)
      throw new Error('Non-JSON response from server');
    } catch (err: any) {
      if (apiBase) {
        return { success: false, message: err.message || 'Authentication server communication failed.' };
      }
      console.error('Authentication server communication error:', err);
      return { success: false, message: 'Authentication service is unavailable. Please try again when connected.' };
    }
  };

  const registerCadet = async (formData: any) => {
    const apiBase = getApiBaseUrl();
    try {
      const res = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          return {
            success: true,
            message: data.message,
            profilePhotoSaved: data.profilePhotoSaved,
            biometricEnrolled: data.biometricEnrolled,
          };
        } else {
          return {
            success: false,
            field: data.field,
            message: data.message || 'Registration failed.',
          };
        }
      }
      throw new Error('Institutional server returned an invalid response.');
    } catch (err: any) {
      console.error('Registration server communication error:', err);
      return {
        success: false,
        message: err.message || 'Institutional registration service unavailable. Please try again.',
      };
    }
  };

  const logout = async () => {
    const apiBase = getApiBaseUrl();
    try {
      await fetch(`${apiBase}/api/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.warn('Logout fallback:', err);
    } finally {
      localStorage.removeItem('ncc_auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('ncc_current_user');
      setToken(null);
      setUser(null);
    }
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
