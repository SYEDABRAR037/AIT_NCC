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

const API_BASE = import.meta.env.VITE_API_BASE_URL ? (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, '') : '';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('ncc_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ncc_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ncc_auth_token');
      if (storedToken) {
        if (storedToken.startsWith('mock_jwt_')) {
          // Cloud preview mock session: verify stored user
          try {
            const savedUser = localStorage.getItem('ncc_current_user');
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            }
          } catch (e) {
            console.warn('Mock session restore error:', e);
          }
          setIsLoading(false);
          return;
        }

        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (res.ok && data.success && data.user) {
              setUser(data.user);
              localStorage.setItem('ncc_current_user', JSON.stringify(data.user));
              setIsLoading(false);
              return;
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
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
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
      console.warn('Backend server offline or unreachable. Engaging cloud preview authentication:', err);

      const cleanId = identifier.trim().toLowerCase();

      // 1. Check local registered cadets
      try {
        const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
        const foundCadet = offlineCadets.find(
          (c: any) =>
            c.email?.toLowerCase() === cleanId ||
            c.regimentalNumber?.toLowerCase() === cleanId ||
            c.collegeRollNumber?.toLowerCase() === cleanId
        );

        if (foundCadet) {
          if (foundCadet.password !== password) {
            return { success: false, message: 'Invalid institutional credentials.' };
          }
          if (foundCadet.status === 'UNDER_REVIEW') {
            return {
              success: false,
              status: 'UNDER_REVIEW',
              message: 'Your registration is currently under review by your Senior and ANO.',
            };
          }
          if (foundCadet.status === 'HOLD') {
            return {
              success: false,
              status: 'HOLD',
              message: 'Your registration is on hold pending institutional review.',
            };
          }
          if (foundCadet.status === 'REJECTED') {
            return {
              success: false,
              status: 'REJECTED',
              message: 'Your registration has been rejected. Please contact NCC administration.',
            };
          }

          // Cadet is APPROVED or ACTIVE
          const cadetUser: UserProfile = {
            id: foundCadet.id,
            fullName: foundCadet.fullName,
            regimentalNumber: foundCadet.regimentalNumber,
            collegeRollNumber: foundCadet.collegeRollNumber,
            email: foundCadet.email,
            phone: foundCadet.phone,
            year: foundCadet.year,
            branch: foundCadet.branch,
            platoonName: foundCadet.platoonName || 'Senior Division',
            role: 'CADET',
            status: foundCadet.status || 'APPROVED',
            profilePhotoUrl: foundCadet.photoSnapshot || null,
          };
          const mockToken = 'mock_jwt_cadet_' + Date.now();
          localStorage.setItem('ncc_auth_token', mockToken);
          localStorage.setItem('token', mockToken);
          localStorage.setItem('ncc_current_user', JSON.stringify(cadetUser));
          setToken(mockToken);
          setUser(cadetUser);
          return { success: true, message: 'Authentication successful. Command clearance granted.', user: cadetUser };
        }
      } catch (e) {
        console.error('Error reading offline cadets:', e);
      }

      // 2. Check Leadership Institutional Demo Accounts
      const leadershipAccounts: Record<string, { role: 'ADMIN_ANO' | 'PLATOON_SENIOR' | 'SENIOR'; name: string; pass: string; platoon?: string }> = {
        'ano.admin@aitpune.edu.in': { role: 'ADMIN_ANO', name: 'Lt. Col. Sanjeev Sharma (ANO)', pass: 'AdminCommand@2026' },
        'platoon.senior@aitpune.edu.in': { role: 'PLATOON_SENIOR', name: 'JUO Aditya Pratap Singh', pass: 'PlatoonLead@2026', platoon: 'Alpha Platoon' },
        'senior.cadet@aitpune.edu.in': { role: 'SENIOR', name: 'SUO Rajesh Nair', pass: 'SeniorCadet@2026', platoon: 'Alpha Platoon' },
      };

      const leader = leadershipAccounts[cleanId];
      if (leader && leader.pass === password) {
        const leaderUser: UserProfile = {
          id: 'leader-' + leader.role.toLowerCase(),
          fullName: leader.name,
          regimentalNumber: 'LEAD-' + leader.role,
          collegeRollNumber: 'AIT-LEAD-01',
          email: cleanId,
          role: leader.role,
          status: 'ACTIVE',
          platoonName: leader.platoon || 'Alpha Platoon',
        };
        const mockToken = 'mock_jwt_' + leader.role.toLowerCase() + '_' + Date.now();
        localStorage.setItem('ncc_auth_token', mockToken);
        localStorage.setItem('token', mockToken);
        localStorage.setItem('ncc_current_user', JSON.stringify(leaderUser));
        setToken(mockToken);
        setUser(leaderUser);
        return { success: true, message: 'Authentication successful. Command clearance granted.', user: leaderUser };
      }

      return { success: false, message: 'Invalid institutional credentials.' };
    }
  };

  const registerCadet = async (formData: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
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
      }
      // If server returned HTML (Netlify static SPA fallback)
      throw new Error('Non-JSON response from server');
    } catch (err: any) {
      console.warn('Backend server offline or unreachable. Registering in cloud preview queue:', err);

      try {
        const offlineCadets: any[] = JSON.parse(localStorage.getItem('ncc_offline_cadets') || '[]');
        const cleanEmail = formData.email?.trim().toLowerCase();
        const cleanReg = formData.regimentalNumber?.trim().toUpperCase();
        const cleanRoll = formData.collegeRollNumber?.trim().toUpperCase();

        if (offlineCadets.some((c: any) => c.email?.toLowerCase() === cleanEmail)) {
          return { success: false, field: 'email', message: 'This email is already registered.' };
        }
        if (offlineCadets.some((c: any) => c.regimentalNumber?.toUpperCase() === cleanReg)) {
          return { success: false, field: 'regimentalNumber', message: 'This regimental number is already registered.' };
        }
        if (offlineCadets.some((c: any) => c.collegeRollNumber?.toUpperCase() === cleanRoll)) {
          return { success: false, field: 'collegeRollNumber', message: 'This college roll number is already registered.' };
        }

        const newCadet = {
          id: 'cadet-' + Date.now(),
          fullName: formData.fullName,
          regimentalNumber: cleanReg,
          collegeRollNumber: cleanRoll,
          email: cleanEmail,
          phone: formData.phone || null,
          year: formData.year || 'FE (1st Year)',
          branch: formData.branch || 'Computer Engineering',
          platoonName: formData.platoon || 'Senior Division',
          enrollmentDetails: formData.enrollmentDetails || null,
          dateOfJoining: formData.dateOfJoining || new Date().toISOString().split('T')[0],
          role: 'CADET',
          status: 'UNDER_REVIEW',
          password: formData.password,
          createdAt: new Date().toISOString(),
          photoSnapshot: formData.photoSnapshot || null,
          faceDescriptor: formData.faceDescriptor || null,
        };

        offlineCadets.push(newCadet);
        localStorage.setItem('ncc_offline_cadets', JSON.stringify(offlineCadets));

        return {
          success: true,
          message: 'Registration submitted successfully! Your application has been filed in the institutional queue.',
        };
      } catch (localErr) {
        return { success: false, message: 'Institutional registration error. Please try again.' };
      }
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
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

  const setUserFromSession = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('ncc_current_user', JSON.stringify(profile));
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
