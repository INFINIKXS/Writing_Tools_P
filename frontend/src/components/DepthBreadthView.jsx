import React, { useState } from 'react';
import { Sparkles, Upload, FileText, CheckCircle2, ChevronRight, ChevronDown, Wand2, Loader2, AlertCircle, TrendingUp, HelpCircle } from 'lucide-react';

export default function DepthBreadthView() {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [expandedDimension, setExpandedDimension] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.split('.').pop().toLowerCase();
      if (['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
        setFile(droppedFile);
        setText('');
        setError(null);
      } else {
        setError('Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file.');
      }
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setText('');
      setError(null);
    }
  };

  const clearFile = () => {
    setFile(null);
  };

  const runAnalysis = async () => {
    if (!text.trim() && !file) {
      setError('Please enter some text or upload a document to analyze.');
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    setExpandedDimension(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('text', text.trim());
      }

      const response = await fetch('/api/analyze-depth-breadth', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'An error occurred during evaluation.');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message || 'Failed to complete evaluation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-800 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-extrabold';
    if (score >= 60) return 'text-blue-800 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 font-extrabold';
    if (score >= 40) return 'text-amber-800 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-extrabold';
    return 'text-red-800 dark:text-red-400 border-red-500/30 bg-red-500/10 font-extrabold';
  };

  const getStrokeDashOffset = (score) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    return circumference - (score / 100) * circumference;
  };

  const subDimensionNames = {
    thesis_strength: 'Thesis Strength',
    close_reading_evidence: 'Close Reading & Evidence',
    lexical_depth: 'Lexical Depth & Precision',
    counter_argumentation: 'Counter-Argumentation',
    historical_contextualization: 'Historical Contextualization',
    t_shaped_integration: 'T-Shaped Integration',
    demographic_lens_diversity: 'Demographic/Lens Diversity'
  };

  const subDimensionDescriptions = {
    thesis_strength: 'Debatable, theory-driven, and contextually anchored central claim.',
    close_reading_evidence: 'Vertical evaluation of assumptions and critical appraisal of evidence.',
    lexical_depth: 'Precise, discipline-specific vocabulary rather than artificial complexity.',
    counter_argumentation: 'Structured Turn Against & Turn Back rebuttal mechanics.',
    historical_contextualization: 'Chronological tracking of concepts and theories over time.',
    t_shaped_integration: 'Synergy between specialized depth (vertical) and broad context (horizontal).',
    demographic_lens_diversity: 'Multiple sample cases, comparative settings, or theoretical lenses.'
  };

  return (
    <div className="animate-fade-in-up flex-1 min-h-0 flex flex-col w-full overflow-hidden">
      <header className="mb-5">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <Sparkles size={28} className="text-purple-400" />
          Depth & Breadth Analyzer
        </h1>
        <p className="text-sm text-slate-500 dark:text-neutral-500">
          Measure the analytical depth and contextual breadth of your writing against rigorous academic standards.
        </p>
      </header>

      <div className="flex gap-4 flex-1 min-h-0 min-w-0 w-full overflow-hidden pb-4">
        
        {/* === LEFT PANEL: INPUT & UPLOAD === */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4 self-stretch border-l-4 border-l-purple-500/50 glass-card p-5 overflow-y-auto">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <FileText size={16} className="text-purple-400" />
              Provide Writing Draft
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-500 mb-4">
              Paste your draft directly or upload your document file (PDF, DOCX, DOC, or TXT).
            </p>
          </div>

          {/* Text Area */}
          <div className="flex-1 flex flex-col min-h-[150px]">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (file) setFile(null);
              }}
              placeholder="Paste your paper, essay, thesis excerpt, or writing draft here to evaluate..."
              className="flex-1 w-full bg-white/[0.02] border border-white/8 rounded-xl p-4 text-sm text-neutral-200 leading-relaxed resize-none outline-none focus:border-purple-500/30 focus:ring-1 focus:ring-purple-500/20 transition-all placeholder-neutral-700 min-h-[120px]"
              disabled={loading}
              spellCheck="false"
            />
          </div>

          <div className="relative flex items-center my-2">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* File Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl p-5 text-center transition-all duration-200 ${
              isDragging
                ? 'border-purple-500 bg-purple-500/5'
                : file
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:border-white/20 bg-white/[0.01]'
            }`}
          >
            {file ? (
              <div className="flex flex-col items-center justify-center">
                <FileText size={28} className="text-emerald-400 mb-2 animate-bounce" />
                <span className="text-xs text-slate-700 dark:text-neutral-300 font-medium truncate max-w-[280px]">
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-neutral-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  onClick={clearFile}
                  className="mt-3 text-[10px] font-bold text-red-400 hover:text-red-800 dark:text-red-300 transition-colors uppercase tracking-wider"
                  disabled={loading}
                >
                  Remove File
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center">
                <Upload size={28} className="text-slate-500 dark:text-neutral-500 mb-2" />
                <span className="text-xs text-slate-700 dark:text-neutral-300 font-medium">
                  Drag & drop your file here
                </span>
                <span className="text-[10px] text-neutral-600 mt-1">
                  Supports PDF, DOCX, DOC, TXT
                </span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  disabled={loading}
                />
                <span className="mt-3 text-[10px] font-bold text-purple-400 hover:text-purple-800 dark:text-purple-300 transition-colors bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
                  Browse Files
                </span>
              </label>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={runAnalysis}
            disabled={loading || (!text.trim() && !file)}
            className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing Writing...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Evaluate Depth & Breadth
              </>
            )}
          </button>
        </div>

        {/* === RIGHT PANEL: RESULTS === */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          
          {/* Error Banner */}
          {error && (
            <div className="glass-card p-4 border-l-4 border-l-red-500/50 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* 1. BLANK STATE */}
          {!loading && !results && (
            <div className="flex-1 flex flex-col items-center justify-center glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 animate-pulse">
                <TrendingUp size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Analysis Preformed</h2>
              <p className="text-slate-500 dark:text-neutral-500 max-w-md text-sm leading-relaxed mb-6">
                Paste your manuscript or upload your document, then run the evaluation to generate multi-dimensional scores and detailed, actionable improvement suggestions.
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-xl text-left">
                <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    Analytical Depth
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-500 leading-relaxed">
                    Evaluates thesis debatability, close evidence reading, lexical precision, and counterargument mechanics.
                  </p>
                </div>
                <div className="bg-white/[0.01] border border-white/5 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-neutral-300 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Contextual Breadth
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-500 leading-relaxed">
                    Evaluates historical evolution tracing, interdisciplinary context synthesis, and demographic/lens diversity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. LOADING STATE (SKELETON) */}
          {loading && (
            <div className="flex-1 flex flex-col gap-5 glass-card p-6 overflow-hidden">
              <div className="flex gap-4 shrink-0">
                <div className="flex-1 h-32 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse"></div>
                <div className="flex-1 h-32 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse"></div>
              </div>
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="h-6 w-48 rounded bg-white/[0.02] animate-pulse"></div>
                <div className="flex-1 grid grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse"></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. RESULTS DISPLAY */}
          {results && !loading && (
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
              
              {/* Overall Scores Header Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                
                {/* Depth Card */}
                <div className="glass-card p-5 flex items-center justify-between border-t-2 border-t-purple-500">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Analytical Depth</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Excavation & Rigor</h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-500 max-w-[200px]">
                      Measures close reading capability, lexical precision, and logical counterargument integration.
                    </p>
                  </div>
                  <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="rgb(168, 85, 247)" strokeWidth="8" fill="transparent" 
                              strokeDasharray={2 * Math.PI * 40} strokeDashoffset={getStrokeDashOffset(results.depth_score)} 
                              strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-xl font-black text-slate-900 dark:text-white">{results.depth_score}</span>
                  </div>
                </div>

                {/* Breadth Card */}
                <div className="glass-card p-5 flex items-center justify-between border-t-2 border-t-blue-500">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Contextual Breadth</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Landscape & Horizon</h3>
                    <p className="text-xs text-slate-500 dark:text-neutral-500 max-w-[200px]">
                      Measures historical mapping, interdisciplinary context synthesis, and demographic/lens diversity.
                    </p>
                  </div>
                  <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="rgb(59, 130, 246)" strokeWidth="8" fill="transparent" 
                              strokeDasharray={2 * Math.PI * 40} strokeDashoffset={getStrokeDashOffset(results.breadth_score)} 
                              strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-xl font-black text-slate-900 dark:text-white">{results.breadth_score}</span>
                  </div>
                </div>

              </div>

              {/* Sub-dimensions details */}
              <div className="glass-card p-5 flex-1 min-h-[300px] flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                  <TrendingUp size={16} className="text-purple-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sub-Dimension Checklist</h3>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {Object.entries(results.sub_dimensions).map(([key, score]) => {
                    const isExpanded = expandedDimension === key;
                    const suggestions = results.suggestions[key] || [];
                    const hasSuggestions = suggestions.length > 0;
                    
                    return (
                      <div 
                        key={key} 
                        className={`bg-white/[0.01] border rounded-xl p-3.5 transition-all duration-200 flex flex-col justify-between ${
                          isExpanded 
                            ? 'border-purple-500/30 bg-purple-500/[0.02] col-span-1 md:col-span-2' 
                            : 'border-white/5 hover:bg-white/[0.03] hover:border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <h4 className="text-xs font-extrabold text-slate-900 dark:text-neutral-200">
                              {subDimensionNames[key] || key}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-normal">
                              {subDimensionDescriptions[key] || ''}
                            </p>
                          </div>
                          
                          {/* Score Pill */}
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(score)} shrink-0`}>
                            {score}/100
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 mt-3 shrink-0">
                          <div 
                            className={`h-1.5 rounded-full ${
                              score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>

                        {/* Expandable Suggestions list */}
                        {hasSuggestions && (
                          <div className="mt-3">
                            <button
                              onClick={() => setExpandedDimension(isExpanded ? null : key)}
                              className="text-[10px] text-purple-400 hover:text-purple-800 dark:text-purple-300 font-bold tracking-wide flex items-center gap-0.5 transition-colors uppercase"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown size={12} /> Hide Recommendations ({suggestions.length})
                                </>
                              ) : (
                                <>
                                  <ChevronRight size={12} /> Show Recommendations ({suggestions.length})
                                </>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="mt-2.5 space-y-2 border-t border-white/5 pt-2.5 animate-fade-in-up">
                                {suggestions.map((sug, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-neutral-300 leading-relaxed bg-white/[0.01] p-3 rounded-lg border border-white/5">
                                    <CheckCircle2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
                                    <span>{sug}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
