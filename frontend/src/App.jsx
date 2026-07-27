import React, { useState, useMemo, useRef } from 'react';
import { Home, Settings, ArrowLeftRight, PenTool, Sparkles, Crown, Fingerprint, Bookmark } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import Logo from './components/Logo';
import ErrorBoundary from './components/ErrorBoundary';
import HomeView from './components/HomeView';
import LibraryView from './components/LibraryView';
import ConverterView from './components/ConverterView';
import SettingsView from './components/SettingsView';
import PDFEditorPage from './pages/PDFEditorPage';
import DepthBreadthView from './components/DepthBreadthView';
import StyleView from './components/StyleView';
import GlobalNavRing from './components/GlobalNavRing';
import TermsView from './components/TermsView';
import PrivacyView from './components/PrivacyView';
import PremiumView from './components/PremiumView';
import UserProfile from './components/UserProfile';
import CookiePolicyView from './components/CookiePolicyView';
import CopyrightPolicyView from './components/CopyrightPolicyView';
import CommunityGuidelinesView from './components/CommunityGuidelinesView';
import CookiePreferenceModal from './components/CookiePreferenceModal';
import CookieBanner from './components/CookieBanner';
import AuthModal from './components/AuthModal';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { featureTimelineData } from './data/features';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Citation & Reference Manager', icon: Bookmark },
  { id: 'converter', label: 'PDF/File Conversion Tools', icon: ArrowLeftRight },
  { id: 'pdf_editor', label: 'PDF Editor', icon: PenTool },
  { id: 'depth_breadth', label: 'Depth & Breadth', icon: Sparkles },
  { id: 'style_analyser', label: 'Style Analyser', icon: Fingerprint },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const { isPremium, openAuthModal } = useAuth();
  const { theme } = useTheme();

  // Refs for imperative deep-link calls into persistent views
  const converterRef = useRef(null);
  const libraryRef = useRef(null);

  const handleNavigate = (tab, subToolId = null) => {
    setActiveTab(tab);
    // Imperatively tell the target view to activate the specific sub-tool
    if (subToolId) {
      // Use rAF so the view is visible before we call into it
      requestAnimationFrame(() => {
        if (tab === 'converter' && converterRef.current?.selectTool) {
          converterRef.current.selectTool(subToolId);
        }
        if (tab === 'library' && libraryRef.current?.selectSubTab) {
          libraryRef.current.selectSubTab(subToolId);
        }
      });
    }
  };

  // Views marked forceDark are built with hardcoded dark-only styles
  // and must always render inside a `dark` class context.
  const PERSISTENT_VIEWS = useMemo(() => [
    { id: 'home',        component: <HomeView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'library',     component: <LibraryView ref={libraryRef} /> },
    { id: 'converter',   component: <ConverterView ref={converterRef} /> },
    { id: 'pdf_editor',  component: <PDFEditorPage /> },
    { id: 'depth_breadth', component: <DepthBreadthView /> },
    { id: 'style_analyser', component: <StyleView /> },
    { id: 'settings',    component: <SettingsView /> },
    { id: 'terms',       component: <TermsView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'privacy',     component: <PrivacyView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'premium',     component: <PremiumView onNavigate={handleNavigate} isPremium={isPremium} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'cookie_policy', component: <CookiePolicyView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'copyright',   component: <CopyrightPolicyView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
    { id: 'community',   component: <CommunityGuidelinesView onNavigate={handleNavigate} onOpenCookieModal={() => setCookieModalOpen(true)} /> },
  ], [isPremium]);

  const isKnownView = PERSISTENT_VIEWS.some(v => v.id === activeTab);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-black transition-colors duration-300">
      
      {/* Premium Minimalist Nav (Cardless) in normal document flow */}
      <div className="w-full px-2 md:px-4 lg:px-6 flex-none pt-4 pb-2 z-50 pointer-events-none">
        <div className={`max-w-[1600px] mx-auto w-full flex justify-between items-center transition-all duration-300 ${activeTab !== 'home' ? 'pr-24 md:pr-28' : 'pr-0'}`}>
          <header 
            className="inline-flex items-center gap-2 group cursor-pointer transition-transform duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] pointer-events-auto -ml-1 md:-ml-2" 
            onClick={() => setActiveTab('home')}
            title="Return to Home"
          >
            <div className="flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-110">
              <Logo size={44} />
            </div>
            <h1 className="text-base font-extrabold tracking-[0.25em] text-slate-900 dark:text-white opacity-85 transition-opacity duration-[160ms] group-hover:opacity-100">
              WritingTools
            </h1>
          </header>

          <div className="pointer-events-auto flex items-center gap-3 md:gap-4">
            <ThemeToggle />

            {isPremium ? (
              <button
                onClick={() => setActiveTab('premium')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs hover:bg-amber-500/20 transition-all duration-200"
                title="Your premium subscription is active"
              >
                <Crown size={12} className="fill-current" />
                <span className="hidden sm:inline">Premium Active</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('premium')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                  activeTab === 'premium'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-black font-extrabold'
                    : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white font-semibold'
                }`}
              >
                <Sparkles size={12} className="text-amber-500 dark:text-amber-400 animate-pulse" />
                <span>Go Premium</span>
              </button>
            )}

            <UserProfile activeTab={activeTab} onNavigate={setActiveTab} />
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 relative">

        {/* Auth Modal — global, driven by AuthContext */}
        <AuthModal />

        {/* Cookie Preference Modal — rendered at root so it overlays everything */}
        <CookiePreferenceModal
          isOpen={cookieModalOpen}
          onClose={() => setCookieModalOpen(false)}
          onNavigate={setActiveTab}
        />

        {/* First-visit Cookie Consent Banner */}
        <CookieBanner
          onOpenPreferences={() => setCookieModalOpen(true)}
          onNavigate={setActiveTab}
        />

        {/* Persistent views — always mounted, hidden when inactive */}
        {PERSISTENT_VIEWS.map(({ id, component, forceDark }) => (
          <div
            key={id}
            className={`${activeTab === id ? 'animate-fade-in-up flex-1 min-h-0 flex flex-col overflow-hidden relative' : ''} ${id !== 'home' && id !== 'terms' && id !== 'privacy' && id !== 'premium' && id !== 'cookie_policy' && id !== 'copyright' && id !== 'community' ? 'w-full max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10' : ''} ${forceDark ? 'dark' : ''}`}
            style={activeTab !== id ? { display: 'none' } : undefined}
          >
            <ErrorBoundary onReset={() => setActiveTab('home')}>
              {component}
            </ErrorBoundary>
          </div>
        ))}

        {/* Fallback for unknown tabs (e.g. "collab") */}
        {!isKnownView && (
          <div className="animate-fade-in-up flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-center h-full">
              <div className="glass-card-static p-12 text-center">
                <div className="text-6xl mb-4 opacity-30">🚧</div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Coming Soon</h2>
                <p className="text-slate-500 dark:text-neutral-500">This feature is under development.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Nav Ring for non-home pages */}
      {activeTab !== 'home' && (
        <GlobalNavRing 
          timelineData={featureTimelineData} 
          onNavigate={handleNavigate} 
        />
      )}

    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
