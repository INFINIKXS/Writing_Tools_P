import React, { useState, useRef } from 'react';
import { Eye, Database, Share2, ShieldCheck, HelpCircle, ArrowLeft, RefreshCw, FileText, UserCheck } from 'lucide-react';
import Footer from './Footer';

const SECTIONS = [
  { id: 'introduction', label: '1. Introduction', icon: Eye },
  { id: 'data-collected', label: '2. Data We Collect', icon: Database },
  { id: 'legal-basis', label: '3. Legal Processing Basis', icon: UserCheck },
  { id: 'data-usage', label: '4. How We Use Data', icon: RefreshCw },
  { id: 'data-sharing', label: '5. Sharing & Transfers', icon: Share2 },
  { id: 'subject-rights', label: '6. Your Rights', icon: ShieldCheck },
  { id: 'data-security', label: '7. Security & Retention', icon: ShieldCheck },
  { id: 'contact', label: '8. Contact Info', icon: FileText },
];

export default function PrivacyView({ onNavigate, onOpenCookieModal }) {
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
                Privacy Outline
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
              Privacy Policy
            </h1>
            <p className="text-slate-700 dark:text-neutral-300 text-sm">
              We respect your privacy and protect your personal data in accordance with local and international standards.
            </p>
          </div>

          <div className="w-full h-px bg-slate-200 dark:bg-neutral-900" />

          {/* Section 1: Introduction */}
          <article id="introduction" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="text-amber-500" size={18} />
              1. Introduction
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                Paradox-Labs (&ldquo;WritingTools&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a private venture pending formal registration, committed to safeguarding the privacy and personal data of our users.
              </p>
              <p>
                This Privacy Policy outlines how we collect, process, utilize, share, and protect your personal data when you use the WritingTools application.
              </p>
              <p>
                By using our services, you consent to the collection and processing of your personal data as detailed in this policy. If you do not agree, please do not use the application.
              </p>
            </div>
          </article>

          {/* Section 2: Data Collected */}
          <article id="data-collected" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="text-amber-500" size={18} />
              2. Data We Collect
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                We collect information necessary to provide spelling correction, text humanizing, reference cataloging, and document conversion features.
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2 text-slate-800 dark:text-neutral-200">
                <li>
                  <strong>Account Information:</strong> When you register, we collect your name, email address, password, and profile preferences.
                </li>
                <li>
                  <strong>User Inputs (Verbatim Text):</strong> We collect the text, documents, citation details, or files you submit to the WritingTools platform to run our analysis models.
                </li>
                <li>
                  <strong>Billing and Payments:</strong> Payments are processed by certified third-party payment gateways (e.g. Flutterwave, Paystack, Stripe). We do not store complete credit card details on our servers.
                </li>
                <li>
                  <strong>Automated Metadata:</strong> We collect log files, IP addresses, browser types, device information, and usage analytics (via cookies and tracking tags) to maintain network stability.
                </li>
              </ul>
            </div>
          </article>

          {/* Section 3: Legal Basis for Processing */}
          <article id="legal-basis" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="text-amber-500" size={18} />
              3. Legal Basis for Processing
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                We process your personal data under the following lawful bases:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2 text-slate-800 dark:text-neutral-200">
                <li><strong>Consent:</strong> You have given clear and unambiguous consent for us to process your personal data for specific purposes (e.g. newsletter sign-up, AI parsing).</li>
                <li><strong>Contract Performance:</strong> Processing is necessary to perform our obligations under the contract between you and WritingTools (e.g., executing premium features).</li>
                <li><strong>Legitimate Interests:</strong> Processing is required to secure our network, prevent fraud, and continuously optimize the user experience, provided it does not override your fundamental rights.</li>
              </ul>
            </div>
          </article>

          {/* Section 4: How We Use Data */}
          <article id="data-usage" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="text-amber-500" size={18} />
              4. Data Usage & AI Model Training
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                We use the data collected to deliver, secure, customize, and analyze our services.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 p-4 rounded-xl text-slate-800 dark:text-amber-100 text-xs flex flex-col gap-2">
                <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">AI Model Training Policy:</p>
                <p>
                  To continuously improve the accuracy of our AI Humanizer, citation parsing, and spelling verification systems, we may use anonymized text inputs from users.
                </p>
                <ul className="list-disc pl-5 flex flex-col gap-1 text-slate-800 dark:text-neutral-200">
                  <li><strong>Premium & Team Users:</strong> We never train our models on inputs submitted by users with active Premium or Team plans. Your input remains strictly private.</li>
                  <li><strong>Free Tier Users:</strong> Inputs from the free tier may be used to train our models in a secure, aggregated, and de-identified manner.</li>
                  <li><strong>Opt-Out Availability:</strong> Any user can opt-out of model training entirely at any time in the account settings page.</li>
                </ul>
              </div>
            </div>
          </article>

          {/* Section 5: Sharing & Transfers */}
          <article id="data-sharing" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Share2 className="text-amber-500" size={18} />
              5. Sharing of Data & Cross-Border Transfers
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                We do not sell, rent, or trade your personal data. We only share information with certified service providers who assist us (e.g. database hosting, secure server providers).
              </p>
              <p>
                <strong>Cross-Border Data Transfers:</strong> Since writing tools infrastructure utilizes cloud resources based internationally, your personal data may be transferred, stored, and processed outside Nigeria. In compliance with Section 41-43 of the <strong>NDPA 2023</strong>:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-slate-800 dark:text-neutral-200">
                <li>We ensure that recipient countries have adequate data protection legislation, or we put in place standard contractual clauses and binding corporate rules.</li>
                <li>We enforce high-grade encryption at rest and in transit to protect your transfer tunnels.</li>
              </ul>
            </div>
          </article>

          {/* Section 6: Your NDPA Rights */}
          <article id="subject-rights" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-amber-500" size={18} />
              6. Your Data Rights
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                You possess the following fundamental rights regarding your personal data:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-2 text-slate-800 dark:text-neutral-200">
                <li><strong>Right of Access:</strong> You can request confirmation and copies of the personal data we hold about you.</li>
                <li><strong>Right to Rectification:</strong> You can request correction of inaccurate or incomplete personal data.</li>
                <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You can request the deletion of your account and related metadata.</li>
                <li><strong>Right to Data Portability:</strong> You can request your data in a structured, commonly-used format to transfer to another provider.</li>
                <li><strong>Right to Restrict or Object:</strong> You can object to the processing of your data for direct marketing or model training purposes.</li>
                <li><strong>Right to Withdraw Consent:</strong> You have the right to withdraw your consent to data processing at any time.</li>
                <li><strong>Right to Complain:</strong> You have the right to contact us directly if you believe we have violated your data rights.</li>
              </ul>
            </div>
          </article>

          {/* Section 7: Security & Retention */}
          <article id="data-security" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="text-amber-500" size={18} />
              7. Security & Data Retention
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                <strong>Security:</strong> We implement administrative, technical, and physical security measures to protect your personal data, including AES-256 encryption at rest and Transport Layer Security (TLS 1.3) in transit.
              </p>
              <p>
                <strong>Retention:</strong> We retain your personal data and uploaded texts only for as long as necessary to fulfill the purposes outlined in this policy or as required to comply with statutory legal and accounting requirements. Account details are retained until you request account deletion.
              </p>
            </div>
          </article>

          {/* Section 8: DPO Contact Info */}
          <article id="contact" className="scroll-mt-24 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="text-amber-500" size={18} />
              8. Contact Information
            </h2>
            <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
              <p>
                For any questions, concerns, or to exercise your data rights, please reach us directly at:
              </p>
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-neutral-900/30 border border-slate-200 dark:border-neutral-900 text-slate-700 dark:text-neutral-300 text-xs flex flex-col gap-1">
                <p className="font-bold text-slate-900 dark:text-white text-sm">Paradox-Labs</p>
                <p className="text-slate-700 dark:text-neutral-300">A private venture pending formal registration.</p>
                <p className="mt-1">Email: <a href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Privacy%20Inquiry%20-%20WritingTools" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline font-semibold">biskmem@gmail.com</a></p>
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
