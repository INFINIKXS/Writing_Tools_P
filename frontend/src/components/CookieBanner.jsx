import React, { useState, useEffect } from 'react';
import { Cookie, Shield, Check, X, Settings } from 'lucide-react';

const STORAGE_KEY = 'wt_cookie_consent';

export default function CookieBanner({ onOpenPreferences, onNavigate }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if consent has already been given/saved
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      // Small delay on first load for smooth entrance
      const timer = setTimeout(() => setShowBanner(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showBanner) return null;

  const handleAcceptAll = () => {
    const all = { analytics: true, functional: true, advertising: true, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setShowBanner(false);
  };

  const handleRejectOptional = () => {
    const essentialOnly = { analytics: false, functional: false, advertising: false, timestamp: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialOnly));
    setShowBanner(false);
  };

  const handleManage = () => {
    setShowBanner(false);
    if (onOpenPreferences) {
      onOpenPreferences();
    }
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-lg z-[9990] animate-fade-in-up"
    >
      <div className="bg-[#0f0f11]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)_inset] flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-none">
              <Cookie size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">We value your privacy</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">Essential cookies are always active.</p>
            </div>
          </div>
          <button
            onClick={handleRejectOptional}
            title="Dismiss / Reject optional cookies"
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <p className="text-xs text-neutral-300 leading-relaxed">
          WritingTools uses essential cookies for core security, session authentication, and tool state. We also offer optional cookies to analyze performance and personalize your workspace preferences.{' '}
          {onNavigate && (
            <button
              onClick={() => { setShowBanner(false); onNavigate('cookie_policy'); }}
              className="text-amber-400 hover:underline font-medium text-xs"
            >
              Learn more in our Cookie Policy
            </button>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <button
            onClick={handleAcceptAll}
            className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> Accept All
          </button>

          <button
            onClick={handleRejectOptional}
            className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            Reject Optional
          </button>

          <button
            onClick={handleManage}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 font-medium text-xs transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            <Settings size={14} /> Customize
          </button>
        </div>

      </div>
    </div>
  );
}
