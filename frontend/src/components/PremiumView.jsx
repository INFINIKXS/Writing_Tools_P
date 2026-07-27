import React, { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, CreditCard, Lock, ShieldCheck, HelpCircle, Users, Zap, Award, Sparkles, AlertCircle, FileText, Bookmark, ArrowLeftRight, PenTool, Fingerprint } from 'lucide-react';
import Footer from './Footer';

export default function PremiumView({ onNavigate, isPremium, onOpenCookieModal, onUpgrade }) {
  const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' | 'semi' | 'annual'
  const [docCount, setDocCount] = useState(10); // Number of documents / research projects per month
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentStep, setPaymentStep] = useState('form'); // 'form' | 'processing' | 'success'
  
  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [formError, setFormError] = useState('');

  // Plans data
  const pricing = {
    monthly: { price: 3.00, monthlyPrice: 3.00, label: 'Billed monthly', savings: 0, id: 'monthly' },
    semi: { price: 15.00, monthlyPrice: 2.50, label: 'Billed $15.00 every 6 months', savings: 16, id: 'semi-annual' },
    annual: { price: 24.00, monthlyPrice: 2.00, label: 'Billed $24.00 every 12 months', savings: 33, id: 'annual' }
  };

  const currentPlan = pricing[billingCycle];

  // Calculators based on actual feature capabilities
  const calculateCitationsVerified = (docs) => docs * 25;
  const calculatePDFConversions = (docs) => docs * 4;
  const calculateDeepAnalyses = (docs) => docs * 2;
  const calculateHoursSaved = (docs) => Math.round(docs * 3.5);
  const getResearchGrade = (docs) => {
    if (docs < 5) return 'Individual Author';
    if (docs < 20) return 'Postgrad & Faculty';
    return 'Institutional Lab';
  };

  const faqs = [
    {
      q: "How does the 7-day money-back guarantee work?",
      a: "In alignment with the Federal Competition and Consumer Protection Act (FCCPA) of Nigeria, we provide a full, hassle-free refund if you cancel your subscription within 7 days of purchase. Simply contact our support team or cancel from your billing dashboard."
    },
    {
      q: "What payment methods do you support?",
      a: "We support all major international and local credit/debit cards (Visa, MasterCard, Verve), PayPal, and local bank transfers via secure payment gateways."
    },
    {
      q: "Can I cancel my subscription anytime?",
      a: "Yes, you can cancel your subscription at any time with a single click in your Account settings. You will retain access to your Premium benefits until the end of your current billing period."
    },
    {
      q: "Do you offer discounts for students or researchers?",
      a: "Yes! Students and academic researchers are eligible for an additional 15% discount. Simply check the student discount option during checkout or contact us with your university credentials."
    },
    {
      q: "Is my data kept private? Do you train models on my documents?",
      a: "Privacy is our core principle. Unlike free models, we guarantee that we never store, log, or use any documents, PDFs, or citations processed by our Premium subscribers to train AI models. Your intellectual property remains entirely yours."
    }
  ];

  const handleCheckoutOpen = (plan) => {
    if (isPremium) return; // Already premium
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
    setPaymentStep('form');
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setCardCvc('');
    setFormError('');
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (!cardNumber || !cardName || !cardExpiry || !cardCvc) {
      setFormError('Please fill in all credit card details.');
      return;
    }
    setFormError('');
    setPaymentStep('processing');
    
    // Simulate payment gateway delay
    setTimeout(() => {
      setPaymentStep('success');
      onUpgrade(); // Upgrade state in parent
    }, 2000);
  };

  return (
    <div className="overflow-y-auto flex-1 min-h-0 hidden-scrollbar pb-0 pt-4 flex flex-col justify-between">
      <div>
        {/* ─── Hero Section ─── */}
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in-up px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
            <Sparkles size={13} />
            <span>Write & Process Without Limits</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
            Elevate Your Academic Workflow <br />
            with <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-white bg-clip-text text-transparent">WritingTools Premium</span>
          </h2>
          <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto">
            Audit citation libraries, convert &amp; edit PDFs, analyze sentence logic, and run deep academic literature synthesis with zero restriction caps.
          </p>

          {/* Toggle Switcher */}
          <div className="mt-10 inline-flex items-center p-1.5 bg-neutral-950 rounded-2xl border border-neutral-900">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                billingCycle === 'monthly' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('semi')}
              className={`px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                billingCycle === 'semi' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Semi-Annual
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                Save 16%
              </span>
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                billingCycle === 'annual' ? 'bg-white text-black animate-pulse-glow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Annual
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                Save 33%
              </span>
            </button>
          </div>
        </div>

        {/* ─── Pricing Cards ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1200px] mx-auto px-4 mb-20">
          
          {/* Free Plan */}
          <div className="glass-card-static p-8 flex flex-col justify-between border-neutral-900 bg-neutral-950/40 relative group hover:border-neutral-800 transition-all duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Free Tier</span>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold tracking-tight">$0</span>
                <span className="ml-1 text-sm font-semibold text-neutral-500">/mo</span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">Essential tools for basic document checks</p>
              
              <div className="w-full h-px bg-neutral-900 my-6" />
              
              <ul className="space-y-4 text-xs text-neutral-400 text-left">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-600 shrink-0" />
                  <span>Citation Verifier (5 audits/day, 20 source cap)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-600 shrink-0" />
                  <span>PDF &amp; File Conversions (3/day, 10MB file max)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-600 shrink-0" />
                  <span>Interactive PDF Viewer &amp; Basic Markings</span>
                </li>
                <li className="flex items-center gap-2.5 opacity-40">
                  <X size={14} className="text-neutral-600 shrink-0" />
                  <span>2-Pass GPU PDF Compression &amp; Batch Tools</span>
                </li>
                <li className="flex items-center gap-2.5 opacity-40">
                  <X size={14} className="text-neutral-600 shrink-0" />
                  <span>Deep Literature Synthesis &amp; Style Analysis</span>
                </li>
              </ul>
            </div>
            
            <button
              disabled
              className="mt-8 w-full py-3 rounded-xl border border-neutral-800 text-neutral-500 font-semibold text-xs tracking-wider uppercase bg-transparent"
            >
              Current Plan
            </button>
          </div>

          {/* Premium Plan (Featured) */}
          <div className="relative rounded-2xl p-[1px] overflow-hidden group">
            {/* Animated Gold Segmented Border Ring */}
            <div className="absolute inset-[-4px] rounded-2xl -z-10 bg-[conic-gradient(from_var(--angle),transparent_0%,transparent_10%,#4a3a10_20%,#d4af37_40%,#ffffff_50%,transparent_60%,#4a3a10_70%,#d4af37_90%,#ffffff_100%)] animate-[spin-angle_10s_linear_infinite]" />
            
            <div className="glass-card-static p-8 flex flex-col justify-between h-full bg-black/95 relative z-10">
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Premium Pro</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Most Popular
                  </span>
                </div>
                <div className="mt-4 flex items-baseline text-white">
                  <span className="text-4xl font-extrabold tracking-tight">
                    ${currentPlan.monthlyPrice.toFixed(2)}
                  </span>
                  <span className="ml-1 text-sm font-semibold text-neutral-500">/mo</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">{currentPlan.label}</p>
                
                <div className="w-full h-px bg-neutral-900 my-6" />
                
                <ul className="space-y-4 text-xs text-neutral-300 text-left">
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Unlimited Citation Verifier Audits &amp; Library Export</span>
                  </li>
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Unlimited PDF &amp; Document Conversions (Word, Excel, PPT, HTML)</span>
                  </li>
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Full Interactive PDF Text Editor, Watermark &amp; Redact Suites</span>
                  </li>
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Depth &amp; Breadth Academic Synthesis &amp; Gap Analysis</span>
                  </li>
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Style Analyser &amp; 4-Stage Sentence Logic Mold Audits</span>
                  </li>
                  <li className="flex items-center gap-2.5 font-medium">
                    <Check size={14} className="text-amber-400 shrink-0" />
                    <span>Priority 2-Pass GPU Compression &amp; Fast File Processing</span>
                  </li>
                </ul>
              </div>
              
              <button
                onClick={() => handleCheckoutOpen(currentPlan)}
                disabled={isPremium}
                className={`mt-8 w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 ${
                  isPremium
                    ? 'bg-neutral-900 border border-neutral-800 text-emerald-400 cursor-default flex items-center justify-center gap-1.5'
                    : 'bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)]'
                }`}
              >
                {isPremium ? (
                  <>
                    <Award size={14} />
                    Plan Active
                  </>
                ) : (
                  'Upgrade to Premium'
                )}
              </button>
            </div>
          </div>

          {/* Team Plan */}
          <div className="glass-card-static p-8 flex flex-col justify-between border-neutral-900 bg-neutral-950/40 hover:border-neutral-800 transition-all duration-300">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">For Teams</span>
              <div className="mt-4 flex items-baseline text-white">
                <span className="text-4xl font-extrabold tracking-tight">$1.50</span>
                <span className="ml-1 text-sm font-semibold text-neutral-500">/mo/user</span>
              </div>
              <p className="mt-2 text-xs text-neutral-500">Premium access for laboratories &amp; research teams (5+ seats)</p>
              
              <div className="w-full h-px bg-neutral-900 my-6" />
              
              <ul className="space-y-4 text-xs text-neutral-400 text-left">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-400 shrink-0" />
                  <span>All Premium Pro benefits included</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-400 shrink-0" />
                  <span>Centralized admin seat billing dashboard</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-400 shrink-0" />
                  <span>Shared institutional reference library directories</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-400 shrink-0" />
                  <span>Custom citation style models for university labs</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-neutral-400 shrink-0" />
                  <span>Dedicated priority account manager SLA</span>
                </li>
              </ul>
            </div>
            
            <button
              onClick={() => onNavigate('settings')}
              className="mt-8 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 text-slate-950 dark:text-white font-bold text-xs tracking-wider uppercase transition-all duration-200"
            >
              Contact Sales
            </button>
          </div>
        </div>

        {/* ─── Interactive Feature-Based ROI Estimator ─── */}
        <div className="max-w-[1000px] mx-auto px-4 mb-24">
          <div className="glass-card-static p-8 md:p-10 border-neutral-900 bg-neutral-950/20 text-left">
            <div className="flex flex-col lg:flex-row gap-10 items-center">
              {/* Slider Section */}
              <div className="flex-1 w-full space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                    <Zap size={11} className="text-amber-400" />
                    Feature Value Calculator
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white">Estimate Your Feature Usage &amp; Return</h3>
                  <p className="text-neutral-500 text-xs md:text-sm">
                    Drag the slider to select your estimated monthly volume of academic documents, papers, and manuscripts handled.
                  </p>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-400 text-xs font-semibold">Monthly Papers &amp; Documents:</span>
                    <span className="text-2xl font-extrabold text-amber-400 font-mono">
                      {docCount} {docCount === 1 ? 'document' : 'documents'} / mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={docCount}
                    onChange={(e) => setDocCount(parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600 font-bold font-mono">
                    <span>1 doc</span>
                    <span>10 docs</span>
                    <span>25 docs</span>
                    <span>40 docs</span>
                    <span>50+ docs</span>
                  </div>
                </div>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-2 gap-4 w-full lg:w-[45%] shrink-0">
                <div className="glass-inner p-4 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Citations Verified</span>
                  <span className="text-2xl font-extrabold text-white mt-1 font-mono">
                    ~{calculateCitationsVerified(docCount)}
                  </span>
                  <span className="text-[9px] text-neutral-600 mt-0.5">PubMed &amp; CrossRef audits</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">File Conversions</span>
                  <span className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
                    ~{calculatePDFConversions(docCount)}
                  </span>
                  <span className="text-[9px] text-neutral-600 mt-0.5">PDF, Word, Excel &amp; PPT</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Deep Audits</span>
                  <span className="text-2xl font-extrabold text-white mt-1 font-mono">
                    ~{calculateDeepAnalyses(docCount)}
                  </span>
                  <span className="text-[9px] text-neutral-600 mt-0.5">Style &amp; synthesis runs</span>
                </div>
                <div className="glass-inner p-4 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Time Saved</span>
                  <span className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
                    ~{calculateHoursSaved(docCount)}h
                  </span>
                  <span className="text-[9px] text-neutral-600 mt-0.5">Hours saved per month</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Detailed Comparison Table ─── */}
        <div className="max-w-[1000px] mx-auto px-4 mb-24 text-left">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-6 text-center">Compare Modules &amp; Feature Limits</h3>
          <div className="glass-card-static overflow-hidden border-neutral-900">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-neutral-300">
                <thead>
                  <tr className="border-b border-neutral-900 bg-neutral-950">
                    <th className="py-4 px-6 font-bold text-left text-neutral-400">Platform Capability</th>
                    <th className="py-4 px-6 font-bold text-left text-neutral-400">Free Tier</th>
                    <th className="py-4 px-6 font-bold text-left text-amber-400">Premium Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60">
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">Citation &amp; Reference Manager</td>
                    <td className="py-4 px-6 text-neutral-500">5 audits/day, 20 source cap</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      Unlimited audits, BibTeX/RIS export, cloud library
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">PDF &amp; File Conversion Tools</td>
                    <td className="py-4 px-6 text-neutral-500">3 conversions/day, 10MB limit</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      Unlimited PDF to Word/Excel/PPT/HTML, batch multi-file
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">PDF Text &amp; Security Workspaces</td>
                    <td className="py-4 px-6 text-neutral-500">Basic viewer &amp; line markings</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      Full PDF text edit, Redact PDF, Lock/Unlock, Watermark
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">Depth &amp; Breadth Literature Synthesizer</td>
                    <td className="py-4 px-6 text-neutral-500">Single-source preview mode</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      Full multi-perspective debate modeling &amp; gap analysis
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">Style Analyser &amp; Sentence Logic</td>
                    <td className="py-4 px-6 text-neutral-500">Standard draft check</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      4-Stage CSFP sentence logic molds &amp; academic cadence
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-semibold text-white">2-Pass GPU Compression Engine</td>
                    <td className="py-4 px-6 text-neutral-500">Standard single-pass</td>
                    <td className="py-4 px-6 font-medium text-white flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-400" />
                      High-ratio 2-pass GPU engine with target size control
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ─── Frequently Asked Questions ─── */}
        <div className="max-w-[800px] mx-auto px-4 mb-20 text-left">
          <h3 className="text-xl md:text-2xl font-bold text-white mb-8 text-center flex items-center justify-center gap-2">
            <HelpCircle size={22} className="text-neutral-500" />
            Frequently Asked Questions
          </h3>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div
                  key={index}
                  className="glass-card-static overflow-hidden border-neutral-900 bg-neutral-950/20 transition-all duration-300"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : index)}
                    className="w-full py-5 px-6 flex justify-between items-center text-white hover:bg-white/5 transition-all text-left"
                  >
                    <span className="font-semibold text-sm">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp size={16} className="text-neutral-500 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-neutral-500 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-neutral-400 text-xs leading-relaxed border-t border-slate-200 dark:border-neutral-900/60 animate-fade-in-up">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Footer Section ─── */}
      <Footer onNavigate={onNavigate} onOpenCookieModal={onOpenCookieModal} />

      {/* ─── Checkout Modal ─── */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md glass-card-static bg-neutral-950 border-neutral-800 p-6 md:p-8 relative text-left shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsCheckoutOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>

            {paymentStep === 'form' && (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Lock size={18} className="text-amber-400" />
                    Secure Checkout
                  </h3>
                  <p className="text-neutral-500 text-xs mt-1">Complete your subscription setup securely</p>
                </div>

                {/* Selected Plan Details */}
                <div className="glass-inner p-4 bg-neutral-900/40 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Selected Plan</span>
                    <p className="text-white font-bold text-sm mt-0.5 capitalize">{selectedPlan?.id} Premium</p>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-extrabold text-lg">${selectedPlan?.price.toFixed(2)}</span>
                    <p className="text-neutral-500 text-[10px]">{selectedPlan?.label}</p>
                  </div>
                </div>

                {/* Secure Badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400">
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                  <span>FCCPA Compliant: 7-day money-back guarantee active. Cancel anytime.</span>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Credit Card Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Jane Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Card Number</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                          const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
                          setCardNumber(formatted);
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors"
                        required
                      />
                      <CreditCard size={14} className="absolute left-3.5 top-3.5 text-neutral-600" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '').substring(0, 4);
                          if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
                          setCardExpiry(val);
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors text-center"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">CVC / CVV</label>
                      <input
                        type="password"
                        placeholder="•••"
                        maxLength="3"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-500 transition-colors text-center"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs tracking-wider uppercase hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] mt-4"
                >
                  Pay Now
                </button>
              </form>
            )}

            {paymentStep === 'processing' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
                <h4 className="text-white font-bold text-sm pt-2">Verifying Transaction</h4>
                <p className="text-neutral-500 text-xs max-w-[240px]">
                  Securing authorization from bank servers. Do not refresh or close window.
                </p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="py-6 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-[bounce_1s_infinite]">
                  <Sparkles size={32} />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Subscription Complete!</h4>
                  <p className="text-emerald-400 font-semibold text-xs mt-1">Welcome to WritingTools Premium</p>
                  <p className="text-neutral-500 text-xs mt-4 max-w-sm">
                    All limits have been lifted. You can now use Citation Verifier, PDF &amp; Document Conversion Tools, PDF Text Editor, Depth &amp; Breadth Synthesizer, and Style Analyser without constraints.
                  </p>
                </div>
                <button
                  onClick={() => setIsCheckoutOpen(false)}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-white font-bold text-xs tracking-wider uppercase transition-all"
                >
                  Start Writing
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

