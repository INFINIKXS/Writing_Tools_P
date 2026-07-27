import React, { useState, useEffect } from 'react';
import { X, Cookie, Shield, ChevronDown, ChevronUp, CheckCircle2, Info } from 'lucide-react';

/* ─── Cookie Category Data ─────────────────────────────────────────── */
const CATEGORIES = [
  {
    id: 'essential',
    label: 'Essential Cookies',
    description:
      'Required for core app functionality — session management, authentication, tool state persistence (e.g. citation style, PDF editor preferences). These cannot be disabled.',
    alwaysActive: true,
    examples: ['session_id', 'auth_token', 'citation_style', '__cf_bm'],
  },
  {
    id: 'analytics',
    label: 'Analytics Cookies',
    description:
      'Help us understand how you use WritingTools — which tools are most useful, feature performance, and how we can improve. Data is aggregated and anonymised.',
    alwaysActive: false,
    examples: ['_ga', '_ga_XXXXXXX', 'amplitude_session', '_clck'],
  },
  {
    id: 'functional',
    label: 'Functional Cookies',
    description:
      'Remember your preferences across sessions — preferred citation format (APA/Harvard/Vancouver), sidebar layout, PDF editor zoom level, and interface language.',
    alwaysActive: false,
    examples: ['pdf_editor_prefs', 'style_analyser_prefs', 'language_pref'],
  },
  {
    id: 'advertising',
    label: 'Advertising Cookies',
    description:
      'Used to show you relevant offers, including Premium upgrade prompts. May include third-party retargeting cookies from our advertising partners.',
    alwaysActive: false,
    examples: ['_gcl_au', '_ttp', '_rdt_uuid', '_uetsid'],
  },
];

const STORAGE_KEY = 'wt_cookie_consent';

function loadConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { analytics: false, functional: false, advertising: false };
}

function saveConsent(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/* ─── Toggle component ──────────────────────────────────────────────── */
function Toggle({ enabled, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={disabled ? true : enabled}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
        disabled
          ? 'bg-emerald-500/30 cursor-not-allowed'
          : enabled
          ? 'bg-amber-500'
          : 'bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          disabled || enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ─── Single category row ───────────────────────────────────────────── */
function CategoryRow({ category, enabled, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="shrink-0 border border-slate-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/30 rounded-2xl overflow-hidden transition-colors duration-200 hover:border-slate-300 dark:hover:border-neutral-700 shadow-sm hover:shadow-md">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => setExpanded(o => !o)}
          className="flex-1 flex items-center gap-2 text-left min-w-0 group"
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors truncate">
            {category.label}
          </span>
          <span className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300 transition-colors flex-none">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {category.alwaysActive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-none">
            <CheckCircle2 size={14} />
            Always Active
          </span>
        ) : (
          <Toggle enabled={enabled} onToggle={onToggle} disabled={false} />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-neutral-800 pt-3 flex flex-col gap-3">
          <p className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed">{category.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {category.examples.map(ex => (
              <span
                key={ex}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono text-violet-700 dark:text-violet-300"
              >
                {ex}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-500 dark:text-neutral-400 italic">
              + more
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main modal ────────────────────────────────────────────────────── */
export default function CookiePreferenceModal({ isOpen, onClose, onNavigate }) {
  const [prefs, setPrefs] = useState(loadConsent);
  const [saved, setSaved] = useState(false);

  // Reset saved indicator when modal reopens
  useEffect(() => { if (isOpen) setSaved(false); }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (id) =>
    setPrefs(p => ({ ...p, [id]: !p[id] }));

  const handleAcceptAll = () => {
    const all = { analytics: true, functional: true, advertising: true };
    setPrefs(all);
    saveConsent(all);
    setSaved(true);
    setTimeout(onClose, 800);
  };

  const handleRejectAll = () => {
    const none = { analytics: false, functional: false, advertising: false };
    setPrefs(none);
    saveConsent(none);
    setSaved(true);
    setTimeout(onClose, 800);
  };

  const handleSave = () => {
    saveConsent(prefs);
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[9998]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preference centre"
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:justify-end pointer-events-none px-0 sm:px-6 pb-0 sm:pb-6"
      >
        <div className="pointer-events-auto w-full sm:w-[440px] max-h-[92dvh] sm:max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white shadow-2xl overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-200 dark:border-neutral-800 flex-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-none">
                <Cookie size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Privacy Preference Centre</h2>
                <p className="text-xs text-slate-600 dark:text-neutral-400 mt-0.5">WritingTools · Paradox-Labs</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900 transition-all flex-none mt-0.5"
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Intro ── */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex-none bg-slate-50 dark:bg-neutral-900/30">
            <p className="text-xs text-slate-800 dark:text-neutral-200 leading-relaxed">
              WritingTools uses cookies to deliver core features (Citation Manager, PDF Editor, AI analysers)
              and to improve your experience. Optional cookies are enabled only with your consent, which you can
              withdraw at any time.{' '}
              {onNavigate && (
                <button
                  onClick={() => { onClose(); onNavigate('cookie_policy'); }}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  Cookie Policy
                </button>
              )}
            </p>
          </div>

          {/* ── Categories (scrollable) ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 min-h-0">
            <p className="shrink-0 text-[10px] text-slate-600 dark:text-neutral-400 uppercase tracking-widest font-bold pb-2">
              Manage Consent Preferences
            </p>

            {CATEGORIES.map(cat => (
              <CategoryRow
                key={cat.id}
                category={cat}
                enabled={cat.alwaysActive || prefs[cat.id]}
                onToggle={() => toggle(cat.id)}
              />
            ))}

            {/* Info note */}
            <div className="shrink-0 flex items-start gap-2.5 px-3.5 py-3 rounded-2xl bg-blue-50 dark:bg-neutral-900/40 border border-blue-100 dark:border-neutral-800 mt-1">
              <Info size={14} className="text-blue-500 dark:text-blue-400 flex-none mt-0.5" />
              <p className="text-[11px] text-slate-700 dark:text-neutral-300 leading-relaxed">
                Even if you decline optional cookies, you will still see Premium upgrade prompts within the app.
                Declining advertising cookies means they will not be personalised to your behaviour.
              </p>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="px-6 py-5 border-t border-slate-200 dark:border-neutral-800 flex-none bg-white dark:bg-neutral-950">

            {/* Secondary actions */}
            <div className="flex gap-2.5 mb-3">
              <button
                onClick={handleRejectAll}
                className="flex-1 py-2.5 text-xs font-bold bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-2xl transition-all duration-200"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 py-2.5 text-xs font-bold bg-slate-100 dark:bg-neutral-900 hover:bg-slate-200 dark:hover:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white rounded-2xl transition-all duration-200"
              >
                Accept All
              </button>
            </div>

            {/* Primary save */}
            <button
              onClick={handleSave}
              className={`w-full py-3.5 rounded-2xl text-sm font-black tracking-wide transition-all duration-300 ${
                saved
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25'
              }`}
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> Preferences Saved
                </span>
              ) : (
                'Save and Close'
              )}
            </button>

            {/* Powered by */}
            <div className="flex items-center justify-center gap-1.5 mt-3.5">
              <Shield size={12} className="text-slate-500 dark:text-neutral-400" />
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-semibold tracking-wide">
                Powered by WritingTools Privacy
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
