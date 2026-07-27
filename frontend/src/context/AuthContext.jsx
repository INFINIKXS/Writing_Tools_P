import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/* ─── Demo mode helpers ──────────────────────────────────────────────── */
const DEMO_USER_KEY = 'wt_demo_user';

function loadDemoUser() {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDemoUser(user) {
  if (user) localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(DEMO_USER_KEY);
}

/* ─── Context ────────────────────────────────────────────────────────── */
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/* ─── Provider ───────────────────────────────────────────────────────── */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'forgot_password'
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  /* ── Bootstrap: real Supabase session or demo user ── */
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode: restore demo user from localStorage
      const demoUser = loadDemoUser();
      setUser(demoUser);
      setLoading(false);
      return;
    }

    // Real Supabase session bootstrap
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* ── Helpers ── */
  const clearError = useCallback(() => setError(null), []);
  const clearSuccess = useCallback(() => setSuccessMessage(null), []);

  const openAuthModal = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setError(null);
    setSuccessMessage(null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setError(null);
    setSuccessMessage(null);
  }, []);

  /* ── Sign Up ── */
  const signUp = useCallback(async ({ email, password, fullName }) => {
    setError(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      // Demo mode
      const demoUser = {
        id: crypto.randomUUID(),
        email,
        user_metadata: { full_name: fullName },
        demo: true,
        created_at: new Date().toISOString(),
      };
      saveDemoUser(demoUser);
      setUser(demoUser);
      setSuccessMessage('Demo account created! (No Supabase configured)');
      setTimeout(closeAuthModal, 1200);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    if (data.user && !data.session) {
      // Email confirmation required
      setSuccessMessage('Check your email to confirm your account before signing in.');
    } else {
      closeAuthModal();
    }

    return { error: null };
  }, [closeAuthModal]);

  /* ── Sign In ── */
  const signIn = useCallback(async ({ email, password }) => {
    setError(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      // Demo mode
      const demoUser = {
        id: crypto.randomUUID(),
        email,
        user_metadata: { full_name: email.split('@')[0] },
        demo: true,
        created_at: new Date().toISOString(),
      };
      saveDemoUser(demoUser);
      setUser(demoUser);
      closeAuthModal();
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return { error };
    }

    closeAuthModal();
    return { error: null };
  }, [closeAuthModal]);

  /* ── OAuth ── */
  const signInWithOAuth = useCallback(async (provider) => {
    setError(null);

    if (!isSupabaseConfigured) {
      setError('OAuth requires a configured Supabase project. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });

    if (error) setError(error.message);
  }, []);

  /* ── Sign Out ── */
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      saveDemoUser(null);
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  }, []);

  /* ── Reset Password ── */
  const resetPassword = useCallback(async (email) => {
    setError(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured) {
      setSuccessMessage('Password reset email sent! (Demo mode — no email actually sent)');
      return { error: null };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset_password=true`,
    });

    if (error) {
      setError(error.message);
      return { error };
    }

    setSuccessMessage('Password reset link sent! Check your inbox.');
    return { error: null };
  }, []);

  /* ── Derived helpers ── */
  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    null;

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  const value = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    displayName,
    initials,
    isPremium: user?.user_metadata?.is_premium === true,
    authModalOpen,
    authMode,
    error,
    successMessage,
    isSupabaseConfigured,
    // methods
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resetPassword,
    openAuthModal,
    closeAuthModal,
    setAuthMode,
    clearError,
    clearSuccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
