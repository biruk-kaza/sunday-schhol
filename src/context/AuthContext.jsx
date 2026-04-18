import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const metadata = user?.user_metadata || {};
  const assignedGrade = metadata.assigned_grade || null;
  const assignedMode = metadata.assigned_mode || 'both'; // 'weekday', 'weekend', 'both'
  const role = metadata.role || 'teacher';
  const isAdmin = role === 'admin';

  const value = {
    session,
    user,
    role,
    assignedGrade,
    assignedMode,
    isAdmin,
    loading,
    // Helper: can this user see the weekend tab?
    canSeeWeekend: isAdmin || assignedMode === 'weekend' || assignedMode === 'both',
    // Helper: can this user see the weekday tab?
    canSeeWeekday: isAdmin || assignedMode === 'weekday' || assignedMode === 'both',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
