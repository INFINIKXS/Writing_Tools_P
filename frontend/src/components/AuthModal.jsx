import React, { useState, useEffect, useRef } from 'react';
import {
  X, Mail, Lock, Eye, EyeOff, User, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, Shield, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ─── Password strength ───────────────────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}

const STRENGTH_LABELS = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const STRENGTH_COLORS = [
  '',
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-emerald-500',
  'bg-emerald-400',
];

function PasswordStrengthBar({ password }) {
  const score = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? STRENGTH_COLORS[score] : 'bg-slate-200 dark:bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${score <= 2 ? 'text-red-500 dark:text-red-400' : score <= 3 ? 'text-amber-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {STRENGTH_LABELS[score]}
      </p>
    </div>
  );
}

/* ─── Input Field ─────────────────────────────────────────────────── */
function AuthInput({ icon: Icon, type = 'text', placeholder, value, onChange, rightSlot, autoComplete }) {
  return (
    <div className="relative flex items-center">
      <Icon size={16} className="absolute left-3.5 text-slate-400 dark:text-neutral-500 pointer-events-none" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="w-full bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-600 focus:bg-white dark:focus:bg-black focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl px-10 py-3 text-sm outline-none transition-all duration-200"
      />
      {rightSlot && (
        <div className="absolute right-3.5 flex items-center">{rightSlot}</div>
      )}
    </div>
  );
}

/* ─── Social Login Button ─────────────────────────────────────────── */
function SocialButton({ provider, onClick, disabled }) {
  const config = {
    google: {
      label: 'Continue with Google',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-none" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
    },
    github: {
      label: 'Continue with GitHub',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-none fill-current text-slate-800 dark:text-white">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      ),
    },
  };

  const { label, icon } = config[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-2.5 bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200/80 dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-white font-bold rounded-2xl py-3 transition-all duration-200 text-xs disabled:opacity-40 disabled:pointer-events-none"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{provider === 'google' ? 'Google' : 'GitHub'}</span>
    </button>
  );
}

/* ─── Main Auth Modal ─────────────────────────────────────────────── */
export default function AuthModal() {
  const {
    authModalOpen, authMode, setAuthMode,
    error, successMessage,
    signIn, signUp, signInWithOAuth, resetPassword,
    closeAuthModal, clearError,
    isSupabaseConfigured,
  } = useAuth();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [fullName, setFullName]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [remember, setRemember]     = useState(true);
  const [agreed, setAgreed]         = useState(false);
  const [busy, setBusy]             = useState(false);

  const firstInputRef = useRef(null);

  // Reset form when mode changes
  useEffect(() => {
    setEmail(''); setPassword(''); setFullName('');
    setShowPass(false); setBusy(false);
    clearError();
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [authMode, clearError]);

  // ESC to close
  useEffect(() => {
    if (!authModalOpen) return;
    const handler = (e) => { if (e.key === 'Escape') closeAuthModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  /* ── Submit handlers ── */
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await signIn({ email, password });
    setBusy(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!agreed) { return; }
    if (getPasswordStrength(password) < 2) { return; }
    setBusy(true);
    await signUp({ email, password, fullName });
    setBusy(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await resetPassword(email);
    setBusy(false);
  };

  const handleOAuth = (provider) => {
    signInWithOAuth(provider);
  };

  /* ── Shared divider ── */
  const Divider = () => (
    <div className="relative flex items-center justify-center my-2">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200 dark:border-neutral-800" />
      </div>
      <div className="relative px-3 bg-white dark:bg-neutral-950 text-slate-400 dark:text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
        OR
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={closeAuthModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in or create account"
        className="bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white shadow-2xl rounded-3xl p-6 md:p-8 w-full max-w-md relative overflow-hidden flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {authMode === 'forgot_password' ? (
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-none">
                <Shield size={20} />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {authMode === 'login' && 'Welcome back'}
                {authMode === 'signup' && 'Create your account'}
                {authMode === 'forgot_password' && 'Reset your password'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-neutral-400 mt-0.5">WritingTools · Paradox-Labs</p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tab switcher (Login / Signup only) ── */}
        {authMode !== 'forgot_password' && (
          <div className="flex gap-1.5 p-1.5 bg-slate-100 dark:bg-neutral-900/80 rounded-2xl border border-slate-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2.5 text-xs rounded-xl transition-all duration-200 ${
                authMode === 'login'
                  ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white font-bold shadow-sm border border-slate-200 dark:border-white/10'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2.5 text-xs rounded-xl transition-all duration-200 ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white font-bold shadow-sm border border-slate-200 dark:border-white/10'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[70dvh] pr-0.5">

          {/* Demo mode notice */}
          {!isSupabaseConfigured && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <Sparkles size={14} className="text-amber-500 dark:text-amber-400 flex-none mt-0.5" />
              <p className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed">
                <strong className="text-slate-900 dark:text-amber-300 font-bold">Demo Mode</strong> — No Supabase credentials configured.
                Auth flows work locally via localStorage. Add{' '}
                <code className="font-mono text-amber-600 dark:text-amber-400">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-amber-600 dark:text-amber-400">VITE_SUPABASE_ANON_KEY</code> to enable live auth.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-500 dark:text-red-400 flex-none mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400 flex-none mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{successMessage}</p>
            </div>
          )}

          {/* ══ SIGN IN FORM ══ */}
          {authMode === 'login' && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3.5">
              <AuthInput
                icon={Mail}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <AuthInput
                icon={Lock}
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              {/* Forgot + remember row */}
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 text-amber-500 border-slate-300 dark:border-neutral-700 rounded focus:ring-amber-500/20"
                  />
                  <span className="text-slate-700 dark:text-neutral-300 text-xs font-semibold">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAuthMode('forgot_password')}
                  className="text-amber-600 dark:text-amber-400 hover:underline text-xs font-bold"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || !email || !password}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wide shadow-lg shadow-amber-500/25 rounded-2xl py-3.5 text-sm transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {busy ? 'Signing in…' : 'Sign In'}
              </button>

              <Divider />

              <div className="flex gap-2.5">
                <SocialButton provider="google" onClick={() => handleOAuth('google')} disabled={busy} />
                <SocialButton provider="github" onClick={() => handleOAuth('github')} disabled={busy} />
              </div>
            </form>
          )}

          {/* ══ SIGN UP FORM ══ */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-3.5">
              <AuthInput
                icon={User}
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              <AuthInput
                icon={Mail}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <div className="flex flex-col gap-1">
                <AuthInput
                  icon={Lock}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <PasswordStrengthBar password={password} />
              </div>

              {/* Terms agreement */}
              <label className="flex items-start gap-2.5 cursor-pointer group mt-1 px-1">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-amber-500 border-slate-300 dark:border-neutral-700 rounded focus:ring-amber-500/20 flex-none"
                />
                <span className="text-slate-700 dark:text-neutral-300 text-xs font-semibold leading-relaxed">
                  I agree to the{' '}
                  <span className="text-amber-600 dark:text-amber-400 hover:underline">Terms of Service</span> and{' '}
                  <span className="text-amber-600 dark:text-amber-400 hover:underline">Privacy Policy</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={busy || !email || !password || !fullName || !agreed || getPasswordStrength(password) < 2}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wide shadow-lg shadow-amber-500/25 rounded-2xl py-3.5 text-sm transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {busy ? 'Creating account…' : 'Create Account'}
              </button>

              <Divider />

              <div className="flex gap-2.5">
                <SocialButton provider="google" onClick={() => handleOAuth('google')} disabled={busy} />
                <SocialButton provider="github" onClick={() => handleOAuth('github')} disabled={busy} />
              </div>
            </form>
          )}

          {/* ══ FORGOT PASSWORD ══ */}
          {authMode === 'forgot_password' && (
            <form onSubmit={handleReset} className="flex flex-col gap-3.5">
              <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed px-1">
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </p>
              <AuthInput
                icon={Mail}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={busy || !email}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wide shadow-lg shadow-amber-500/25 rounded-2xl py-3.5 text-sm transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {busy ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors text-center font-medium"
              >
                Back to Sign In
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
