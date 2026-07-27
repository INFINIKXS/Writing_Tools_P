import React, { useState, useRef } from 'react';
import { Copyright, AlertCircle, RefreshCw, Mail, ArrowLeft, FileText, Shield } from 'lucide-react';
import Footer from './Footer';

const SECTIONS = [
  { id: 'policy',           label: '1. Copyright Policy',       icon: Copyright },
  { id: 'infringement',     label: '2. Infringement Notice',    icon: AlertCircle },
  { id: 'counter',          label: '3. Counter-Notice',         icon: RefreshCw },
  { id: 'agent',            label: '4. Designated Agent',       icon: Mail },
];

export default function CopyrightPolicyView({ onNavigate, onOpenCookieModal }) {
  const [activeSection, setActiveSection] = useState('policy');
  const containerRef = useRef(null);

  const handleScroll = (e) => {
    const container = e.target;
    const containerRect = container.getBoundingClientRect();
    const triggerLine = containerRect.top + containerRect.height * 0.45;
    let currentActive = SECTIONS[0].id;
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= triggerLine) currentActive = section.id;
        else break;
      }
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 80)
      currentActive = SECTIONS[SECTIONS.length - 1].id;
    setActiveSection(currentActive);
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto flex-1 min-h-0 hidden-scrollbar flex flex-col relative h-full w-full bg-slate-50 dark:bg-black transition-colors duration-300"
    >
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 py-8 text-slate-700 dark:text-slate-900 dark:text-neutral-200 font-bold">

        {/* Sidebar */}
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
                Quick Links
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
                          : 'border border-transparent text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-slate-900 dark:text-neutral-200 font-bold hover:bg-slate-200/50 dark:hover:bg-neutral-900/40'
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
              Last Updated: July 25, 2026
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex-1 min-w-0">
          <div className="glass-card-static p-8 md:p-12 border border-slate-200 dark:border-neutral-900 bg-white dark:bg-neutral-950 rounded-3xl flex flex-col gap-10 shadow-sm">

            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
                Copyright Policy
              </h1>
              <p className="text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold text-sm">
                WritingTools respects intellectual property rights and expects users to do the same.
              </p>
            </div>

            <div className="w-full h-px bg-slate-200 dark:bg-neutral-900" />

            {/* Section 1 */}
            <article id="policy" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Copyright className="text-amber-500" size={18} />
                1. Copyright Policy
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold flex flex-col gap-3">
                <p>
                  <strong className="text-slate-900 dark:text-neutral-200 font-bold">WritingTools</strong>, operated by Paradox-Labs, respects the rights of
                  all content creators and takes copyright seriously. It is our policy to respond to clear and valid notices
                  of alleged copyright infringement in accordance with the <strong className="text-slate-900 dark:text-neutral-200 font-bold">Nigerian
                  Copyright Act (as amended)</strong> and applicable international frameworks.
                </p>
                <p>
                  Users of our Services are prohibited from uploading, submitting, or otherwise distributing through the
                  platform any content that may violate another party's intellectual property rights. This applies to all
                  features including the Citation & Reference Manager, PDF Editor, File Converter, Depth & Breadth Analyser,
                  and Style Analyser.
                </p>

                <div className="bg-slate-100 dark:bg-neutral-900/50 border border-slate-200 dark:border-neutral-800 p-4 rounded-xl text-xs flex flex-col gap-2">
                  <p className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">By submitting content to our Services, you represent that:</p>
                  <ul className="list-disc pl-5 flex flex-col gap-1.5 text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold">
                    <li>You own the copyrights to the content, or have express permission from the rights holder to use and upload it.</li>
                    <li>Uploading the content will not violate any law, regulation, or ethics code.</li>
                    <li>Uploading the content will not violate our Terms of Service or this Copyright Policy.</li>
                    <li>If you use a WritingTools AI feature (e.g. Style Analyser, Depth & Breadth AI), your prompts and inputs will not infringe someone else's copyrights or any other applicable law.</li>
                  </ul>
                </div>

                <p>
                  WritingTools will remove or disable access to user content if we are notified that it infringes on copyright.
                  We will also terminate accounts of users who repeatedly violate this Policy.
                </p>
              </div>
            </article>

            {/* Section 2 */}
            <article id="infringement" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={18} />
                2. Copyright Infringement Notice
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold flex flex-col gap-3">
                <p>
                  If you believe that content submitted by a user on our Service infringes on a creative work that you or
                  an entity you represent owns, you may submit a copyright notice of alleged infringement to us via the
                  contact details in Section 4 below.
                </p>
                <p className="font-semibold text-slate-900 dark:text-neutral-200 font-bold">
                  A valid copyright notice must include all of the following:
                </p>
                <ol className="list-decimal pl-5 flex flex-col gap-3 text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold">
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Description of the copyrighted work.</strong> Please identify the
                    work or list of works you claim has been infringed.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Location of the infringing content.</strong> Provide the specific
                    URL(s) or location(s) within WritingTools where the allegedly infringing content can be found.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Your contact information.</strong> Provide your full name, address,
                    telephone number, and email address so we can respond to your claim. If we receive a valid counter-notice,
                    your complaint (including your contact information) may be forwarded to the uploader.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Good faith statement.</strong> A statement that you have a good faith
                    belief that the use of the material in the manner complained of is not authorised by the copyright owner,
                    its agent, or applicable law.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Accuracy statement.</strong> A statement that the information in your
                    notice is accurate and complete, and, under penalty of perjury, that you are authorised to act on behalf
                    of the owner of the exclusive right that is allegedly infringed.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Your signature.</strong> A physical or electronic signature of the
                    copyright owner or an authorised representative.
                  </li>
                </ol>

                <div className="border-l-2 border-amber-500 pl-4 py-1 text-slate-900 dark:text-neutral-200 font-bold text-xs">
                  Once we receive a valid copyright notice, WritingTools reserves the right to remove or disable access to
                  the infringing material, notify the accused user, and terminate the account of repeat offenders.
                </div>
              </div>
            </article>

            {/* Section 3 */}
            <article id="counter" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="text-amber-500" size={18} />
                3. Counter-Notice
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold flex flex-col gap-3">
                <p>
                  If you believe that content you submitted was removed in error and is not infringing, you may submit a
                  counter-notice to us via the contact details in Section 4 below.
                </p>
                <p className="font-semibold text-slate-900 dark:text-neutral-200 font-bold">
                  A valid counter-notice must include all of the following:
                </p>
                <ol className="list-decimal pl-5 flex flex-col gap-3 text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold">
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Identification of the removed content.</strong> Identify each item
                    you believe was mistakenly removed and provide the URL(s) where it was previously located within WritingTools.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Your contact information.</strong> Provide your full name, address,
                    and telephone number. You must also provide a statement consenting to the jurisdiction of appropriate
                    courts for any dispute arising from the counter-notice.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Good faith statement.</strong> A statement under penalty of perjury
                    that you have a good faith belief the material was mistakenly removed or disabled.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-neutral-200 font-bold">Your signature.</strong> A physical or electronic signature.
                  </li>
                </ol>

                <p>
                  If WritingTools receives a valid counter-notice, we may, in our discretion, send a copy of the counter-notice
                  to the original complainant. Unless the copyright owner files an action seeking a court order, the removed
                  material may be replaced or access restored within <strong className="text-slate-900 dark:text-neutral-200 font-bold">10 to 14 business days</strong> after
                  receipt of the counter-notice.
                </p>
              </div>
            </article>

            {/* Section 4 */}
            <article id="agent" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="text-amber-500" size={18} />
                4. Copyright Designated Agent
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold flex flex-col gap-3">
                <p>
                  All copyright notices and counter-notices must be sent to our designated copyright agent:
                </p>
                <div className="p-5 rounded-xl bg-slate-100 dark:bg-neutral-900/30 border border-slate-200 dark:border-neutral-900 text-slate-700 dark:text-slate-900 dark:text-neutral-200 font-bold flex flex-col gap-1.5">
                  <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <Shield size={14} className="text-amber-500" /> Copyright Compliance — WritingTools
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-900 dark:text-neutral-200 font-bold">Paradox-Labs (a private venture pending formal registration)</p>
                  <p className="text-xs mt-1">
                    Email:{' '}
                    <a href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Copyright%20Notice%20-%20WritingTools" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline font-semibold">
                      biskmem@gmail.com
                    </a>
                  </p>
                </div>
                <p className="text-xs text-neutral-500">
                  Please allow up to <strong className="text-slate-800 dark:text-slate-900 dark:text-neutral-200 font-bold">5 business days</strong> for an initial response to
                  copyright notices. Incomplete notices that do not meet the requirements above will not be processed.
                </p>
              </div>
            </article>

          </div>
        </section>
      </div>
      <Footer onNavigate={onNavigate} onOpenCookieModal={onOpenCookieModal} />
    </div>
  );
}
