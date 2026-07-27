import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, XCircle, FileX, BarChart3, Loader2, FileSearch, Brain, ShieldCheck, BookOpen, Copy, ClipboardCheck, ScanSearch, GitCompare, RefreshCw, ShieldAlert } from 'lucide-react';
import DOMPurify from 'dompurify';

const STAGE_CONFIG = {
    parsing: { icon: FileSearch, label: 'Parsing Document', step: 1 },
    extracted: { icon: BookOpen, label: 'Text Extracted', step: 2 },
    scanning: { icon: ScanSearch, label: 'Python Regex Scan', step: 3 },
    analyzing: { icon: Brain, label: 'Advanced Matching', step: 4 },
    processing: { icon: Loader2, label: 'Processing', step: 4 },
    validating: { icon: GitCompare, label: 'Cross-Validation', step: 5 },
    verifying: { icon: ShieldCheck, label: 'String Verification', step: 6 },
    extracting: { icon: BookOpen, label: 'Source Extraction', step: 7 },
    complete: { icon: CheckCircle2, label: 'Complete', step: 8 },
    error: { icon: AlertCircle, label: 'Error', step: 0 },
};

export default function VerifierView({ hideHeader = false }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [isDragActive, setIsDragActive] = useState(false);
    const [progressStage, setProgressStage] = useState('');
    const [progressMessage, setProgressMessage] = useState('');
    const [progressLog, setProgressLog] = useState([]);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
    const handleDrop = (e) => {
        e.preventDefault(); setIsDragActive(false);
        if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
    };
    const handleFileChange = (e) => { if (e.target.files?.[0]) handleFileSelected(e.target.files[0]); };
    const handleFileSelected = (f) => {
        if (f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.docx') || f.name.toLowerCase().endsWith('.doc')) { setFile(f); setError(''); }
        else { setError('Please upload a PDF, DOCX, or DOC file.'); setFile(null); }
    };

    const verifyFile = async () => {
        if (!file) return;
        setLoading(true); setResults(null); setError('');
        setProgressStage(''); setProgressMessage(''); setProgressLog([]);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/verify', { method: 'POST', body: formData });

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            setProgressStage(event.stage);
                            setProgressMessage(event.message);
                            setProgressLog(prev => [...prev, { stage: event.stage, message: event.message }]);

                            if (event.stage === 'complete' && event.data) {
                                setResults(event.data);
                                setLoading(false);
                            } else if (event.stage === 'error') {
                                setError(event.message);
                                setLoading(false);
                            }
                        } catch (parseErr) { /* skip malformed events */ }
                    }
                }
            }
        } catch (err) {
            setError(err.message || 'Connection failed');
            setLoading(false);
        }
    };

    const currentStep = STAGE_CONFIG[progressStage]?.step || 0;
    const totalSteps = 7;

    const [copiedIdx, setCopiedIdx] = useState(null);
    const sanitizeHtml = (html) => DOMPurify.sanitize(html || '', { ALLOWED_TAGS: ['i', 'em', 'b', 'strong', 'br', 'p', 'span', 'sub', 'sup'] });
    const copyRichText = (plainText, htmlText, idx) => {
        if (htmlText) {
            const htmlBlob = new Blob([htmlText], { type: 'text/html' });
            const textBlob = new Blob([plainText], { type: 'text/plain' });
            navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]).then(() => {
                setCopiedIdx(idx);
                setTimeout(() => setCopiedIdx(null), 2000);
            });
        } else {
            navigator.clipboard.writeText(plainText).then(() => {
                setCopiedIdx(idx);
                setTimeout(() => setCopiedIdx(null), 2000);
            });
        }
    };

    return (
        <div className="space-y-4 animate-fade-in-up overflow-y-auto flex-1 min-h-0">
            {!hideHeader && (
                <header className="mb-6">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Citation Verifier</h1>
                    <p className="text-sm text-slate-500 dark:text-neutral-500">Cross-check inline citations against your reference list using deterministic analysis.</p>
                </header>
            )}

            {/* Upload Zone */}
            {!results && !loading && (
                <>
                    <div
                        className={`glass-card p-0 flex flex-col lg:flex-row transition-all min-h-[320px] overflow-hidden
              ${isDragActive ? 'border-slate-300 dark:border-white/20 bg-white/[0.06]' : ''}`}
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    >
                        {/* Left: Format examples (Always visible) */}
                        <div className="lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.015] p-6 flex flex-col">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500 mb-4">Accepted Reference Arrangement</p>
                            <div className="space-y-3 flex-1">
                                {/* Numbered example */}
                                <div className="bg-white/[0.03] border border-cyan-500/15 rounded-xl overflow-hidden">
                                    <div className="bg-cyan-500/5 border-b border-cyan-500/10 px-4 py-2 flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-[10px] font-bold text-cyan-400">1</span>
                                        <span className="text-xs font-bold uppercase tracking-widest text-cyan-400/80">Numbered</span>
                                    </div>
                                    <div className="p-3.5 space-y-2.5 font-mono text-xs leading-relaxed text-slate-600 dark:text-neutral-400">
                                        <div className="flex gap-2.5">
                                            <span className="text-cyan-500/70 shrink-0 font-bold">1.</span>
                                            <span>Smith, J. (2020). Title of article. <em className="text-slate-500 dark:text-neutral-500">Journal Name, 10</em>(2), 45-67.</span>
                                        </div>
                                        <div className="flex gap-2.5">
                                            <span className="text-cyan-500/70 shrink-0 font-bold">2.</span>
                                            <span>Jones, A. & Brown, B. (2019). Another title. Publisher.</span>
                                        </div>
                                        <div className="flex gap-2.5">
                                            <span className="text-cyan-500/70 shrink-0 font-bold">3.</span>
                                            <span>Lee, C. (2021). Third reference. <em className="text-slate-500 dark:text-neutral-500">Journal, 5</em>, 12-30.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* OR divider */}
                                <div className="flex items-center gap-2 py-1">
                                    <div className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">or</span>
                                    <div className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
                                </div>

                                {/* Spaced example */}
                                <div className="bg-white/[0.03] border border-purple-500/15 rounded-xl overflow-hidden">
                                    <div className="bg-purple-500/5 border-b border-purple-500/10 px-4 py-2 flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-[10px] text-purple-400">↕</span>
                                        <span className="text-xs font-bold uppercase tracking-widest text-purple-400/80">Spaced</span>
                                    </div>
                                    <div className="p-3.5 font-mono text-xs leading-relaxed text-slate-600 dark:text-neutral-400 space-y-4">
                                        <div>Smith, J. (2020). Title of article. <em className="text-slate-500 dark:text-neutral-500">Journal Name, 10</em>(2), 45-67.</div>
                                        <div>Jones, A. & Brown, B. (2019). Another title. Publisher.</div>
                                        <div>Lee, C. (2021). Third reference. <em className="text-slate-500 dark:text-neutral-500">Journal, 5</em>, 12-30.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Upload area (In-place state transition) */}
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 md:p-10">
                        {!file ? (
                            <>
                                <div
                                    className={`w-20 h-20 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 transition-transform cursor-pointer ${isDragActive ? 'scale-110' : 'hover:scale-105 hover:bg-white/[0.08]'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <UploadCloud size={40} className="text-slate-600 dark:text-neutral-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">DRAG & DROP YOUR FILES</h3>
                                <p className="text-sm text-neutral-600 mb-4">Supports <strong className="text-slate-600 dark:text-neutral-400">PDF</strong>, <strong className="text-slate-600 dark:text-neutral-400">DOCX</strong>, and <strong className="text-slate-600 dark:text-neutral-400">DOC</strong> (Max 50MB)</p>
                                <button className="btn-accent text-sm py-2.5 px-8 rounded-lg" onClick={() => fileInputRef.current?.click()}>UPLOAD FILES</button>
                                <p className="text-[11px] text-slate-500 dark:text-neutral-500 mt-5 max-w-xs leading-relaxed">💡 For best results, place your reference list on a <strong className="text-slate-600 dark:text-neutral-400">separate page</strong> with the heading <strong className="text-slate-600 dark:text-neutral-400">"References"</strong>.</p>
                                <p className="text-[11px] text-red-400/70 mt-1.5 max-w-xs leading-relaxed">⚠ References that run together on the same line may not be detected correctly.</p>
                            </>
                        ) : (
                            <div className="w-full max-w-md flex flex-col items-center animate-fade-in-up py-4">
                                {/* Glowing Badge */}
                                <div className="relative mb-5 flex items-center justify-center">
                                    <div className="absolute w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 animate-pulse" />
                                    <div className="relative w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        <CheckCircle2 size={24} className="text-emerald-400" />
                                    </div>
                                </div>
                                
                                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">File Uploaded &amp; Ready</span>

                                {/* Selected File Card */}
                                <div className="w-full bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3.5 mb-6 shadow-xl backdrop-blur-md">
                                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-amber-800 dark:text-amber-300 shrink-0">
                                        <File size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="truncate text-sm font-bold text-slate-900 dark:text-white mb-0.5">{file.name}</div>
                                        <div className="text-[11px] text-slate-600 dark:text-neutral-400">{file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Ready to verify'}</div>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="p-2 hover:bg-slate-200/60 dark:bg-white/10 rounded-xl text-slate-600 dark:text-neutral-400 hover:text-rose-400 transition-colors"
                                        title="Remove file"
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>

                                {/* Run Verification Button */}
                                <button
                                    onClick={() => verifyFile()}
                                    className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-neutral-950 bg-white hover:bg-neutral-100 transition-all duration-300 shadow-xl shadow-white/10 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
                                >
                                    <ShieldCheck size={18} className="text-neutral-950" />
                                    Run Citation Verification
                                </button>
                            </div>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.doc" className="hidden" />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 bg-red-500/10 text-red-800 dark:text-red-300 px-5 py-3.5 rounded-xl border border-red-500/20">
                            <AlertCircle size={18} className="text-red-400 shrink-0" /> <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}
                </>
            )}

            {/* Progress Tracker (Side-by-Side 2-Column Layout) */}
            {loading && (
                <div className="glass-card-static relative overflow-hidden p-6 md:p-8 border border-slate-200 dark:border-white/10 rounded-3xl bg-slate-100 dark:bg-neutral-950/80 backdrop-blur-2xl shadow-2xl min-h-[420px]">
                    {/* Ambient background glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full relative z-10">
                        {/* Left Column: Progress Centerpiece & Status */}
                        <div className="flex flex-col items-center lg:items-start text-center lg:text-left justify-center space-y-6 lg:pr-6 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 pb-6 lg:pb-0">
                            {/* Header Info Pill */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full">
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                    <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-widest">Audit Engine Active</span>
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-neutral-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-full">
                                    Step {Math.min(currentStep, totalSteps)} of {totalSteps}
                                </span>
                            </div>

                            {/* Icon & Stage Info */}
                            <div className="flex items-center gap-5">
                                {(() => {
                                    const StageIcon = STAGE_CONFIG[progressStage]?.icon || Loader2;
                                    return (
                                        <div className="relative shrink-0 flex items-center justify-center">
                                            {/* Outer spin ring */}
                                            <div className="absolute w-20 h-20 rounded-full border border-dashed border-amber-400/40 animate-spin-slow" style={{ animationDuration: '12s' }} />
                                            {/* Pulsing aura */}
                                            <div className="absolute w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse" />
                                            {/* Icon badge */}
                                            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-900/40 border border-amber-500/40 flex items-center justify-center shadow-xl shadow-amber-500/10">
                                                <StageIcon size={26} className={`text-amber-800 dark:text-amber-300 ${progressStage === 'analyzing' || progressStage === 'processing' ? 'animate-spin' : ''}`} />
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                                        {STAGE_CONFIG[progressStage]?.label || 'Initializing...'}
                                    </h3>
                                    <p className="text-xs text-slate-600 dark:text-neutral-400 max-w-sm leading-relaxed">{progressMessage}</p>
                                </div>
                            </div>

                            {/* Progress Bar & Percentage */}
                            <div className="w-full max-w-md space-y-2 pt-2">
                                <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="text-slate-600 dark:text-neutral-400">Overall Progress</span>
                                    <span className="text-amber-400 font-mono font-bold">{Math.round((currentStep / totalSteps) * 100)}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/10">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300 rounded-full transition-all duration-700 ease-out shadow-lg shadow-amber-500/30"
                                        style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Live Audit Activity Terminal Log */}
                        <div className="flex flex-col h-full justify-center">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-2">
                                    <ScanSearch size={15} className="text-amber-400" />
                                    <span className="text-xs font-extrabold uppercase tracking-widest text-slate-700 dark:text-neutral-300">Live Activity Terminal</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 dark:text-neutral-500">{progressLog.length} Events</span>
                            </div>

                            {/* Console Terminal Log Box */}
                            <div className="w-full bg-slate-200/80 dark:bg-black/60 rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-2.5 max-h-[300px] overflow-y-auto font-mono text-xs shadow-inner">
                                {progressLog.map((entry, i) => {
                                    const EntryIcon = STAGE_CONFIG[entry.stage]?.icon || Loader2;
                                    const isLatest = i === progressLog.length - 1;
                                    return (
                                        <div key={i} className={`flex items-center gap-3 py-1.5 px-3 rounded-xl transition-all ${isLatest ? 'bg-amber-500/20 border border-amber-500/40 text-amber-950 dark:text-amber-200 font-bold shadow-sm' : 'text-slate-700 dark:text-neutral-300 font-medium opacity-90 hover:opacity-100'}`}>
                                            <EntryIcon size={14} className={isLatest ? 'text-amber-800 dark:text-amber-300 shrink-0' : 'text-slate-500 dark:text-neutral-500 shrink-0'} />
                                            <span className="leading-snug break-words flex-1">{entry.message}</span>
                                            {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {results && !loading && (
                <div className="space-y-4 animate-fade-in-up">
                    {/* Report Header Bar */}
                    <div className="glass-card-static flex items-center justify-between px-6 py-4 rounded-2xl border border-slate-200 dark:border-white/10 sticky top-0 z-20 backdrop-blur-xl bg-slate-100 dark:bg-neutral-950/90 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Deterministic Citation Audit Report</h2>
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">Completed</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-neutral-400">Inline citations cross-referenced against document reference list</p>
                            </div>
                        </div>
                        <button onClick={() => { setResults(null); setFile(null); }} className="text-xs font-bold text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm">
                            <RefreshCw size={14} />
                            New Scan
                        </button>
                    </div>

                    {/* Executive KPI Stat Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Total Citations', value: results.num_unique_citations || 0, icon: FileSearch, color: 'cyan', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-800 dark:text-cyan-300' },
                            { label: 'Unique Matched', value: new Set((results.string_verification?.confirmed_matches || []).map(m => m?.canonical_ref_id || m?.matched_ref).filter(Boolean)).size || 0, icon: CheckCircle2, color: 'violet', border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-300' },
                            { label: 'Total References', value: results.num_references || 0, icon: BookOpen, color: 'purple', border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-800 dark:text-purple-300' },
                            { label: 'Missing Refs', value: results.string_verification?.unmatched_citations?.length || 0, icon: ShieldAlert, color: 'rose', border: 'border-rose-500/40', bg: 'bg-rose-500/15', text: 'text-rose-300', alert: (results.string_verification?.unmatched_citations?.length || 0) > 0 },
                            { label: 'Unused Refs', value: results.string_verification?.unmatched_references?.length || 0, icon: AlertCircle, color: 'amber', border: 'border-amber-500/40', bg: 'bg-amber-500/15', text: 'text-amber-800 dark:text-amber-300', alert: (results.string_verification?.unmatched_references?.length || 0) > 0 },
                        ].map((stat, i) => {
                            const StatIcon = stat.icon;
                            return (
                                <div key={i} className={`glass-card p-5 rounded-2xl border ${stat.border} ${stat.alert ? 'shadow-lg shadow-rose-500/5' : ''} transition-all duration-300 hover:scale-[1.02]`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-neutral-400">{stat.label}</span>
                                        <div className={`p-1.5 rounded-lg ${stat.bg} ${stat.text}`}>
                                            <StatIcon size={15} />
                                        </div>
                                    </div>
                                    <div className={`text-3xl md:text-4xl font-black ${stat.text}`}>{stat.value}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Unmatched Citations & Unused References Grid */}
                    {(results.string_verification?.unmatched_citations?.length > 0 || results.string_verification?.unmatched_references?.length > 0) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {results.string_verification?.unmatched_citations?.length > 0 && (
                                <div className="glass-card overflow-hidden rounded-2xl border border-rose-500/30">
                                    <div className="bg-rose-500/10 border-b border-rose-500/20 px-5 py-3.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <FileX size={18} className="text-rose-400" />
                                            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Citations Missing References</h3>
                                        </div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                                            {results.string_verification.unmatched_citations.length} Action Required
                                        </span>
                                    </div>
                                    <div className="p-4 max-h-[420px] min-h-[220px] overflow-y-auto custom-scrollbar space-y-2.5">
                                        {results.string_verification.unmatched_citations.map((c, i) => (
                                            <div key={i} className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-500/30 text-xs font-bold text-rose-950 dark:text-rose-100 font-mono flex items-center justify-between shadow-sm">
                                                <span>{typeof c === 'string' ? c : (c?.text || c?.citation || String(c || ''))}</span>
                                                <span className="text-[10px] uppercase font-sans font-extrabold text-rose-800 dark:text-rose-300 bg-rose-200/70 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/30 px-2 py-0.5 rounded">Not in bibliography</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {results.string_verification?.unmatched_references?.length > 0 && (
                                <div className="glass-card overflow-hidden rounded-2xl border border-amber-500/30">
                                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <AlertCircle size={18} className="text-amber-400" />
                                            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Unused References</h3>
                                        </div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                                            {results.string_verification.unmatched_references.length} Uncited
                                        </span>
                                    </div>
                                    <div className="p-4 max-h-[420px] min-h-[220px] overflow-y-auto custom-scrollbar space-y-2.5">
                                        {results.string_verification.unmatched_references.map((r, i) => (
                                            <div key={i} className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/30 text-xs font-semibold text-slate-900 dark:text-amber-100 leading-relaxed shadow-sm">
                                                {typeof r === 'string' ? r : (r?.ref || String(r || ''))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {results.string_verification?.disambiguation_warnings?.length > 0 && (
                        <div className="glass-card overflow-hidden border border-indigo-500/20">
                            <div className="bg-indigo-500/5 border-b border-indigo-500/10 px-5 py-3 flex items-center gap-2">
                                <AlertCircle size={16} className="text-indigo-400" />
                                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                                    Author-Year Disambiguation ({results.string_verification.disambiguation_warnings.length})
                                </h3>
                                <span className="ml-auto text-[9px] uppercase tracking-widest text-indigo-400/60 bg-indigo-500/10 px-2 py-0.5 rounded-full">Harvard Style</span>
                            </div>
                            <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                                <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
                                    When multiple references share the same first author and publication year, Harvard referencing requires
                                    letter suffixes (<span className="font-mono text-indigo-800 dark:text-indigo-300">a</span>, <span className="font-mono text-indigo-800 dark:text-indigo-300">b</span>, <span className="font-mono text-indigo-800 dark:text-indigo-300">c</span>…)
                                    on the year — both in the in-text citations <em>and</em> the reference list — assigned alphabetically by title.
                                </p>
                                {results.string_verification.disambiguation_warnings.map((w, i) => (
                                    <div key={i} className="bg-white/[0.02] p-4 rounded-xl border border-indigo-500/15 border-l-4 border-l-indigo-500/40">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                                                {w.type?.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{w.author} ({w.year})</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-neutral-300 mb-3 leading-relaxed">{w.message}</p>
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500">Affected References</div>
                                            {w.references?.map((ref, j) => (
                                                <div key={j} className="bg-white/3 p-3 rounded-lg border border-white/5 text-xs text-slate-700 dark:text-neutral-300 leading-relaxed flex gap-2">
                                                    <span className="shrink-0 text-indigo-400 font-bold">{w.year}{String.fromCharCode(97 + j)}</span>
                                                    <span className="break-words">{ref}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.duplicate_reference_groups?.length > 0 && (
                        <div className="glass-card overflow-hidden rounded-2xl border border-amber-500/30 mb-3">
                            <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-3.5 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <AlertCircle size={18} className="text-amber-400" />
                                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                        {results.duplicate_reference_groups.length} Duplicate Reference Group{results.duplicate_reference_groups.length !== 1 ? 's' : ''} Merged
                                    </h3>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">Auto-Resolved</span>
                            </div>
                            <div className="p-4 max-h-[350px] overflow-y-auto space-y-3">
                                {results.duplicate_reference_groups.map((group, i) => {
                                    const canonical = group[0];
                                    const duplicates = group.slice(1);
                                    
                                    const orderedEntry = results.ordered_references?.find(r => r.ref === canonical);
                                    const badge = orderedEntry?.display_number ? `[${orderedEntry.display_number}] ` : '';

                                    return (
                                        <div key={i} className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30 space-y-2.5 shadow-sm">
                                            <div className="text-xs text-slate-900 dark:text-amber-100 font-bold leading-relaxed flex items-start justify-between gap-2">
                                                <span>
                                                    <span className="text-amber-700 dark:text-amber-400 font-extrabold mr-2">{badge}</span>
                                                    {canonical}
                                                </span>
                                                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded shrink-0">Kept</span>
                                            </div>
                                            {duplicates.map((dup, j) => (
                                                <div key={j} className="flex gap-2 pl-3 text-xs text-slate-600 dark:text-neutral-400 border-l-2 border-amber-500/30">
                                                    <div className="bg-slate-100 dark:bg-black/40 p-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-800 dark:text-neutral-200 flex-1 break-words font-medium text-xs">
                                                        <span className="text-amber-800 dark:text-amber-400 font-bold mr-1.5">Merged duplicate:</span> {dup}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}



                    {results.ai_additional_citations?.length > 0 && (
                        <div className="glass-card overflow-hidden border border-amber-500/20">
                            <div className="bg-amber-500/5 border-b border-amber-500/10 px-5 py-3 flex items-center gap-2">
                                <ScanSearch size={16} className="text-amber-400" />
                                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Additional Citations Found ({results.ai_additional_citations.length})</h3>
                                <span className="ml-auto text-[9px] uppercase tracking-widest text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded-full">Review Required</span>
                            </div>
                            <div className="p-4 space-y-2">
                                <p className="text-xs text-slate-600 dark:text-neutral-400 mb-3">These citations were found by advanced matching but not by Python regex. They may be valid citations in an unusual format, or they may be false positives. Please review each one.</p>
                                {results.ai_additional_citations.map((c, i) => (
                                    <div key={i} className="bg-white/[0.02] p-3 rounded-lg border border-amber-500/10 text-sm text-slate-700 dark:text-neutral-300 font-mono">{typeof c === 'string' ? c : (c?.text || String(c || ''))}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.irregularities?.length > 0 && (
                        <div className="glass-card overflow-hidden mb-3">
                            <div className="bg-white/3 border-b border-white/5 px-5 py-3 flex items-center gap-2">
                                <AlertCircle size={16} className="text-purple-400" />
                                <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200">Irregularities ({results.irregularities.length})</h3>
                            </div>
                            <div className="p-4 max-h-[350px] overflow-y-auto space-y-3">
                                {results.irregularities.map((irr, i) => (
                                    <div key={i} className="bg-white/[0.02] p-4 rounded-xl border border-white/5 border-l-4 border-l-white/15">
                                        <span className="badge badge-purple mb-3 inline-block">{irr.type}</span>
                                        <p className="text-sm text-slate-700 dark:text-neutral-300 mb-3">{irr.details}</p>
                                        <div className="grid md:grid-cols-2 gap-3">
                                            <div className="bg-white/3 p-3 rounded-lg border border-white/5">
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1">Citation</div>
                                                <div className="font-mono text-xs text-slate-700 dark:text-neutral-300">{irr.citation}</div>
                                            </div>
                                            <div className="bg-white/3 p-3 rounded-lg border border-white/5">
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1">Reference</div>
                                                <div className="font-mono text-xs text-slate-700 dark:text-neutral-300">{irr.ref}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.python_formatting_warnings && typeof results.python_formatting_warnings === 'object' && Object.keys(results.python_formatting_warnings).filter(k => Array.isArray(results.python_formatting_warnings[k]) && results.python_formatting_warnings[k].length > 0).length > 0 && (
                        <div className="glass-card overflow-hidden border border-orange-500/20 mb-3">
                            <div className="bg-orange-500/5 border-b border-orange-500/10 px-5 py-3 flex items-center gap-2">
                                <AlertCircle size={16} className="text-orange-400" />
                                <h3 className="text-sm font-bold text-orange-200">Citation Formatting Warnings ({Object.keys(results.python_formatting_warnings).filter(k => results.python_formatting_warnings[k]?.length > 0).length})</h3>
                            </div>
                            <div className="p-4 max-h-[350px] overflow-y-auto space-y-3">
                                {Object.entries(results.python_formatting_warnings).filter(([k, w]) => Array.isArray(w) && w.length > 0).map(([citation, warnings], i) => (
                                    <div key={i} className="bg-white/[0.02] p-3 rounded-lg border border-orange-500/10">
                                        <div className="font-mono text-sm text-slate-700 dark:text-neutral-300 mb-2">{citation}</div>
                                        <ul className="list-disc pl-5 space-y-1">
                                            {warnings.map((w, j) => (
                                                <li key={j} className="text-xs text-orange-300/80">{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.consistency_warnings?.length > 0 && (
                        <div className="glass-card overflow-hidden border border-cyan-500/20 mb-3">
                            <div className="bg-cyan-500/5 border-b border-cyan-500/10 px-5 py-3 flex items-center gap-2">
                                <AlertCircle size={16} className="text-cyan-400" />
                                <h3 className="text-sm font-bold text-cyan-900 dark:text-cyan-200">Document Consistency Issues ({results.consistency_warnings.length})</h3>
                                <span className="ml-auto text-[9px] uppercase tracking-widest text-cyan-400/60 bg-cyan-500/10 px-2 py-0.5 rounded-full">Document-Wide</span>
                            </div>
                            <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                                {results.consistency_warnings.map((warning, i) => (
                                    <div key={i} className="bg-white/[0.02] p-4 rounded-xl border border-white/5 border-l-4 border-l-cyan-500/30">
                                        <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded mb-3">
                                            {warning.type?.replace(/_/g, ' ')}
                                        </span>
                                        <p className="text-sm text-slate-700 dark:text-neutral-300 mb-3">{warning.details}</p>
                                        {warning.groups?.length > 0 && (
                                            <div className={`grid gap-3 ${warning.groups.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                                                {warning.groups.map((group, j) => (
                                                    <div key={j} className="bg-white/3 p-3 rounded-lg border border-white/5">
                                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500 mb-2">
                                                            {group.label} <span className="text-cyan-400/70">({group.count})</span>
                                                        </div>
                                                        {group.examples?.map((ex, k) => (
                                                            <div key={k} className="font-mono text-xs text-slate-700 dark:text-neutral-300 bg-white/[0.03] px-2 py-1.5 rounded mb-1 border border-white/5">{ex}</div>
                                                        ))}
                                                        {group.count > 3 && (
                                                            <div className="text-[10px] text-neutral-600 mt-1">...and {group.count - 3} more</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.string_verification?.confirmed_matches?.length > 0 && (() => {
                        const detectedStyle = results.detected_style || 'apa';
                        const isVancouver = detectedStyle === 'vancouver';
                        const styleLabel = {
                            vancouver: 'Vancouver',
                            apa: 'APA',
                            mla: 'MLA',
                            chicago: 'Chicago',
                            harvard: 'Harvard',
                        }[detectedStyle] || detectedStyle.toUpperCase();

                        // Group citations by canonical_ref_id to avoid duplicate cards for the same reference
                        const uniqueMatchesMap = {};
                        (results.string_verification?.confirmed_matches || []).forEach(m => {
                        if (!m) return;
                            const refKey = m.canonical_ref_id || m.matched_ref;
                            if (!uniqueMatchesMap[refKey]) {
                                uniqueMatchesMap[refKey] = {
                                    ...m,
                                    citations: [m.citation]
                                };
                            } else if (!uniqueMatchesMap[refKey].citations.includes(m.citation)) {
                                uniqueMatchesMap[refKey].citations.push(m.citation);
                            }
                        });
                        const allMatches = Object.values(uniqueMatchesMap);

                        // Use ordered_references from backend to reorder matched refs
                        const orderedRefs = results.ordered_references || [];
                        const orderedRefTexts = orderedRefs.map(r => r.ref);

                        // Partition into good & problem, then sort each by the ordered_references sequence
                        const orderIndex = {};
                        orderedRefTexts.forEach((ref, idx) => { orderIndex[ref] = idx; });

                        const sortByOrder = (a, b) => {
                            const idxA = orderIndex[a.matched_ref] ?? 999;
                            const idxB = orderIndex[b.matched_ref] ?? 999;
                            return idxA - idxB;
                        };

                        const goodMatches = allMatches.filter(m => {
                            const conf = results.verbatim_references?.[m.matched_ref]?.confidence || 0;
                            return conf >= 0.75;
                        }).sort(sortByOrder);

                        const problemMatches = allMatches.filter(m => {
                            const conf = results.verbatim_references?.[m.matched_ref]?.confidence || 0;
                            return conf < 0.75;
                        }).sort(sortByOrder);

                        // Lookup helper: find ordered ref entry for a match
                        const getOrderedEntry = (matchedRef) => orderedRefs.find(r => r.ref === matchedRef);

                        const getConfidenceLabel = (score) => {
                            if (score === 100) return { label: '100% Confidence', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
                            if (score >= 85) return { label: `${score}% Confidence`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
                            if (score >= 60) return { label: `${score}% Confidence`, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
                            return { label: `${score}% Confidence`, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
                        };

                        const renderMatch = (m, i, isProblem) => {
                            const verbatimData = results.verbatim_references?.[m.matched_ref];
                            const verbatimText = verbatimData?.verbatim || m.matched_ref;
                            const verbatimHtml = verbatimData?.verbatim_html ? sanitizeHtml(verbatimData.verbatim_html) : null;
                            const confidence = verbatimData?.confidence || 0;
                            const conflict = verbatimData?.conflict;
                            const borderClass = isProblem ? 'border-l-amber-500/50' : conflict ? 'border-l-amber-500/50' : 'border-l-white/15';

                            const orderedEntry = getOrderedEntry(m.matched_ref);
                            const displayNumber = orderedEntry?.display_number;
                            const firstCitedAs = orderedEntry?.first_cited_as;

                            const isOutlier = orderedEntry?.is_style_outlier;
                            const refStyle = orderedEntry?.ref_style;
                            const styleNames = { vancouver: 'Vancouver', apa: 'APA', harvard: 'Harvard', mla: 'MLA', chicago: 'Chicago', nlm: 'NLM' };
                            const outlierBorderClass = isOutlier ? 'border-l-amber-500/50' : borderClass;

                            return (
                                <div key={i} className={`bg-white/[0.02] p-3 rounded-lg border border-white/5 border-l-4 ${outlierBorderClass}`}>
                                    <div className="flex items-start gap-3 mb-2">
                                        {isVancouver && displayNumber != null && (
                                            <span className="shrink-0 w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-xs font-bold text-sky-400">
                                                {displayNumber}
                                            </span>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-mono text-xs text-slate-700 dark:text-neutral-300 bg-white/3 px-3 py-2 rounded-lg mb-2 flex flex-wrap items-center gap-1">
                                                {m.citations ? m.citations.map((cit, idx) => {
                                                    const warnings = results.python_formatting_warnings?.[cit];
                                                            const hasWarnings = Array.isArray(warnings) && warnings.length > 0;
                                                    return (
                                                        <span key={idx} className="inline-flex items-center gap-1">
                                                            <span>{cit}</span>
                                                            {hasWarnings && (
                                                                <span className="group relative inline-flex items-center justify-center">
                                                                    <AlertCircle size={14} className="text-orange-500 cursor-help" />
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 border border-orange-500/30 rounded-lg text-[10px] text-orange-200 shadow-xl z-50" style={{ background: '#000000' }}>
                                                                        <div className="font-bold mb-1 border-b border-orange-500/20 pb-1">Formatting Warnings:</div>
                                                                        <ul className="list-disc pl-3 space-y-1 text-orange-300/80">
                                                                            {warnings.map((w, i) => <li key={i}>{w}</li>)}
                                                                        </ul>
                                                                    </div>
                                                                </span>
                                                            )}
                                                            {idx < m.citations.length - 1 && <span className="text-slate-500 dark:text-neutral-500 mx-1">|</span>}
                                                        </span>
                                                    );
                                                }) : m.citation}
                                            </div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1 flex items-center gap-2">
                                                Source Reference
                                                {confidence >= 0.8 && <span className="text-emerald-500">(✓ exact match)</span>}
                                                {confidence > 0 && confidence < 0.8 && <span className="text-amber-500">(~{Math.round(confidence * 100)}% match)</span>}
                                                {isOutlier && refStyle && (
                                                    <span className="ml-auto text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full normal-case tracking-normal">
                                                        {styleNames[refStyle] || refStyle} style
                                                    </span>
                                                )}
                                            </div>
                                            {verbatimHtml ? (
                                                <div className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-white/5 break-words" dangerouslySetInnerHTML={{ __html: verbatimHtml }} />
                                            ) : (
                                                <div className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed bg-white/[0.03] p-3 rounded-lg border border-white/5 break-words">{verbatimText}</div>
                                            )}
                                            {isVancouver && firstCitedAs && (
                                                <div className="text-[10px] text-neutral-600 mt-1.5">
                                                    First cited as: <span className="font-mono text-slate-500 dark:text-neutral-500">{firstCitedAs}</span>
                                                </div>
                                            )}
                                            {isProblem && (
                                                <div className="mt-2 text-[10px] text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 space-y-1">
                                                    <div className="font-bold uppercase tracking-widest">⚠ Why this match is flagged:</div>
                                                    {confidence < 0.6 && <div>• Very low similarity ({Math.round(confidence * 100)}%) — source text may contain merged references</div>}
                                                    {confidence >= 0.6 && confidence < 0.75 && <div>• Moderate similarity ({Math.round(confidence * 100)}%) — possible formatting differences or partial extraction</div>}
                                                    {verbatimText && verbatimText.length > 400 && <div>• Unusually long source text ({verbatimText.length} chars) — may contain multiple merged references</div>}
                                                    {conflict && <div>• Conflict: {conflict}</div>}
                                                </div>
                                            )}
                                            {!isProblem && conflict && (
                                                <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                                                    <AlertCircle size={12} className="shrink-0" />
                                                    <span>{conflict}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => copyRichText(verbatimText, verbatimHtml, `${isProblem ? 'p' : 'g'}-${i}`)}
                                            className="shrink-0 p-2 hover:bg-slate-200/60 dark:bg-white/10 rounded-lg text-slate-500 dark:text-neutral-500 hover:text-slate-900 dark:text-white transition-colors"
                                            title="Copy reference with formatting"
                                        >
                                            {copiedIdx === `${isProblem ? 'p' : 'g'}-${i}` ? <ClipboardCheck size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <>
                                {results.style_detection_confidence > 0 && (() => {
                                    const score = Math.round(results.style_detection_confidence);
                                    const confLabel = getConfidenceLabel(score);
                                    
                                    return (
                                        <div className="glass-card mb-3 p-4 flex flex-col md:flex-row justify-between gap-4 border-l-4 border-l-purple-500/50">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500 mb-1">Detected Style</div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{styleLabel}</h3>
                                                    <span className={`${confLabel.bg} ${confLabel.color} border ${confLabel.border} px-2 py-0.5 rounded text-xs font-semibold`}>
                                                        {confLabel.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="md:w-1/2 space-y-3">
                                                {results.style_all_scores && Object.keys(results.style_all_scores).length > 1 && (() => {
                                                    const styleNames = { vancouver: 'Vancouver', apa: 'APA', harvard: 'Harvard', mla: 'MLA', chicago: 'Chicago', nlm: 'NLM' };
                                                    const entries = Object.entries(results.style_all_scores).filter(([, v]) => v > 0);
                                                    return (
                                                        <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500 mb-2">Style Breakdown</div>
                                                            <div className="space-y-1.5">
                                                                {entries.map(([style, pct]) => (
                                                                    <div key={style} className="flex items-center gap-2">
                                                                        <span className="text-[10px] text-slate-600 dark:text-neutral-400 w-16 shrink-0">{styleNames[style] || style}</span>
                                                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full ${style === results.detected_style ? 'bg-purple-500' : 'bg-amber-500/60'}`}
                                                                                style={{ width: `${pct}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className={`text-[10px] font-semibold w-8 text-right ${style === results.detected_style ? 'text-purple-400' : 'text-amber-400/70'}`}>{pct}%</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                {results.style_detection_evidence?.length > 0 && (
                                                    <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 text-xs text-slate-700 dark:text-neutral-300 space-y-1">
                                                        <div className="font-semibold text-slate-600 dark:text-neutral-400 mb-1">Key Evidence:</div>
                                                        {results.style_detection_evidence.slice(0, 3).map((ev, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <span className="text-purple-400 shrink-0">•</span>
                                                                <span>{ev}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {/* Left panel — Good Matches (ordered) */}
                                <div className="glass-card overflow-hidden">
                                    <div className="bg-white/3 border-b border-white/5 px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={16} className="text-emerald-400" />
                                            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{styleLabel} Reference Order ({goodMatches.length})</h3>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const copyList = goodMatches.map((m, idx) => {
                                                    const text = results.verbatim_references?.[m.matched_ref]?.verbatim || m.matched_ref;
                                                    const entry = getOrderedEntry(m.matched_ref);
                                                    if (isVancouver && entry?.display_number != null) {
                                                        return `${entry.display_number}. ${text}`;
                                                    }
                                                    return text;
                                                });
                                                const allPlain = copyList.join('\n\n');
                                                const allHtml = goodMatches
                                                    .map(m => results.verbatim_references?.[m.matched_ref]?.verbatim_html)
                                                    .filter(Boolean)
                                                    .map(h => sanitizeHtml(h));
                                                copyRichText(allPlain, allHtml.length > 0 ? allHtml.join('<br><br>') : null, 'all-good');
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            {copiedIdx === 'all-good' ? <ClipboardCheck size={13} /> : <Copy size={13} />}
                                            {copiedIdx === 'all-good' ? 'Copied!' : 'Copy All'}
                                        </button>
                                    </div>
                                    <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                                        {goodMatches.length > 0 ? goodMatches.map((m, i) => renderMatch(m, i, false)) : (
                                            <div className="text-xs text-slate-500 dark:text-neutral-500 text-center py-4">No high-confidence matches</div>
                                        )}
                                    </div>
                                </div>

                                {/* Right panel — Problematic Matches */}
                                <div className="glass-card overflow-hidden border border-amber-500/15">
                                    <div className="bg-amber-500/5 border-b border-amber-500/10 px-5 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle size={16} className="text-amber-400" />
                                            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Needs Review ({problemMatches.length})</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {problemMatches.length > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const allPlain = problemMatches
                                                            .map(m => results.verbatim_references?.[m.matched_ref]?.verbatim || m.matched_ref)
                                                            .join('\n\n');
                                                        const allHtml = problemMatches
                                                            .map(m => results.verbatim_references?.[m.matched_ref]?.verbatim_html)
                                                            .filter(Boolean)
                                                            .map(h => sanitizeHtml(h));
                                                        copyRichText(allPlain, allHtml.length > 0 ? allHtml.join('<br><br>') : null, 'all-review');
                                                    }}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-400/70 hover:text-amber-900 dark:text-amber-200 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/15 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    {copiedIdx === 'all-review' ? <ClipboardCheck size={14} className="text-amber-800 dark:text-amber-300" /> : <Copy size={14} />}
                                                    {copiedIdx === 'all-review' ? 'Copied!' : 'Copy All'}
                                                </button>
                                            )}
                                            {problemMatches.length > 0 && (
                                                <span className="text-[9px] uppercase tracking-widest text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded-full">Low Confidence</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 max-h-[500px] overflow-y-auto space-y-2">
                                        {problemMatches.length > 0 ? problemMatches.map((m, i) => renderMatch(m, i, true)) : (
                                            <div className="text-xs text-emerald-500 text-center py-4">✓ All matches are high confidence</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
