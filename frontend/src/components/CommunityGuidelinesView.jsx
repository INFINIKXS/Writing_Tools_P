import React, { useState, useRef } from 'react';
import {
  Target, Copyright, Lock, MessageSquare, UserX, Image,
  ShieldAlert, AlertTriangle, Heart, ShoppingBag, Eye, ArrowLeft
} from 'lucide-react';
import Footer from './Footer';

const SECTIONS = [
  { id: 'mission',      label: '1. Mission Statement',         icon: Target },
  { id: 'copyright',    label: '2. Copyright & IP',            icon: Copyright },
  { id: 'privacy',      label: '3. Privacy Violations',        icon: Lock },
  { id: 'speech',       label: '4. Illegal or Harmful Speech', icon: MessageSquare },
  { id: 'harassment',   label: '5. Harassment & Abuse',        icon: UserX },
  { id: 'adult',        label: '6. Adult Content',             icon: Image },
  { id: 'minors',       label: '7. Safety of Minors',          icon: ShieldAlert },
  { id: 'extremism',    label: '8. Extremist Content',         icon: AlertTriangle },
  { id: 'self-harm',    label: '9. Self-Harm',                 icon: Heart },
  { id: 'commercial',   label: '10. Commercial Activity',      icon: ShoppingBag },
  { id: 'transparency', label: '11. Transparency',             icon: Eye },
];

function RuleCard({ icon: Icon, color, title, children }) {
  return (
    <div className={`rounded-xl border p-4 flex gap-3 ${color}`}>
      <Icon size={16} className="flex-none mt-0.5 opacity-80" />
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">{title}</p>
        <p className="text-xs leading-relaxed opacity-70">{children}</p>
      </div>
    </div>
  );
}

export default function CommunityGuidelinesView({ onNavigate, onOpenCookieModal }) {
  const [activeSection, setActiveSection] = useState('mission');
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
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 py-8 text-slate-700 dark:text-neutral-300">

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
                          : 'border border-transparent text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 hover:bg-slate-200/50 dark:hover:bg-neutral-900/40'
                      }`}
                    >
                      <Icon size={13} className={activeSection === section.id ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400 dark:text-neutral-500'} />
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
                Community Guidelines
              </h1>
              <p className="text-slate-800 dark:text-neutral-200 text-sm">
                These Guidelines apply to all content and activity across WritingTools services, including content
                produced through AI-powered features.
              </p>
            </div>

            <div className="w-full h-px bg-slate-200 dark:bg-neutral-900" />

            {/* 1. Mission */}
            <article id="mission" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="text-amber-500" size={18} />
                1. Mission Statement
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  At <strong className="text-slate-950 dark:text-white font-black">WritingTools</strong>, operated by Paradox-Labs, we aim to foster
                  a safe, respectful, and productive environment for researchers, writers, students, and professionals who
                  use our platform to process documents, manage citations, convert files, and improve their writing with
                  AI-powered analysis tools.
                </p>
                <p>
                  By using our Services — including the Citation & Reference Manager, PDF Editor, File Converter, Depth
                  & Breadth Analyser, and Style Analyser — you agree to follow these Guidelines. WritingTools reserves the
                  right, in its sole discretion, to restrict or disable access to any content, and to suspend or terminate
                  accounts that violate these Guidelines or applicable law.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 text-xs text-slate-800 dark:text-amber-100">
                  For conduct that poses a real-world risk to others (e.g. risk to life or to minors), we reserve the right
                  to contact or cooperate with competent authorities. We also reserve the right to terminate an account
                  immediately and without notice in such cases.
                </div>
              </div>
            </article>

            {/* 2. Copyright */}
            <article id="copyright" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Copyright className="text-amber-500" size={18} />
                2. Copyright & Intellectual Property
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  WritingTools respects the rights of all content creators. You are prohibited from uploading, posting,
                  or distributing through our Services any content that may violate another party's intellectual property
                  rights. Only submit your own original work, or work you have express authorisation to use. Copying
                  third-party content without authorisation is copyright infringement and is prohibited.
                </p>
                <p>
                  This applies equally to content you submit to AI features such as the Style Analyser or Depth & Breadth
                  Analyser — your prompts must not infringe anyone's copyright or other legal rights.
                </p>
                <RuleCard icon={Copyright} color="border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300" title="Required">
                  You must comply with our Copyright Policy, which is incorporated by reference into these Guidelines.
                </RuleCard>
              </div>
            </article>

            {/* 3. Privacy */}
            <article id="privacy" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="text-amber-500" size={18} />
                3. Privacy Violations
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  WritingTools does not intend to collect personal data through content you submit, and we do not automatically
                  remove or de-identify unauthorised personal data found in your content. It is your responsibility to ensure
                  that content you submit does not include others' personal data unless you have their permission.
                </p>
                <p>
                  You are strictly prohibited from sharing personal data that may lead to stalking, violence, phishing, fraud,
                  identity theft, or financial exploitation. Examples of prohibited personal data include: passwords, email
                  addresses, physical addresses, telephone numbers, health information, and financial account details.
                </p>
                <RuleCard icon={Lock} color="border-red-500/20 bg-red-500/5 text-red-800 dark:text-red-300" title="Prohibited">
                  Sharing images depicting individuals in private spaces (bathrooms, bedrooms, medical facilities) without
                  their explicit consent is strictly prohibited.
                </RuleCard>
              </div>
            </article>

            {/* 4. Harmful Speech */}
            <article id="speech" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="text-amber-500" size={18} />
                4. Illegal or Harmful Speech
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  Content that promotes hate speech or engages in the demeaning or discriminatory promotion of violence
                  based on attributes such as race, colour, ethnicity, national origin, religion, sexual orientation,
                  gender identity, disability, immigration status, socio-economic status, age, or pregnancy status is
                  prohibited on WritingTools.
                </p>
                <p>
                  This prohibition applies to content submitted directly as text, uploaded documents (PDF, DOCX, TXT), and
                  to content generated through any AI-assisted feature of the platform.
                </p>
              </div>
            </article>

            {/* 5. Harassment */}
            <article id="harassment" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserX className="text-amber-500" size={18} />
                5. Harassment & Non-Consensual Behaviour
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  We prohibit any form of bullying or harassment, including all types of sexual harassment. You must not
                  use WritingTools features to generate, format, or circulate harassing content targeting any individual
                  or group.
                </p>
                <p>
                  Additionally, you must not abuse our reporting mechanisms or feedback channels (e.g. falsely reporting
                  permissible content) to harass or retaliate against other users.
                </p>
              </div>
            </article>

            {/* 6. Adult Content */}
            <article id="adult" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Image className="text-amber-500" size={18} />
                6. Adult Content
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  We do not permit adult content on WritingTools, including pornography, sexualised content, graphic
                  depictions of sexual activity, or most forms of nudity — whether submitted as text, embedded in uploaded
                  documents, or generated through AI features.
                </p>
                <p>
                  Limited exceptions may apply in clearly defined academic, scientific, artistic, or historical contexts, at
                  the sole discretion of WritingTools.
                </p>
              </div>
            </article>

            {/* 7. Minors */}
            <article id="minors" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="text-amber-500" size={18} />
                7. Safety of Minors
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  WritingTools is dedicated to ensuring a safe online environment. Should we discover that a user does not
                  meet the minimum age requirement for our Services, appropriate action — including account termination —
                  will be taken immediately.
                </p>
                <RuleCard icon={ShieldAlert} color="border-red-500/20 bg-red-500/5 text-red-800 dark:text-red-300" title="Zero Tolerance">
                  We prohibit any content that may endanger minors, including child sexual abuse material (CSAM), content
                  promoting bullying of minors, or content promoting harmful substances to minors. Such content will be
                  reported to the relevant law enforcement authorities without exception.
                </RuleCard>
              </div>
            </article>

            {/* 8. Extremism */}
            <article id="extremism" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18} />
                8. Extremist & Terrorist Content
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  We prohibit content that supports, promotes, or glorifies terrorism, violent extremism, or their ideology
                  and activities. This includes depictions of terrorist attacks or their perpetrators, glorifying messages
                  or ideology of terrorist organisations, and slogans, symbols, or flags of such groups.
                </p>
                <p>
                  We reserve the right to remove or restrict access to our Services if we believe, in our sole discretion,
                  that a user poses a danger to others. We share information with law enforcement if there is a specific
                  and imminent threat to human life.
                </p>
              </div>
            </article>

            {/* 9. Self-Harm */}
            <article id="self-harm" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="text-amber-500" size={18} />
                9. Self-Harm & Harmful Behaviour
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  Our aim is to create a platform that enables everyone to reach their fullest potential safely. We prohibit
                  the display, promotion, or sharing of plans related to suicide or self-harm — whether submitted as text
                  in any tool or generated via AI-powered features.
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 text-xs text-slate-800 dark:text-amber-100">
                  If you or someone you know is dealing with thoughts of suicide or self-harm, please reach out to a suicide
                  prevention helpline in your region or contact your local emergency services. In situations involving a
                  specific, credible, and imminent threat to human life, we may notify emergency services directly.
                </div>
              </div>
            </article>

            {/* 10. Commercial */}
            <article id="commercial" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingBag className="text-amber-500" size={18} />
                10. Commercial Activities
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  WritingTools is designed to help researchers, students, and professionals improve their writing and
                  manage their documents more effectively. To keep the platform focused on this mission, any marketing
                  or advertising designed to promote third-party products or services to other users is prohibited.
                </p>
                <p>
                  This includes all forms of commercial communication: directing users to external purchasing pages,
                  embedding referral links in submitted documents, or soliciting goods and services through any feature
                  of the platform.
                </p>
              </div>
            </article>

            {/* 11. Transparency */}
            <article id="transparency" className="scroll-mt-24 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="text-amber-500" size={18} />
                11. Transparency
              </h2>
              <div className="text-sm leading-relaxed text-slate-800 dark:text-neutral-200 flex flex-col gap-3">
                <p>
                  WritingTools is committed to ensuring that users have a positive and trustworthy experience on our
                  platform. We review enforcement actions regularly and aim to communicate clearly about the reasons behind
                  content removals or account restrictions.
                </p>
                <p>
                  If you encounter content on WritingTools that you believe violates these Guidelines or applicable law,
                  please report it to us via:
                </p>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-neutral-900/30 border border-slate-200 dark:border-neutral-900 text-slate-700 dark:text-neutral-300 text-xs flex flex-col gap-1">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Content Moderation — WritingTools</p>
                  <p className="text-slate-700 dark:text-neutral-300">Paradox-Labs (pending formal registration)</p>
                  <p className="mt-1">
                    Email:{' '}
                    <a href="https://mail.google.com/mail/?view=cm&fs=1&to=biskmem@gmail.com&su=Inquiry%20from%20WritingTools" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline font-semibold">
                      biskmem@gmail.com
                    </a>
                  </p>
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
