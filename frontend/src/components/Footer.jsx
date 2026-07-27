import React, { useState, useRef, useEffect } from "react";
import Logo from "./Logo";

export default function Footer({ onNavigate, onOpenCookieModal }) {
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (contactRef.current && !contactRef.current.contains(e.target)) {
        setContactOpen(false);
      }
    };
    if (contactOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contactOpen]);

  // Navigation helper to handle clicks on tools or tabs
  const handleNav = (tabId) => {
    if (onNavigate) {
      onNavigate(tabId);
      // Scroll to top of the main container when switching tabs
      const mainContainer = document.querySelector("main");
      if (mainContainer) {
        mainContainer.scrollTop = 0;
      }
    }
  };

  return (
    <footer className="w-full bg-slate-100 dark:bg-[#050505] border-t border-slate-200 dark:border-neutral-900 mt-16 md:mt-20 pt-10 md:pt-12 pb-6 md:pb-8 px-6 md:px-12 relative z-10 text-slate-600 dark:text-neutral-400 transition-colors duration-300">
      <div className="max-w-[1220px] mx-auto w-full flex flex-col gap-8 md:gap-10">
        {/* Main Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-left">
          
          {/* Premium */}
          <div className="flex flex-col gap-4">
            <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">Premium</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-600 dark:text-neutral-400">
              <li>
                <button onClick={() => handleNav("premium")} className="hover:text-slate-900 dark:hover:text-white transition-colors text-left bg-transparent border-none p-0 cursor-pointer">
                  Plan Details
                </button>
              </li>
            </ul>
          </div>

          {/* Tools / Modules */}
          <div className="flex flex-col gap-4">
            <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">Modules</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-600 dark:text-neutral-400 font-medium">
              <li>
                <button onClick={() => handleNav("library")} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-left">
                  <span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> Citation &amp; Reference Manager
                </button>
              </li>
              <li>
                <button onClick={() => handleNav("converter")} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-left">
                  <span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> PDF/File Conversion Tools
                </button>
              </li>
              <li>
                <button onClick={() => handleNav("pdf_editor")} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-left">
                  <span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> PDF Editor
                </button>
              </li>
              <li>
                <button onClick={() => handleNav("depth_breadth")} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-left">
                  <span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> Depth &amp; Breadth
                </button>
              </li>
              <li>
                <button onClick={() => handleNav("style_analyser")} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-left">
                  <span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> Style Analyser
                </button>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-4">
            <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">Company</h4>
            <ul className="flex flex-col gap-2.5 text-xs text-slate-600 dark:text-neutral-400">
              <li><a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Help Center</a></li>
              <li ref={contactRef} className="relative">
                <button
                  onClick={() => setContactOpen((o) => !o)}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer text-left"
                >
                  Contact Us
                </button>
                {contactOpen && (
                  <div className="absolute bottom-full left-0 mb-2 z-50 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4 shadow-xl min-w-max">
                    <span className="text-slate-500 dark:text-neutral-500 text-[10px] uppercase tracking-wider font-semibold mr-1">Reach us on</span>
                    {/* X / Twitter */}
                    <a
                      href="https://x.com/Writing_Toools"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="X (Twitter)"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    {/* Email */}
                    <a
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Inquiry%20from%20WritingTools"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="Email Us"
                    >
                      <svg className="w-4 h-4 fill-none stroke-current stroke-[1.75]" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </a>
                  </div>
                )}
              </li>
              <li><a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5"><span className="text-slate-400 dark:text-neutral-500 font-normal">›</span> Resources</a></li>
            </ul>
          </div>

          {/* Social Links */}
          <div className="flex flex-col gap-4 col-span-2 md:col-span-1">
            <h4 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">Follow us on social</h4>
            <div className="flex gap-4 items-center">
              {/* X / Twitter */}
              <a href="https://x.com/Writing_Toools" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="X (formerly Twitter)">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Email */}
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Inquiry%20from%20WritingTools" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Email Us">
                <svg className="w-5 h-5 fill-none stroke-current stroke-[1.75]" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-neutral-900" />

        {/* Bottom Bar: Copyright, Brand Logo & Legal Links */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between text-slate-700 dark:text-neutral-300 text-xs text-center md:text-left font-medium">
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Logo size={24} />
              <span className="font-extrabold tracking-widest text-xs">WritingTools</span>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-neutral-400">
              <p>WritingTools, a Paradox-Labs, Inc. business</p>
              <p>© Paradox-Labs, Inc. 2026</p>
            </div>
          </div>

          {/* Policy Links */}
          <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-2 max-w-[400px] md:max-w-none text-slate-700 dark:text-neutral-300 font-semibold text-xs">
            <button onClick={() => handleNav("privacy")} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Privacy Policy</button>
            <span className="text-slate-400 dark:text-neutral-600">•</span>
            <button onClick={() => handleNav("terms")} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Terms of Service</button>
            <span className="text-slate-400 dark:text-neutral-600">•</span>
            <button onClick={() => handleNav("cookie_policy")} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Cookie Policy</button>
            <span className="text-slate-400 dark:text-neutral-600">•</span>
            <button onClick={onOpenCookieModal} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Cookie Preferences</button>
            <span className="text-slate-400 dark:text-neutral-600">•</span>
            <button onClick={() => handleNav("copyright")} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Copyright Policy</button>
            <span className="text-slate-400 dark:text-neutral-600">•</span>
            <button onClick={() => handleNav("community")} className="hover:text-slate-950 dark:hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer">Community Guidelines</button>
          </div>

        </div>

      </div>
    </footer>
  );
}
