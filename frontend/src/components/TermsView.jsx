import React, { useState, useRef } from 'react';
import { Shield, BookOpen, AlertTriangle, Key, Cpu, HelpCircle, ArrowLeft, Scale, MessageSquare } from 'lucide-react';
import Footer from './Footer';

const SECTIONS = [
  { id: 'introduction', label: '1. Introduction', icon: Shield },
  { id: 'accounts', label: '2. User Accounts', icon: Key },
  { id: 'acceptable-use', label: '3. Acceptable Use', icon: AlertTriangle },
  { id: 'intellectual-property', label: '4. Intellectual Property', icon: Cpu },
  { id: 'billing', label: '5. Billing & Subscriptions', icon: Scale },
  { id: 'governing-law', label: '6. Governing Law & Disputes', icon: Scale },
  { id: 'contact', label: '7. Contact Information', icon: MessageSquare },
];

export default function TermsView({ onNavigate, onOpenCookieModal }) {
  const [activeSection, setActiveSection] = useState('introduction');
  const containerRef = useRef(null);

  const handleScroll = (e) => {
    const container = e.target;
    const containerRect = container.getBoundingClientRect();
    
    // Set trigger line to 50% (middle) of the container height
    const triggerLine = containerRect.top + containerRect.height * 0.5;
    
    let currentActive = SECTIONS[0].id;
    
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= triggerLine) {
          currentActive = section.id;
        } else {
          break;
        }
      }
    }
    
    // Bottom override: if scrolled near the bottom, select the last section
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      currentActive = SECTIONS[SECTIONS.length - 1].id;
    }
    
    setActiveSection(currentActive);
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div 
      ref={containerRef} 
      onScroll={handleScroll} 
      className="overflow-y-auto flex-1 min-h-0 hidden-scrollbar flex flex-col relative h-full w-full bg-slate-50 dark:bg-black transition-colors duration-300"
    >
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 py-8 text-slate-700 dark:text-neutral-300">
        
        {/* Sidebar Quick Jump Nav */}
        <aside className="w-full md:w-64 flex-none md:sticky md:top-8 h-fit z-10">
          <div className="glass-card-static p-6 flex flex-col gap-4 border border-slate-200 dark:border-neutral-900 bg-white/90 dark:bg-neutral-950/80 backdrop-blur-md rounded-2xl shadow-sm">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-500 hover:text-amber-400 transition-colors w-fit mb-2"
            >
              <ArrowLeft size={14} /> Back to Home
            </button>
            
            <div className="flex flex-col">
              <h3 className="text-slate-900 dark:text-white text-xs font-extrabold uppercase tracking-[0.2em] mb-4">
                Terms Outline
              </h3>
              <nav className="flex flex-col gap-1">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-all duration-200 ${
                        activeSection === section.id
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold shadow-sm'
                          : 'border border-transparent text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 hover:bg-slate-200/50 dark:hover:bg-neutral-900/40'
                      }`}
                    >
                      <Icon size={14} className={activeSection === section.id ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400 dark:text-neutral-500'} />
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            
            <div className="text-[10px] text-slate-500 dark:text-neutral-500 mt-2 border-t border-slate-200 dark:border-neutral-900/60 pt-4">
              Last Updated: June 3, 2026
            </div>
          </div>
        </aside>

        {/* Main Text Content */}
        <section className="flex-1 min-w-0">
        <div className="glass-card-static p-8 md:p-12 border border-slate-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 rounded-3xl flex flex-col gap-10 shadow-sm">
          
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Terms of Service
            </h1>
            <p className="text-slate-800 dark:text-neutral-200 text-sm">
              Please read these Terms of Service carefully before using the WritingTools platform.
            </p>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-neutral-900" />

          {/* Section 1: Introduction */}
          <article id="introduction" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="text-amber-500" size={18} />
              1. Acceptance & Introduction
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                Welcome to WritingTools! These Terms of Service (&ldquo;Terms&rdquo;) form a legally binding contract between you and{' '}
                <strong className="text-slate-950 dark:text-white font-black">Paradox-Labs</strong> (&ldquo;Paradox-Labs&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), a private venture currently pending formal registration.
              </p>
              <p>
                These Terms govern your access to and use of our website, applications, AI models, plugins, APIs, and writing assistance services (collectively, the &ldquo;WritingTools Service&rdquo;).
              </p>
              <p className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl text-slate-800 dark:text-amber-100 text-xs">
                <strong>NOTICE TO USERS:</strong> By clicking &ldquo;I Agree&rdquo;, signing up, or otherwise accessing the WritingTools Service, you confirm that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must immediately cease all access and use of the platform.
              </p>
            </div>
          </article>

          {/* Section 2: User Accounts */}
          <article id="accounts" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="text-amber-500" size={18} />
              2. User Accounts & Security
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                To utilize certain advanced capabilities of the WritingTools Service, you may be required to register a User Account. You must provide accurate, current, and complete information during registration.
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-slate-800 dark:text-neutral-200">
                <li><strong>Account Safeguard:</strong> You are solely responsible for maintaining the confidentiality of your account credentials (passwords, tokens).</li>
                <li><strong>Liability:</strong> You are fully liable for all activities that occur under your account, whether authorized by you or not.</li>
                <li><strong>Breach Notification:</strong> You agree to notify our support team immediately at <span className="text-amber-500">biskmem@gmail.com</span> upon discovering any unauthorized usage or security breach.</li>
              </ul>
            </div>
          </article>

          {/* Section 3: Acceptable Use */}
          <article id="acceptable-use" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              3. Acceptable Use and Restrictions
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                You are granted a non-exclusive, non-transferable, revocable license to access and use the WritingTools Service strictly for personal, non-commercial, and legitimate educational or professional writing purposes.
              </p>
              <p>
                Under the <strong>Cybercrimes (Prohibition, Prevention, etc.) Act 2015</strong> (as amended), any unauthorized access, cracking, scraping, or disruption of our servers is a serious offense. You agree not to:
              </p>
              <ul className="list-decimal pl-5 flex flex-col gap-2 text-slate-800 dark:text-neutral-200">
                <li>
                  Use any robot, spider, scraper, or automated system to harvest or mine data from the platform, except via explicitly authorized API integrations.
                </li>
                <li>
                  Submit input text, files, or documents containing malware, viruses, or encrypted payloads designed to compromise the WritingTools infrastructure.
                </li>
                <li>
                  Use the Service to generate, humanize, or distribute spam, hate speech, defamatory material, or text that infringes on third-party copyright.
                </li>
                <li>
                  Attempt to reverse engineer, decompile, or extract the parameters and weights of our proprietary language models and humanizer system.
                </li>
                <li>
                  Train competitive artificial intelligence, paraphrasing, translation, or text verification models directly or indirectly on outputs generated by WritingTools.
                </li>
              </ul>
            </div>
          </article>

          {/* Section 4: Intellectual Property */}
          <article id="intellectual-property" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="text-amber-500" size={18} />
              4. Intellectual Property & User Content
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                <strong>Your Content (Inputs):</strong> You retain all intellectual property ownership rights in the texts, files, or citation references you submit to the WritingTools Service (&ldquo;Input&rdquo;). We do not claim ownership of your Inputs.
              </p>
              <p>
                <strong>Generated Output:</strong> Subject to your compliance with these Terms, Paradox-Labs assigns to you all its rights, titles, and interests in the text variations or formatted bibliographies produced by the Service (&ldquo;Output&rdquo;). You are solely responsible for ensuring the accuracy, compliance, and suitability of the Output.
              </p>
              <p>
                <strong>License to Us:</strong> To provide and maintain the WritingTools Service, you grant us a worldwide, royalty-free, non-exclusive license to host, parse, copy, transmit, and display your Input within our secure infrastructure. This license is strictly limited to service provision and security monitoring.
              </p>
            </div>
          </article>

          {/* Section 5: Billing & Subscriptions */}
          <article id="billing" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="text-amber-500" size={18} />
              5. Billing, Payments & Subscriptions
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                We offer free features, alongside premium capabilities available through a Paid Service subscription.
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-slate-800 dark:text-neutral-200">
                <li><strong>Pricing:</strong> All subscription rates, billing frequencies, and taxes are clearly displayed at checkout.</li>
                <li><strong>Local Taxes:</strong> Transactions may be subject to Value Added Tax (VAT) in accordance with the Nigerian Federal Inland Revenue Service (FIRS) laws.</li>
                <li><strong>Auto-Renewal:</strong> Subscription plans automatically renew unless cancelled through your account settings or by email before the renewal date.</li>
                <li><strong>Refunds:</strong> In accordance with the <strong>Federal Competition and Consumer Protection Act (FCCPA) 2018</strong>, you are entitled to cancel services. Premium subscriptions offer a 7-day money-back guarantee, after which fees are non-refundable except where mandated by local law.</li>
              </ul>
            </div>
          </article>

          {/* Section 6: Governing Law */}
          <article id="governing-law" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="text-amber-500" size={18} />
              6. Governing Law and Dispute Resolution
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                These Terms and your relationship with WritingTools shall be governed by, construed, and enforced in accordance with the laws of the <strong>Federal Republic of Nigeria</strong>, without regard to conflict of law principles.
              </p>
              <div className="bg-neutral-900/50 border border-neutral-800 p-5 rounded-xl text-xs flex flex-col gap-2">
                <p className="text-neutral-200 font-bold">BINDING ARBITRATION CLAUSE:</p>
                <p>
                  Any dispute, controversy, or claim arising out of or relating to this contract, including its formation, validity, breach, or termination, shall be referred to and finally resolved by binding arbitration under the <strong>Arbitration and Mediation Act, 2023</strong> of Nigeria.
                </p>
                <ul className="list-disc pl-5 flex flex-col gap-1 mt-1 text-slate-800 dark:text-neutral-200">
                  <li>The arbitration tribunal shall consist of a single arbitrator mutually appointed by both parties.</li>
                  <li>The seat or legal place of arbitration shall be <strong>Lagos, Nigeria</strong>.</li>
                  <li>The language to be used in the arbitral proceedings shall be <strong>English</strong>.</li>
                </ul>
              </div>
            </div>
          </article>

          {/* Section 7: Contact */}
          <article id="contact" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="text-amber-500" size={18} />
              7. Contact & Company Information
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                WritingTools is a product owned and operated by:
              </p>
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-neutral-900/30 border border-slate-200 dark:border-neutral-900 text-slate-700 dark:text-neutral-300">
                <p className="font-bold text-slate-900 dark:text-white">Paradox-Labs</p>
                <p className="text-xs mt-1 text-slate-600 dark:text-neutral-400">A private venture pending formal registration.</p>
                <p className="text-xs mt-2">Email: <a href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Terms%20Inquiry%20-%20WritingTools" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">biskmem@gmail.com</a></p>
              </div>
            </div>
          </article>

        </div>
      </section>

      </div>
      <Footer onNavigate={onNavigate} onOpenCookieModal={onOpenCookieModal} />
    </div>
  );
}
