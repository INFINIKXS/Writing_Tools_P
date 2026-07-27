import React, { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, ExternalLink, Cookie, ArrowLeft } from 'lucide-react';
import Footer from './Footer';

const EFFECTIVE_DATE = 'July 25, 2026';
const COMPANY_NAME = 'WritingTools';
const APP_URL = 'writingtools.app'; // update if you have a real domain

const sections = [
  {
    id: 'background',
    title: 'Background',
    content: `${COMPANY_NAME} and our third-party service providers use cookies and similar technologies such as local storage, session storage, and pixel tags (collectively, "Cookies") for a variety of purposes. We use Cookies to enable our servers to recognise your browser, understand how and when you visit and use our Services, analyse trends, and improve your experience. Cookies are small pieces of data placed on your computer, tablet, phone, or similar device when you access our Services.`,
  },
  {
    id: 'types',
    title: 'Types of Cookies We Use',
    content: null,
    subsections: [
      {
        label: 'Essential Cookies',
        description:
          'Required for providing core features you have requested. For example, these cookies remember your session state, authentication status, and tool preferences (e.g., active citation style, PDF editor state). Without them, the app cannot function correctly.',
      },
      {
        label: 'Functional Cookies',
        description:
          'Used to record your choices and settings, maintain your preferences over time, and recognise you when you return. Examples include your preferred citation format (APA, Harvard, Vancouver), dark/light mode setting, and whether the sidebar is pinned.',
      },
      {
        label: 'Analytics Cookies',
        description:
          'Allow us to understand how visitors use our Services — which tools are used most, how long users spend on the PDF Editor or Depth & Breadth Analyser, and how our features perform. This data is aggregated and anonymised to guide product improvements.',
      },
      {
        label: 'Advertising Cookies',
        description:
          'Collect data about your online activity and identify your interests so that we can present relevant offers or upgrade prompts. These may include retargeting cookies from third-party advertising partners.',
      },
    ],
  },
  {
    id: 'interest-based',
    title: 'Interest-Based Advertising',
    content: `${COMPANY_NAME} may work with third-party ad networks and analytics providers to serve contextual or interest-based advertisements and to improve the relevance of Premium upgrade prompts. These third parties may deliver cookies or web beacons through our Services to enable anonymised auditing, reporting, and targeted advertising on other websites you visit. Web beacons allow ad networks to view, edit, or set their own cookies on your browser as if you had visited their site directly.`,
  },
  {
    id: 'manage-outside-eea',
    title: 'How to Manage Cookies — General',
    content: `You can control or delete cookies through your internet browser settings. Most browsers let you block new cookies, delete existing ones, or choose acceptance on a case-by-case basis. Note that disabling cookies may affect the functionality of certain tools (e.g., the Citation Manager may lose your formatting preferences). To learn more, visit https://www.allaboutcookies.org/. To opt out of Google Analytics, visit https://tools.google.com/dlpage/gaoptout/. For interest-based advertising opt-out, visit https://optout.networkadvertising.org/ or https://optout.aboutads.info/.`,
  },
  {
    id: 'manage-eea',
    title: 'EEA, UK & Canada Residents',
    content: `If you are located in the European Economic Area, United Kingdom, or Canada and do not wish to accept non-Essential Cookies, or wish to withdraw your consent, you can click "Cookie Preferences" at any time in the app settings or footer to update your choices.`,
  },
  {
    id: 'dnt',
    title: 'Do Not Track Signals',
    content: `Your browser may offer a "Do Not Track" (DNT) option. Because of our use of Cookies for core functionality and analytics, ${COMPANY_NAME} does not currently respond to DNT signals. For more information, visit www.allaboutdnt.com.`,
  },
  {
    id: 'changes',
    title: 'Changes to This Cookie Policy',
    content: `We may update this Cookie Policy from time to time. Any changes will take effect on the "Effective Date" shown at the top of this page. We encourage you to review it periodically.`,
  },
];

const cookieTableData = {
  essential: [
    { name: 'session_id', subgroup: `${APP_URL}`, lifespan: 'Session', party: 'First Party', description: 'Maintains your authenticated session across the app.' },
    { name: 'auth_token', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Stores your login authentication token.' },
    { name: 'citation_style', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Remembers your preferred citation format (APA, Harvard, Vancouver).' },
    { name: 'premium_status', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Tracks whether your account has an active Premium subscription.' },
    { name: 'sidebar_state', subgroup: `${APP_URL}`, lifespan: 'Session', party: 'First Party', description: 'Remembers sidebar pin/collapse state during your session.' },
    { name: '__cf_bm', subgroup: `${APP_URL}`, lifespan: 'A few seconds', party: 'First Party', description: 'Cloudflare Bot Management cookie — helps protect the app from automated abuse.' },
    { name: 'cf_clearance', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Used by Cloudflare to verify that the user passed a bot challenge.' },
  ],
  analytics: [
    { name: '_ga', subgroup: `${APP_URL}`, lifespan: '399 Days', party: 'First Party', description: 'Google Universal Analytics — distinguishes unique users by assigning a randomly generated client identifier.' },
    { name: '_ga_XXXXXXX', subgroup: `${APP_URL}`, lifespan: '399 Days', party: 'First Party', description: 'Google Analytics 4 session tracking cookie.' },
    { name: '_gid', subgroup: `${APP_URL}`, lifespan: '24 Hours', party: 'First Party', description: 'Google Analytics — stores and updates a unique value for each page visited.' },
    { name: '_gat', subgroup: `${APP_URL}`, lifespan: 'A few seconds', party: 'First Party', description: 'Google Analytics — throttles request rate on high-traffic pages.' },
    { name: 'amplitude_session', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Amplitude product analytics — tracks session and feature usage within WritingTools.' },
    { name: '_clck', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Microsoft Clarity — persists the Clarity User ID and preferences.' },
    { name: '_clsk', subgroup: `${APP_URL}`, lifespan: 'A few seconds', party: 'First Party', description: 'Microsoft Clarity — connects multiple page views into a single session recording.' },
  ],
  functional: [
    { name: 'pdf_editor_prefs', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Stores your PDF Editor tool preferences (e.g., default view mode, zoom level).' },
    { name: 'depth_breadth_history', subgroup: `${APP_URL}`, lifespan: 'Session', party: 'First Party', description: 'Temporarily stores analysis results within the Depth & Breadth session.' },
    { name: 'style_analyser_prefs', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Stores your Style Analyser configuration and preferences.' },
    { name: 'ajs_anonymous_id', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Segment Analytics — anonymous identifier used for tracking how the app is used.' },
    { name: '__tld__', subgroup: `${APP_URL}`, lifespan: 'Session', party: 'First Party', description: 'Segment Analytics.js — helps determine the top-level domain for the user.' },
    { name: 'language_pref', subgroup: `${APP_URL}`, lifespan: '364 Days', party: 'First Party', description: 'Stores the user\'s chosen interface language.' },
  ],
  advertising: [
    { name: '_gcl_au', subgroup: `${APP_URL}`, lifespan: '89 Days', party: 'First Party', description: 'Used by Google AdSense to experiment with advertisement efficiency.' },
    { name: '_ttp', subgroup: `${APP_URL}`, lifespan: '395 Days', party: 'First Party', description: 'TikTok pixel — used for ad tracking and conversion measurement.' },
    { name: '_rdt_uuid', subgroup: `${APP_URL}`, lifespan: '89 Days', party: 'First Party', description: 'Reddit Pixel — tracks views and performance of advertisements.' },
    { name: '_uetsid', subgroup: `${APP_URL}`, lifespan: 'A few seconds', party: 'First Party', description: 'Microsoft Bing Ads — used to determine relevant ads for the end user.' },
    { name: 'IDE', subgroup: 'doubleclick.net', lifespan: '399 Days', party: 'Third Party', description: 'Google DoubleClick — real-time bidding advertising exchange cookie.' },
    { name: 'MUID', subgroup: 'bing.com', lifespan: '389 Days', party: 'Third Party', description: 'Microsoft Bing — used for ad tracking and targeting.' },
    { name: 'bcookie', subgroup: 'linkedin.com', lifespan: '364 Days', party: 'Third Party', description: 'LinkedIn browser identifier used for ad targeting and analytics.' },
  ],
};

const tagColors = {
  'First Party': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Third Party': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

function AccordionSection({ section }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-950 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors duration-300 shadow-sm">
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left group cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <h3 className="text-slate-900 dark:text-white font-semibold text-[15px] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{section.title}</h3>
        <span className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors ml-4 flex-none">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-slate-200 dark:border-neutral-800 pt-5">
          {section.content && (
            <p className="text-sm text-slate-700 dark:text-neutral-300 leading-relaxed font-medium">{section.content}</p>
          )}
          {section.subsections && (
            <div className="space-y-4">
              {section.subsections.map(sub => (
                <div key={sub.label} className="rounded-xl bg-slate-50 dark:bg-neutral-900/50 border border-slate-200 dark:border-neutral-800 p-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{sub.label}</p>
                  <p className="text-sm text-slate-600 dark:text-neutral-300 leading-relaxed">{sub.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CookieTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50">
            <th className="text-left px-4 py-3 text-slate-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider">Cookie</th>
            <th className="text-left px-4 py-3 text-slate-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider hidden md:table-cell">Subgroup</th>
            <th className="text-left px-4 py-3 text-slate-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider hidden sm:table-cell">Lifespan</th>
            <th className="text-left px-4 py-3 text-slate-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider">Party</th>
            <th className="text-left px-4 py-3 text-slate-700 dark:text-neutral-300 font-bold text-xs uppercase tracking-wider hidden lg:table-cell">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-slate-100 dark:border-neutral-900 transition-colors ${
                i % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-neutral-900/20'
              } hover:bg-slate-100/60 dark:hover:bg-neutral-900/40`}
            >
              <td className="px-4 py-3 font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">{row.name}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-neutral-400 text-xs hidden md:table-cell">{row.subgroup}</td>
              <td className="px-4 py-3 text-slate-600 dark:text-neutral-400 text-xs hidden sm:table-cell whitespace-nowrap">{row.lifespan}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tagColors[row.party]}`}>
                  {row.party}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-neutral-300 text-xs leading-relaxed hidden lg:table-cell max-w-xs">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CookieCategory({ title, color, rows, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 group w-full text-left cursor-pointer"
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-none ${color}`} />
        <h4 className="text-slate-900 dark:text-white font-bold text-[15px] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{title}</h4>
        <span className="text-slate-400 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors ml-auto">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && <CookieTable rows={rows} />}
    </div>
  );
}

export default function CookiePolicyView({ onNavigate, onOpenCookieModal }) {
  return (
    <div className="overflow-y-auto flex-1 min-h-0 hidden-scrollbar flex flex-col relative h-full w-full bg-slate-50 dark:bg-black transition-colors duration-300">
      <div className="w-full max-w-[1200px] mx-auto px-6 md:px-12 py-8 flex-1">

        {/* Back button & Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors w-fit mb-6 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Home
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-none">
              <Cookie size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-bold uppercase tracking-widest">Legal Document</p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Cookie Policy</h1>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Shield size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Effective Date: {EFFECTIVE_DATE}</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-neutral-800" />
            <p className="text-xs text-slate-600 dark:text-neutral-400 font-medium">
              This policy applies to all WritingTools services including the web app, PDF tools, citation manager, and AI analysis features.
            </p>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-8 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 px-6 py-6 shadow-sm">
          <p className="text-sm text-slate-700 dark:text-neutral-300 leading-relaxed font-medium">
            We are <strong className="text-slate-900 dark:text-white font-bold">WritingTools</strong>. This Cookie Policy describes the types of cookies and
            similar tracking technologies we use across our Services — including the Citation & Reference Manager, PDF Conversion & Editor,
            Depth & Breadth Analyser, Style Analyser, and AI-powered writing features — our purposes for using them, and your choices
            regarding them.
          </p>
        </div>

        {/* Accordion Sections */}
        <div className="space-y-3 mb-10">
          {sections.map(s => (
            <AccordionSection key={s.id} section={s} />
          ))}
        </div>

        {/* Cookie List */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Detailed Cookie Inventory</h2>
          <div className="space-y-6">
            <CookieCategory title="Essential Cookies" color="bg-emerald-500" rows={cookieTableData.essential} defaultOpen={true} />
            <CookieCategory title="Analytics Cookies" color="bg-blue-500" rows={cookieTableData.analytics} />
            <CookieCategory title="Functional Cookies" color="bg-violet-500" rows={cookieTableData.functional} />
            <CookieCategory title="Advertising Cookies" color="bg-amber-500" rows={cookieTableData.advertising} />
          </div>
        </div>

      </div>

      {/* Footer */}
      <Footer onNavigate={onNavigate} onOpenCookieModal={onOpenCookieModal} />
    </div>
  );
}
