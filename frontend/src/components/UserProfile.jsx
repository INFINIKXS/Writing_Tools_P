import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, CreditCard, LogOut, Shield, Award, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UserProfile({ activeTab, onNavigate }) {
  const { user, isAuthenticated, displayName, initials, isPremium, signOut, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLinkClick = (tabId) => {
    setIsOpen(false);
    if (onNavigate) onNavigate(tabId);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  /* ── Not logged in: show Sign In button ── */
  if (!isAuthenticated) {
    return (
      <button
        onClick={() => openAuthModal('login')}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white bg-slate-200/80 dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 transition-all duration-200"
      >
        <LogIn size={14} className="text-amber-500" />
        <span>Sign In</span>
      </button>
    );
  }

  /* ── Logged in: show Avatar & Dropdown Menu ── */
  const avatarLabel = initials || (user?.email?.[0]?.toUpperCase() ?? 'U');
  const emailDisplay = user?.email ?? '';
  const nameDisplay = displayName ?? emailDisplay;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border transition-all duration-200 active:scale-95 ${
          isOpen
            ? 'bg-slate-200 dark:bg-white/10 border-slate-300 dark:border-white/20 shadow-md'
            : 'bg-white/80 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
        }`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-none ${
          isPremium
            ? 'bg-gradient-to-br from-amber-500 to-yellow-400 text-black shadow-[0_0_8px_rgba(212,175,55,0.4)]'
            : 'bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300'
        }`}>
          {avatarLabel}
        </div>
        <span className="text-xs font-semibold text-slate-800 dark:text-neutral-200 max-w-[100px] truncate hidden sm:inline">
          {nameDisplay}
        </span>
      </button>

      {/* Dropdown Menu Card */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 glass-card-static bg-white dark:bg-[#080808]/95 border border-slate-200 dark:border-neutral-900 shadow-xl rounded-xl py-4 z-[999] animate-fade-in-up">
          {/* User Header */}
          <div className="px-4 pb-3 border-b border-slate-200 dark:border-neutral-900/60 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-none ${
              isPremium
                ? 'bg-gradient-to-br from-amber-500 to-yellow-400 text-black shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                : 'bg-slate-200 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300'
            }`}>
              {avatarLabel}
            </div>
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{nameDisplay}</p>
              <p className="text-slate-500 dark:text-neutral-500 text-[10px] truncate">{emailDisplay}</p>
            </div>
          </div>

          {/* Plan Badge */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-950/40 border-b border-slate-200 dark:border-neutral-900/60 flex items-center justify-between">
            <span className="text-slate-500 dark:text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Plan Status</span>
            {isPremium ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                <Award size={10} className="fill-current" />
                Premium
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-slate-200/80 dark:bg-white/5 text-slate-600 dark:text-neutral-400 px-2 py-0.5 rounded border border-slate-300 dark:border-white/5">
                Free Tier
              </span>
            )}
          </div>

          {/* Menu Items */}
          <div className="px-2 pt-2 space-y-1 text-left">
            <button
              onClick={() => handleLinkClick('premium')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'premium'
                  ? 'bg-slate-200/80 dark:bg-white/5 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <CreditCard size={14} className={isPremium ? 'text-amber-500 dark:text-amber-400' : ''} />
              <span>Subscription details</span>
            </button>

            <button
              onClick={() => handleLinkClick('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-200/80 dark:bg-white/5 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Settings size={14} />
              <span>Usage &amp; settings</span>
            </button>

            <button
              onClick={() => handleLinkClick('terms')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'terms'
                  ? 'bg-slate-200/80 dark:bg-white/5 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Shield size={14} />
              <span>Terms of service</span>
            </button>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-neutral-900/60 my-2" />

          {/* Sign Out */}
          <div className="px-2 text-left">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400/80 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
