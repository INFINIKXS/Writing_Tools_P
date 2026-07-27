import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen, Search, Upload, Check, Copy, AlertCircle, FileText,
  Sparkles, Loader2, RefreshCw, Plus, Trash2, Tag, CaseSensitive, X
} from 'lucide-react';

const CATEGORIES = ['All', 'Noun', 'Verb', 'Adjective', 'Adverb', 'Phrase'];

const CATEGORY_STYLES = {
  All: {
    bg: 'bg-neutral-500/10',
    text: 'text-slate-700 dark:text-neutral-300',
    border: 'border-neutral-500/20',
    dot: 'bg-neutral-400',
    badge: 'border-neutral-500/30 text-slate-700 dark:text-neutral-300 bg-neutral-950/20'
  },
  Noun: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/30 text-emerald-800 dark:text-emerald-300 bg-emerald-950/20'
  },
  Verb: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    dot: 'bg-cyan-400',
    badge: 'border-cyan-500/30 text-cyan-800 dark:text-cyan-300 bg-cyan-950/20'
  },
  Adjective: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    dot: 'bg-indigo-400',
    badge: 'border-indigo-500/30 text-indigo-800 dark:text-indigo-300 bg-indigo-950/20'
  },
  Adverb: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    badge: 'border-emerald-500/30 text-amber-800 dark:text-amber-300 bg-amber-950/20'
  },
  Phrase: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    dot: 'bg-rose-400',
    badge: 'border-rose-500/30 text-rose-300 bg-rose-950/20'
  }
};

export default function VocabularyBankView() {
  const [words, setWords] = useState([]);
  const [allWords, setAllWords] = useState([]);  // full list for stats (unfiltered)
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Manual Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newWord, setNewWord] = useState({
    word: '',
    pos: 'noun',
    definition: '',
    example_sentence: '',
    domain: 'general'
  });
  const [adding, setAdding] = useState(false);

  // PDF Upload / Mining State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isMining, setIsMining] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [minedResults, setMinedResults] = useState([]);
  
  const fileInputRef = useRef(null);

  // Fetch ALL words (unfiltered) for accurate stats
  const fetchAllWords = async () => {
    try {
      const res = await fetch('/api/vocabularybank/words?limit=500');
      if (res.ok) {
        const data = await res.json();
        setAllWords(data.words || []);
      }
    } catch (err) {
      console.error("Failed to fetch all vocabulary for stats:", err);
    }
  };

  // Fetch words from backend (respects active filter)
  const fetchWords = async () => {
    setLoading(true);
    try {
      const posParam = activeCategory === 'All' ? '' : `?pos=${activeCategory.toLowerCase()}`;
      const res = await fetch(`/api/vocabularybank/words${posParam}`);
      if (res.ok) {
        const data = await res.json();
        setWords(data.words || []);
      }
    } catch (err) {
      console.error("Failed to fetch vocabulary:", err);
    } finally {
      setLoading(false);
    }
  };

  // On mount: load both all-words (for stats) and filtered view
  useEffect(() => {
    fetchAllWords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchWords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Handle Search
  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      fetchWords();
      return;
    }
    try {
      const res = await fetch(`/api/vocabularybank/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setWords(data.words || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  // Add Word manually
  const handleAddWord = async (e) => {
    e.preventDefault();
    if (!newWord.word.trim() || !newWord.definition.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/vocabularybank/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWord)
      });
      if (res.ok) {
        setNewWord({
          word: '',
          pos: 'noun',
          definition: '',
          example_sentence: '',
          domain: 'general'
        });
        setAddModalOpen(false);
        fetchWords();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  // Delete word
  const handleDeleteWord = async (wordId) => {
    if (!confirm('Are you sure you want to delete this word from your vocabulary bank?')) return;
    try {
      const res = await fetch(`/api/vocabularybank/words/${wordId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setWords(prev => prev.filter(w => w.id !== wordId));
        setAllWords(prev => prev.filter(w => w.id !== wordId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and Drop File Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const extractBatchMetadata = async (newFileStates) => {
    if (newFileStates.length === 0) return;

    const formData = new FormData();
    newFileStates.forEach(fs => {
      formData.append('files', fs.file);
    });

    try {
      const response = await fetch('/api/vocabularybank/batch-extract-metadata', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to extract metadata: ${response.statusText}`);
      }

      const data = await response.json();
      const extractedDocs = data.documents || [];

      setSelectedFiles(prev => prev.map(f => {
        // Find matching extraction result by filename
        const match = extractedDocs.find(d => d.filename === f.file.name);
        if (match) {
          let domainVal = 'general';
          const returnedDomain = (match.domain || '').toLowerCase().trim();
          if (returnedDomain.includes('computer')) domainVal = 'computer science';
          else if (returnedDomain.includes('biology')) domainVal = 'biology';
          else if (returnedDomain.includes('medicine')) domainVal = 'medicine';
          else if (returnedDomain.includes('economic')) domainVal = 'economics';
          else if (returnedDomain.includes('social') || returnedDomain.includes('sociology')) domainVal = 'social sciences';

          return {
            ...f,
            status: 'ready',
            metadata: {
              title: match.source_title || f.metadata.title,
              domain: domainVal,
              year: (match.publication_year || new Date().getFullYear()).toString()
            }
          };
        }
        
        // Fallback for files that were part of the batch but not matched
        const wasInBatch = newFileStates.some(nf => nf.id === f.id);
        if (wasInBatch && f.status === 'extracting') {
          return { ...f, status: 'ready' };
        }

        return f;
      }));

    } catch (err) {
      console.error("Batch metadata extraction failed:", err);
      // Fallback: set all extracting files in this batch to ready
      setSelectedFiles(prev => prev.map(f => {
        const wasInBatch = newFileStates.some(nf => nf.id === f.id);
        if (wasInBatch && f.status === 'extracting') {
          return { ...f, status: 'ready' };
        }
        return f;
      }));
    }
  };

  const handleFilesAdded = (filesList) => {
    const files = Array.from(filesList).filter(f => f.type === "application/pdf");
    if (files.length === 0) {
      alert("Please upload PDF documents only.");
      return;
    }
    const newFiles = files.map(file => {
      const id = Math.random().toString(36).substring(7);
      const titleWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      return {
        id,
        file,
        status: 'extracting',
        progress: 0,
        metadata: { 
          title: titleWithoutExt,
          domain: 'general',
          year: new Date().getFullYear().toString()
        }
      };
    });
    
    setSelectedFiles(prev => {
      const updated = [...prev, ...newFiles];
      // Fire off batch extraction
      extractBatchMetadata(newFiles);
      return updated;
    });
  };

  const updateFileMetadata = (id, key, val) => {
    setSelectedFiles(prev => prev.map(f => f.id === id ? { ...f, metadata: { ...f.metadata, [key]: val } } : f));
  };

  // Mine vocabulary from selected PDFs
  const mineAllFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsMining(true);
    setMinedResults([]);

    const promises = selectedFiles.map(async (fileState) => {
      setSelectedFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'mining', progress: 50 } : f));
      
      const formData = new FormData();
      formData.append('files', fileState.file);

      try {
        const res = await fetch('/api/vocabularybank/upload', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error("Mining failed");
        
        const data = await res.json();
        if (data.errors && data.errors.length > 0) {
          throw new Error(data.errors[0].error);
        }

        const resultInfo = data.indexed?.[0] || { vocab_count: 0, words: [] };

        setSelectedFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'success', progress: 100 } : f));
        return { filename: fileState.file.name, count: resultInfo.vocab_count, words: resultInfo.words };
      } catch (err) {
        setSelectedFiles(prev => prev.map(f => f.id === fileState.id ? { ...f, status: 'error', error: err.message || "Failed to process" } : f));
        return null;
      }
    });

    const results = await Promise.all(promises);
    setIsMining(false);
    
    const validResults = results.filter(Boolean);
    if (validResults.length > 0) {
      setMinedResults(validResults);
      setShowSuccessBanner(true);
      setTimeout(() => setShowSuccessBanner(false), 8000);
      setSelectedFiles([]);
      fetchWords();
      fetchAllWords(); // refresh stats after mining
    }
  };

  // Compute metrics for top cards — always from the FULL unfiltered allWords list
  const categoryCounts = useMemo(() => {
    const counts = { Noun: 0, Verb: 0, Adjective: 0, Adverb: 0, Phrase: 0 };
    allWords.forEach(w => {
      const pos = w.pos?.trim().toLowerCase();
      if (pos === 'noun') counts.Noun++;
      else if (pos === 'verb') counts.Verb++;
      else if (pos === 'adjective') counts.Adjective++;
      else if (pos === 'adverb') counts.Adverb++;
      else if (pos === 'phrase') counts.Phrase++;
    });
    return counts;
  }, [allWords]);

  return (
    <div className="flex flex-col gap-4 pb-4 animate-fade-in-up flex-1 min-h-0 overflow-hidden w-full">
      {/* Title */}
      <div className="flex-none flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <CaseSensitive size={20} className="text-emerald-400" />
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Vocabulary Bank</h2>
          </div>
          <p className="text-slate-500 dark:text-neutral-500 text-xs ml-8">Store and mine advanced academic vocabulary to compose premium academic sentences.</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer"
        >
          <Plus size={14} /> Add Word
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1 flex-none">
        {CATEGORIES.slice(1).map(cat => {
          const styles = CATEGORY_STYLES[cat];
          const count = categoryCounts[cat] || 0;
          return (
            <div
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`glass-card p-3 flex flex-col justify-between cursor-pointer border-t-2 border-t-transparent hover:border-t-white/30 transition-all ${
                activeCategory === cat ? 'bg-white/[0.06] border-slate-300 dark:border-white/20' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-neutral-500">{cat}s</span>
                <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Main Grid split */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 min-w-0 w-full">
        {/* Left Column: AI Mining Panel & Categories */}
        <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col gap-4 shrink-0 overflow-y-auto pr-0 lg:pr-1 min-h-0" style={{ scrollbarWidth: 'thin' }}>
          
          {/* Categories Selector */}
          <div className="glass-card p-4 flex flex-col gap-1 flex-none">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Tag size={12} className="text-slate-500 dark:text-neutral-500" />
              Category Filters
            </h3>
            {CATEGORIES.map(cat => {
              const styles = CATEGORY_STYLES[cat];
              const isActive = activeCategory === cat;
              const count = cat === 'All'
                ? allWords.length
                : (categoryCounts[cat] || 0);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-xs font-semibold border ${
                    isActive 
                      ? `${styles.bg} ${styles.border} text-slate-900 dark:text-white` 
                      : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                    <span>{cat === 'All' ? 'All Words' : `${cat}s`}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${
                    isActive ? 'bg-slate-200/60 dark:bg-white/10 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-neutral-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* AI Vocab Mining Portal */}
          <div className="glass-card p-5 border-l-4 border-l-emerald-500/60 flex flex-col flex-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                AI Vocab Miner
              </h3>
              {selectedFiles.length > 0 && (
                <button 
                  onClick={() => setSelectedFiles([])}
                  disabled={isMining}
                  className="text-[10px] text-slate-500 dark:text-neutral-500 hover:text-slate-900 dark:text-white disabled:text-neutral-700 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {showSuccessBanner && (
              <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs flex flex-col gap-1 animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <Check size={14} className="shrink-0 text-emerald-400" />
                  Vocabulary Mined Successfully!
                </div>
                <div className="text-[11px] text-slate-600 dark:text-neutral-400 max-h-36 overflow-y-auto mt-1" style={{ scrollbarWidth: 'thin' }}>
                  {minedResults.map((r, ri) => (
                    <div key={ri} className="border-b border-white/5 pb-1 mb-1 last:border-0">
                      <div className="font-semibold text-slate-700 dark:text-neutral-300 truncate">
                        {r.files_processed ? `${r.files_processed} PDF${r.files_processed > 1 ? 's' : ''} processed` : r.filename}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        {r.count} new words added{r.skipped_duplicates > 0 ? `, ${r.skipped_duplicates} skipped (already known)` : ''}
                      </div>
                      {r.words?.length > 0 && (
                        <div className="text-[10px] text-slate-500 dark:text-neutral-500 mt-0.5 truncate">{r.words.slice(0, 20).join(', ')}{r.words.length > 20 ? ` +${r.words.length - 20} more` : ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedFiles.length === 0 ? (
              <div className="flex flex-col gap-4">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragActive 
                      ? 'border-emerald-500 bg-emerald-500/5 text-white' 
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:border-white/20 bg-white/[0.01]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFilesAdded(e.target.files)}
                    accept="application/pdf"
                    multiple={true}
                    className="hidden"
                  />
                  <Upload className="mx-auto text-slate-500 dark:text-neutral-500 mb-2" size={24} />
                  <p className="text-xs text-slate-700 dark:text-neutral-300 font-bold">Drag and drop academic PDFs</p>
                  <p className="text-[10px] text-neutral-600 mt-1">or click to browse local files</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {selectedFiles.map((fileState) => (
                    <div key={fileState.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-700 dark:text-neutral-300 font-bold truncate leading-tight">{fileState.file.name}</p>
                          <p className="text-[10px] text-neutral-600">{(fileState.file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button 
                          onClick={() => setSelectedFiles(prev => prev.filter(f => f.id !== fileState.id))}
                          disabled={isMining}
                          className="text-slate-500 dark:text-neutral-500 hover:text-slate-900 dark:text-white p-0.5 rounded transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {fileState.status === 'ready' && (
                        <div className="mt-1 border-t border-white/5 pt-2 flex items-center gap-3">
                          <label className="text-[9px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block shrink-0">Pub Year:</label>
                          <input
                            type="number"
                            value={fileState.metadata.year || new Date().getFullYear()}
                            onChange={(e) => updateFileMetadata(fileState.id, 'year', e.target.value)}
                            className="bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:border-white/20 focus:border-white/30 rounded-lg px-2.5 py-0.5 text-xs text-slate-900 dark:text-white outline-none transition-all w-20 text-center font-mono"
                          />
                        </div>
                      )}

                      {fileState.status !== 'ready' && (
                        <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-2">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="capitalize text-slate-700 dark:text-neutral-300 font-bold flex items-center gap-1">
                              {fileState.status === 'extracting' && (
                                <span className="flex items-center gap-1">
                                  <Loader2 size={10} className="animate-spin text-emerald-400" />
                                  Extracting Year...
                                </span>
                              )}
                              {fileState.status === 'mining' && 'Extracting Words...'}
                              {fileState.status === 'success' && <span className="text-emerald-400 flex items-center gap-0.5"><Check size={10} /> Success</span>}
                              {fileState.status === 'error' && <span className="text-red-400">Error</span>}
                            </span>
                            <span className="text-slate-500 dark:text-neutral-500">{fileState.progress}%</span>
                          </div>
                          
                          <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                fileState.status === 'success' ? 'bg-emerald-500' :
                                fileState.status === 'error' ? 'bg-red-500' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${fileState.progress}%` }}
                            />
                          </div>
                          
                          {fileState.error && (
                            <span className="text-[9px] text-red-400 leading-tight block bg-red-950/20 border border-red-900/30 p-1.5 rounded mt-1">
                              {fileState.error}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={mineAllFiles}
                  disabled={isMining || selectedFiles.some(f => f.status === 'extracting')}
                  className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isMining ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Mine Vocabulary
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Search bar & Cards Grid */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 h-full">
          {/* Search bar */}
          <div className="glass-card p-3 flex items-center gap-3 flex-none">
            <Search className="text-slate-500 dark:text-neutral-500 shrink-0" size={16} />
            <input
              type="text"
              placeholder="Search words, parts of speech, definitions, example sentences..."
              value={searchQuery}
              onChange={handleSearch}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none border-none placeholder-neutral-600"
            />
            {loading && <Loader2 size={14} className="animate-spin text-slate-500 dark:text-neutral-500 shrink-0" />}
          </div>

          {/* Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {words.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <BookOpen size={32} className="text-neutral-700 mb-2" />
                <p className="text-slate-500 dark:text-neutral-500 text-sm font-semibold">No vocabulary words found</p>
                <p className="text-neutral-600 text-xs mt-1">Mine words from academic PDFs or add them manually.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                {words.map((w) => {
                  const style = CATEGORY_STYLES[w.pos?.charAt(0).toUpperCase() + w.pos?.slice(1).toLowerCase()] || CATEGORY_STYLES.All;
                  return (
                    <div
                      key={w.id}
                      className="glass-card p-4 flex flex-col gap-2 hover:border-slate-200 dark:border-white/10 hover:bg-white/[0.02] transition-all relative group"
                    >
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteWord(w.id)}
                        className="absolute top-4 right-4 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 dark:bg-white/5"
                        title="Delete word"
                      >
                        <Trash2 size={13} />
                      </button>

                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide font-mono">{w.word}</h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${style.badge}`}>
                          {w.pos}
                        </span>
                        {w.domain && w.domain !== 'general' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-white/5 text-slate-500 dark:text-neutral-500 text-[9px] uppercase">
                            {w.domain}
                          </span>
                        )}
                      </div>

                      {/* Definition */}
                      <p className="text-xs text-slate-700 dark:text-neutral-300 leading-relaxed font-sans">{w.definition}</p>

                      {/* Example sentence */}
                      {w.example_sentence && (
                        <div className="mt-1 pl-2.5 border-l-2 border-neutral-800 text-[11px] text-slate-600 dark:text-neutral-400 italic font-serif leading-relaxed">
                          "{w.example_sentence}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Add Word Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 dark:bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus size={14} className="text-emerald-400" />
                Add Word manually
              </h3>
              <button 
                onClick={() => setAddModalOpen(false)}
                className="text-slate-500 dark:text-neutral-500 hover:text-slate-900 dark:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleAddWord} className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Word</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. corroborate"
                  value={newWord.word}
                  onChange={e => setNewWord(prev => ({ ...prev, word: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-slate-200 dark:border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Part of Speech</label>
                  <select
                    value={newWord.pos}
                    onChange={e => setNewWord(prev => ({ ...prev, pos: e.target.value }))}
                    className="w-full bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all"
                  >
                    <option value="noun">Noun</option>
                    <option value="verb">Verb</option>
                    <option value="adjective">Adjective</option>
                    <option value="adverb">Adverb</option>
                    <option value="phrase">Phrase</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Domain</label>
                  <select
                    value={newWord.domain}
                    onChange={e => setNewWord(prev => ({ ...prev, domain: e.target.value }))}
                    className="w-full bg-zinc-900 border border-slate-200 dark:border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all"
                  >
                    <option value="general">General</option>
                    <option value="social sciences">Social Sciences</option>
                    <option value="computer science">Computer Science</option>
                    <option value="medicine">Medicine</option>
                    <option value="biology">Biology</option>
                    <option value="economics">Economics</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Definition</label>
                <textarea
                  required
                  placeholder="Definition..."
                  value={newWord.definition}
                  onChange={e => setNewWord(prev => ({ ...prev, definition: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-slate-200 dark:border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all min-h-[64px] resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider block mb-1">Example Sentence</label>
                <textarea
                  placeholder="Usage example..."
                  value={newWord.example_sentence}
                  onChange={e => setNewWord(prev => ({ ...prev, example_sentence: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-slate-200 dark:border-white/10 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none transition-all min-h-[48px] resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 text-xs font-bold transition-all flex items-center gap-1"
                >
                  {adding ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Add Word
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
