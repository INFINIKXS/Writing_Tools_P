import React, { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Brain,
  ArrowRight,
  RefreshCw,
  Info,
  Type,
  AlignLeft,
  Quote,
  Layers,
  TrendingUp,
  Mic,
  Network,
  BookOpen,
  Lightbulb,
  Shuffle,
  Eye,
  Music2,
  Target,
  Star,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'analyser', label: 'Style Analyser', icon: Fingerprint },
  { id: 'transformer', label: 'Text Transformer', icon: Wand2 },
];

const LOADING_STEPS_ANALYSE = [
  { label: 'Extracting metrics across 10 style domains…', icon: BarChart2 },
  { label: 'Analysing rhetorical patterns and semantic habits…', icon: Brain },
  { label: 'Assembling your Style Profile…', icon: Fingerprint },
];

// The 10 style domain sections for the metrics panel
const METRIC_SECTIONS = [
  {
    key: 'sentence_architecture',
    label: 'Sentence Architecture',
    icon: Type,
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    accent: 'text-blue-400',
    metricKeys: [
      { key: 'sentence_metrics.avg_length_words', label: 'Avg sentence length', unit: 'words', format: '1f' },
      { key: 'sentence_metrics.median_length_words', label: 'Median sentence length', unit: 'words', format: '1f' },
      { key: 'sentence_metrics.std_dev_length', label: 'Length variation (SD)', unit: 'words', format: '1f' },
      { key: 'sentence_metrics.short_sentence_pct', label: 'Short sentences (<15w)', unit: '%', format: 'pct' },
      { key: 'sentence_metrics.long_sentence_pct', label: 'Long sentences (>35w)', unit: '%', format: 'pct' },
      { key: 'sentence_metrics.very_long_sentence_pct', label: 'Very long sentences (>50w)', unit: '%', format: 'pct' },
      { key: 'clause_structure_metrics.avg_subordinate_clauses_per_sentence', label: 'Subordinate clauses/sentence', unit: '', format: '2f' },
      { key: 'clause_structure_metrics.avg_coordinate_clauses_per_sentence', label: 'Coordinate clauses/sentence', unit: '', format: '2f' },
      { key: 'clause_structure_metrics.subordination_to_coordination_ratio', label: 'Sub:Coord ratio', unit: '×', format: '2f' },
      { key: 'clause_structure_metrics.avg_embedding_depth', label: 'Avg clause embedding depth', unit: '', format: '2f' },
    ],
  },
  {
    key: 'punctuation',
    label: 'Punctuation Logic',
    icon: AlignLeft,
    color: 'from-violet-500/20 to-violet-600/10',
    border: 'border-violet-500/30',
    accent: 'text-violet-400',
    metricKeys: [
      { key: 'punctuation_metrics.avg_commas_per_sentence', label: 'Commas per sentence', unit: '', format: '2f' },
      { key: 'punctuation_metrics.avg_semicolons_per_sentence', label: 'Semicolons per sentence', unit: '', format: '3f' },
      { key: 'punctuation_metrics.avg_colons_per_sentence', label: 'Colons per sentence', unit: '', format: '3f' },
      { key: 'punctuation_metrics.avg_parentheticals_per_sentence', label: 'Parentheticals per sentence', unit: '', format: '3f' },
      { key: 'punctuation_metrics.em_dash_per_1000_words', label: 'Em dashes per 1,000 words', unit: '', format: '1f' },
      { key: 'punctuation_metrics.exclamation_per_1000_words', label: 'Exclamations per 1,000 words', unit: '', format: '2f' },
      { key: 'punctuation_metrics.comma_splice_count', label: 'Comma splices', unit: '', format: 'int' },
    ],
  },
  {
    key: 'vocabulary',
    label: 'Vocabulary & Lexical Choice',
    icon: BookOpen,
    color: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    accent: 'text-emerald-400',
    metricKeys: [
      { key: 'vocabulary_metrics.avg_word_length_chars', label: 'Avg word length', unit: 'chars', format: '2f' },
      { key: 'vocabulary_metrics.type_token_ratio', label: 'Lexical diversity (TTR)', unit: '', format: '3f' },
      { key: 'vocabulary_metrics.avg_syllables_per_word', label: 'Avg syllables per word', unit: '', format: '2f' },
      { key: 'vocabulary_metrics.latinate_word_ratio', label: 'Latinate vocabulary ratio', unit: '%', format: 'pct' },
      { key: 'vocabulary_metrics.nominalisation_density', label: 'Nominalisation density', unit: 'per 100w', format: '2f' },
      { key: 'vocabulary_metrics.passive_voice_ratio', label: 'Passive voice ratio', unit: '%', format: 'pct' },
      { key: 'vocabulary_metrics.first_person_per_1000_words', label: 'First-person pronouns', unit: 'per 1,000w', format: '1f' },
      { key: 'vocabulary_metrics.hedging_word_count', label: 'Hedging words (total)', unit: '', format: 'int' },
      { key: 'vocabulary_metrics.intensifier_word_count', label: 'Intensifier words (total)', unit: '', format: 'int' },
    ],
  },
  {
    key: 'paragraph',
    label: 'Paragraph Architecture',
    icon: Layers,
    color: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30',
    accent: 'text-amber-400',
    metricKeys: [
      { key: 'paragraph_metrics.total_paragraphs', label: 'Total paragraphs', unit: '', format: 'int' },
      { key: 'paragraph_metrics.avg_length_sentences', label: 'Avg paragraph length', unit: 'sentences', format: '1f' },
      { key: 'paragraph_metrics.avg_length_words', label: 'Avg paragraph length', unit: 'words', format: '0f' },
      { key: 'paragraph_metrics.median_length_sentences', label: 'Median paragraph length', unit: 'sentences', format: '1f' },
      { key: 'paragraph_metrics.std_dev_length_sentences', label: 'Paragraph length variation', unit: '', format: '2f' },
      { key: 'paragraph_metrics.short_paragraph_pct', label: 'Short paragraphs (1-2 sent.)', unit: '%', format: 'pct' },
      { key: 'paragraph_metrics.long_paragraph_pct', label: 'Long paragraphs (6+ sent.)', unit: '%', format: 'pct' },
    ],
  },
  {
    key: 'rhetorical',
    label: 'Rhetorical Moves',
    icon: Target,
    color: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/30',
    accent: 'text-rose-400',
    metricKeys: [
      { key: 'citation_metrics.total_citations', label: 'Total citations', unit: '', format: 'int' },
      { key: 'citation_metrics.avg_citations_per_paragraph', label: 'Citations per paragraph', unit: '', format: '2f' },
      { key: 'citation_metrics.citation_dense_paragraphs', label: 'Dense citation paragraphs (3+)', unit: '', format: 'int' },
      { key: 'rhetorical_metrics.questions_per_1000_words', label: 'Questions per 1,000 words', unit: '', format: '2f' },
      { key: 'rhetorical_metrics.signpost_phrase_count', label: 'Signposting phrases', unit: '', format: 'int' },
      { key: 'rhetorical_metrics.stance_marker_count', label: 'Stance markers', unit: '', format: 'int' },
    ],
  },
];

// The 10 semantic domains for the patterns panel
const SEMANTIC_SECTIONS = [
  {
    key: 'sentence_architecture',
    label: 'Sentence Architecture',
    icon: Type,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    fields: [
      { key: 'dominant_clause_type', label: 'Dominant clause type' },
      { key: 'clause_ordering_preference', label: 'Clause ordering' },
      { key: 'embedding_style', label: 'Embedding depth' },
      { key: 'coordination_vs_subordination', label: 'Coordination vs subordination' },
    ],
  },
  {
    key: 'punctuation_logic',
    label: 'Punctuation Logic',
    icon: AlignLeft,
    color: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/5',
    fields: [
      { key: 'comma_philosophy', label: 'Comma philosophy' },
      { key: 'parenthetical_style', label: 'Parenthetical style' },
      { key: 'em_dash_usage', label: 'Em dash usage' },
      { key: 'semicolon_usage', label: 'Semicolon usage' },
    ],
  },
  {
    key: 'vocabulary_and_register',
    label: 'Vocabulary & Register',
    icon: BookOpen,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    fields: [
      { key: 'register_consistency', label: 'Register' },
      { key: 'concrete_vs_abstract', label: 'Concrete vs abstract' },
      { key: 'latinate_vs_anglosaxon', label: 'Latinate vs Anglo-Saxon' },
      { key: 'technical_density', label: 'Technical density' },
      { key: 'nominalisation_habit', label: 'Nominalisation habit' },
      { key: 'hedging_style', label: 'Hedging style' },
      { key: 'intensifier_style', label: 'Intensifier style' },
    ],
  },
  {
    key: 'connective_logic',
    label: 'Connective Logic',
    icon: Network,
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
    fields: [
      { key: 'dominant_connective_type', label: 'Dominant connective type' },
      { key: 'connective_density', label: 'Connective density' },
      { key: 'characteristic_connective_phrases', label: 'Characteristic phrases' },
    ],
  },
  {
    key: 'paragraph_architecture',
    label: 'Paragraph Architecture',
    icon: Layers,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    fields: [
      { key: 'opening_sentence_function', label: 'Opening sentence function' },
      { key: 'internal_development_pattern', label: 'Internal development pattern' },
      { key: 'closing_sentence_function', label: 'Closing sentence function' },
      { key: 'cross_paragraph_cohesion', label: 'Cross-paragraph cohesion' },
    ],
  },
  {
    key: 'rhetorical_moves',
    label: 'Rhetorical Moves & Evidence',
    icon: Target,
    color: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/5',
    fields: [
      { key: 'evidence_introduction', label: 'Evidence introduction' },
      { key: 'evidence_affirmation', label: 'Evidence affirmation' },
      { key: 'evidence_critique', label: 'Evidence critique' },
      { key: 'evidence_application', label: 'Evidence application' },
      { key: 'counterargument_handling', label: 'Counterargument handling' },
    ],
  },
  {
    key: 'voice_and_perspective',
    label: 'Voice & Perspective',
    icon: Mic,
    color: 'text-indigo-400',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/5',
    fields: [
      { key: 'person_and_pronoun', label: 'Person & pronoun' },
      { key: 'authorial_presence', label: 'Authorial presence' },
      { key: 'epistemic_stance', label: 'Epistemic stance' },
      { key: 'stance_markers', label: 'Stance markers' },
    ],
  },
  {
    key: 'rhythm_and_prosody',
    label: 'Rhythm & Prosody',
    icon: Music2,
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/5',
    fields: [
      { key: 'length_variation_pattern', label: 'Length variation pattern' },
      { key: 'stress_and_emphasis', label: 'Stress & emphasis' },
      { key: 'parallelism_and_repetition', label: 'Parallelism & repetition' },
      { key: 'pacing', label: 'Pacing' },
    ],
  },
  {
    key: 'macro_argument_structure',
    label: 'Macro Argument Structure',
    icon: TrendingUp,
    color: 'text-teal-400',
    border: 'border-teal-500/20',
    bg: 'bg-teal-500/5',
    fields: [
      { key: 'organisational_logic', label: 'Organisational logic' },
      { key: 'signposting_density', label: 'Signposting density' },
      { key: 'thesis_placement', label: 'Thesis placement' },
      { key: 'proportionality', label: 'Proportionality' },
    ],
  },
  {
    key: 'idiosyncratic_habits',
    label: 'Idiosyncratic Habits',
    icon: Star,
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/5',
    fields: [
      { key: 'characteristic_openers', label: 'Characteristic openers' },
      { key: 'pet_phrases', label: 'Pet phrases' },
      { key: 'preferred_qualifiers', label: 'Preferred qualifiers' },
      { key: 'structural_quirks', label: 'Structural quirks' },
      { key: 'unique_fingerprint', label: 'Unique fingerprint' },
    ],
  },
];

// ─── Utility: safely resolve a dotted path in a nested object ────────────────
function deepGet(obj, path) {
  return path.split('.').reduce((cur, key) => cur?.[key], obj);
}

// ─── Utility: format metric values ───────────────────────────────────────────
function fmt(value, format) {
  if (value === undefined || value === null) return '—';
  if (format === 'int') return Math.round(value).toLocaleString();
  if (format === 'pct') return `${(value * 100).toFixed(1)}%`;
  if (format === '0f') return parseFloat(value).toFixed(0);
  if (format === '1f') return parseFloat(value).toFixed(1);
  if (format === '2f') return parseFloat(value).toFixed(2);
  if (format === '3f') return parseFloat(value).toFixed(3);
  return String(value);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function WordCountBadge({ text, warnBelow = 500 }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isWarning = count > 0 && count < warnBelow;
  const isOk = count >= warnBelow;
  return (
    <span
      className={`text-xs font-mono px-2 py-0.5 rounded-md transition-colors duration-200 ${
        isWarning
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          : isOk
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
          : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-neutral-500 border border-slate-200 dark:border-white/10'
      }`}
    >
      {count.toLocaleString()} words
      {isWarning && ' — recommend 500+'}
    </span>
  );
}

function MetricRow({ label, value, unit, format }) {
  const displayed = fmt(value, format);
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-blue-200/40 dark:border-white/5 last:border-0">
      <span className="text-sm text-slate-800 dark:text-neutral-200 font-semibold">{label}</span>
      <span className="text-sm font-mono text-slate-900 dark:text-white font-bold tabular-nums">
        {displayed}
        {unit && displayed !== '—' && <span className="text-slate-600 dark:text-neutral-400 ml-1 text-xs font-normal">{unit}</span>}
      </span>
    </div>
  );
}

function MetricCard({ section, metrics }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  return (
    <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 md:p-5 shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-blue-900 dark:text-blue-300" />
          <span className="text-base font-extrabold text-blue-900 dark:text-blue-300">{section.label}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-blue-900 dark:text-blue-300" /> : <ChevronRight size={16} className="text-blue-900 dark:text-blue-300" />}
      </button>
      {open && (
        <div className="mt-3 space-y-1 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
          {section.metricKeys.map(mk => (
            <MetricRow
              key={mk.key}
              label={mk.label}
              value={deepGet(metrics, mk.key)}
              unit={mk.unit}
              format={mk.format}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectivesTable({ phrases }) {
  if (!phrases || phrases.length === 0) return null;
  return (
    <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 md:p-5 shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-2 pb-3 border-b border-blue-200/50 dark:border-blue-900/40">
        <Network size={16} className="text-blue-900 dark:text-blue-300" />
        <span className="text-base font-extrabold text-blue-900 dark:text-blue-300">Top Connective Phrases</span>
      </div>
      <div className="pt-2">
        <div className="grid grid-cols-3 gap-x-4 text-xs text-slate-700 dark:text-neutral-300 font-bold uppercase tracking-wider py-1.5 border-b border-blue-200/30 dark:border-white/5">
          <span>Phrase</span>
          <span className="text-right">Count</span>
          <span className="text-right">Per 1,000w</span>
        </div>
        {phrases.slice(0, 15).map((cp, i) => (
          <div key={i} className="grid grid-cols-3 gap-x-4 py-1.5 border-b border-blue-200/30 dark:border-white/5 last:border-0">
            <span className="text-sm text-slate-800 dark:text-neutral-200 font-semibold font-mono truncate">{cp.phrase}</span>
            <span className="text-sm font-mono text-slate-900 dark:text-white font-bold text-right">{cp.count}</span>
            <span className="text-sm font-mono text-slate-900 dark:text-white font-bold text-right">{parseFloat(cp.per_1000_words || 0).toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenersTable({ openers }) {
  if (!openers || openers.length === 0) return null;
  return (
    <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 md:p-5 shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-2 pb-3 border-b border-blue-200/50 dark:border-blue-900/40">
        <Quote size={16} className="text-blue-900 dark:text-blue-300" />
        <span className="text-base font-extrabold text-blue-900 dark:text-blue-300">Sentence Openers</span>
      </div>
      <div className="pt-2">
        {openers.slice(0, 12).map((op, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-blue-200/30 dark:border-white/5 last:border-0">
            <span className="text-sm text-slate-800 dark:text-neutral-200 font-semibold font-mono">"{op.opener}"</span>
            <span className="text-sm font-mono text-slate-900 dark:text-white font-bold">
              {op.pct !== undefined ? `${(op.pct * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanticCard({ section, semantic }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  const data = semantic?.[section.key] || {};
  return (
    <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 md:p-5 shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-blue-900 dark:text-blue-300" />
          <span className="text-base font-extrabold text-blue-900 dark:text-blue-300">{section.label}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-blue-900 dark:text-blue-300" /> : <ChevronRight size={16} className="text-blue-900 dark:text-blue-300" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
          {section.fields.map(field => {
            const value = data[field.key];
            if (!value) return null;
            return (
              <div key={field.key}>
                <div className="text-xs font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  {field.label}
                </div>
                <p className="text-sm text-slate-800 dark:text-neutral-200 leading-relaxed font-normal">{value}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileDisplay({ profile, onDelete }) {
  const [activePanel, setActivePanel] = useState('metrics');
  const metrics = profile?.metrics || {};
  const semantic = profile?.semantic || {};
  const wordCount = profile?.word_count_analysed || 0;
  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleString()
    : '—';

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Profile header */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-400">Style Profile Active</div>
            <div className="text-xs text-slate-500 dark:text-neutral-500">
              Analysed {wordCount.toLocaleString()} words · Generated {createdAt}
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all duration-200"
        >
          <Trash2 size={12} />
          Delete & Regenerate
        </button>
      </div>

      {/* Panel selector */}
      <div className="flex gap-2 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <button
          onClick={() => setActivePanel('metrics')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activePanel === 'metrics'
              ? 'bg-slate-200/60 dark:bg-white/10 text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300'
          }`}
        >
          <BarChart2 size={14} />
          Metrics
        </button>
        <button
          onClick={() => setActivePanel('patterns')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
            activePanel === 'patterns'
              ? 'bg-slate-200/60 dark:bg-white/10 text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300'
          }`}
        >
          <Brain size={14} />
          Semantic Patterns
        </button>
      </div>

      {/* Metrics panel */}
      {activePanel === 'metrics' && (
        <div className="space-y-3">
          {METRIC_SECTIONS.map(section => (
            <MetricCard key={section.key} section={section} metrics={metrics} />
          ))}
          <ConnectivesTable phrases={metrics.connective_phrases} />
          <OpenersTable openers={metrics.sentence_openers} />
        </div>
      )}

      {/* Semantic patterns panel */}
      {activePanel === 'patterns' && (
        <div className="space-y-3">
          {SEMANTIC_SECTIONS.map(section => (
            <SemanticCard key={section.key} section={section} semantic={semantic} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StyleView({ initialTab = null }) {
  const [activeTab, setActiveTab] = useState('analyser');

  useEffect(() => {
    if (initialTab) {
      if (initialTab === 'transformer' || initialTab === 'analyser') {
        setActiveTab(initialTab);
      } else {
        setActiveTab('analyser');
      }
    }
  }, [initialTab]);

  // Analyser state
  const [sampleText, setSampleText] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [analyseStep, setAnalyseStep] = useState(0);
  const [profile, setProfile] = useState(null);
  const [analyseError, setAnalyseError] = useState(null);

  // Transformer state
  const [targetText, setTargetText] = useState('');
  const [transforming, setTransforming] = useState(false);
  const [transformedText, setTransformedText] = useState('');
  const [transformError, setTransformError] = useState(null);
  const [transformStats, setTransformStats] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load existing profile on mount
  useEffect(() => {
    fetch('/api/style/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setProfile(data); })
      .catch(() => {});
  }, []);

  // ── Analyser step animation ───────────────────────────────────────────────
  useEffect(() => {
    if (!analysing) { setAnalyseStep(0); return; }
    const timers = [
      setTimeout(() => setAnalyseStep(1), 800),
      setTimeout(() => setAnalyseStep(2), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [analysing]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAnalyse = useCallback(async () => {
    if (!sampleText.trim()) return;
    setAnalysing(true);
    setAnalyseError(null);
    setProfile(null);

    try {
      const res = await fetch('/api/style/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Analysis failed.');
      }
      const data = await res.json();
      setProfile(data.profile);
    } catch (e) {
      setAnalyseError(e.message);
    } finally {
      setAnalysing(false);
    }
  }, [sampleText]);

  const handleDeleteProfile = useCallback(async () => {
    try {
      await fetch('/api/style/profile', { method: 'DELETE' });
    } catch (_) {}
    setProfile(null);
    setTransformedText('');
    setTransformStats(null);
  }, []);

  const handleTransform = useCallback(async () => {
    if (!targetText.trim() || !profile) return;
    setTransforming(true);
    setTransformError(null);
    setTransformedText('');
    setTransformStats(null);

    try {
      const res = await fetch('/api/style/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: targetText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Transformation failed.');
      }
      const data = await res.json();
      setTransformedText(data.transformed_text);
      setTransformStats({
        input: data.input_word_count,
        output: data.output_word_count,
      });
    } catch (e) {
      setTransformError(e.message);
    } finally {
      setTransforming(false);
    }
  }, [targetText, profile]);

  const handleCopy = useCallback(() => {
    if (!transformedText) return;
    navigator.clipboard.writeText(transformedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [transformedText]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex-none pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
            <Fingerprint size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Style Analyser & Transformer</h2>
            <p className="text-sm text-slate-500 dark:text-neutral-500">
              10-domain writing style capture — sentence architecture, punctuation, vocabulary, rhetoric, rhythm, and more
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex-none flex gap-2 p-1 mb-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-slate-200/60 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:text-neutral-300'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: Style Profile Generator ──────────────────────────────────── */}
      {activeTab === 'analyser' && (
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">

          {!profile && (
            <>
              {/* Instruction banner */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/5 border border-violet-500/20">
                <Info size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-600 dark:text-neutral-400 leading-relaxed">
                  Paste one or more writing samples below. The system will analyse <strong className="text-slate-900 dark:text-white">all 10 style domains</strong> — 
                  sentence architecture, punctuation logic, vocabulary, connective patterns, paragraph structure, 
                  rhetorical moves, voice, rhythm, macro argument structure, and idiosyncratic habits.
                  <span className="block mt-1 text-slate-500 dark:text-neutral-500">Recommended minimum: 500 words for reliable pattern detection.</span>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={sampleText}
                  onChange={e => setSampleText(e.target.value)}
                  placeholder="Paste your writing sample here…"
                  className="w-full h-64 bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-black focus:border-purple-500 rounded-2xl p-4 resize-none focus:outline-none transition-all duration-200 font-mono leading-relaxed"
                  disabled={analysing}
                />
                <div className="absolute bottom-3 right-3">
                  <WordCountBadge text={sampleText} />
                </div>
              </div>

              {/* Analyse button */}
              <button
                onClick={handleAnalyse}
                disabled={analysing || !sampleText.trim()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-900/30"
              >
                {analysing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Fingerprint size={16} />
                )}
                {analysing ? 'Analysing…' : 'Analyse My Style'}
              </button>

              {/* Loading steps */}
              {analysing && (
                <div className="space-y-2">
                  {LOADING_STEPS_ANALYSE.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = analyseStep === i;
                    const isDone = analyseStep > i;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
                          isActive
                            ? 'bg-violet-500/10 border-violet-500/30 text-slate-900 dark:text-white'
                            : isDone
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-100 dark:bg-white/5 border-white/5 text-neutral-600'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                        ) : isActive ? (
                          <Loader2 size={14} className="animate-spin text-violet-400 flex-shrink-0" />
                        ) : (
                          <StepIcon size={14} className="flex-shrink-0 opacity-40" />
                        )}
                        <span className="text-sm">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Analyse error */}
              {analyseError && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">{analyseError}</p>
                </div>
              )}
            </>
          )}

          {/* Profile display */}
          {profile && (
            <ProfileDisplay profile={profile} onDelete={handleDeleteProfile} />
          )}
        </div>
      )}

      {/* ── TAB 2: Text Transformer ─────────────────────────────────────────── */}
      {activeTab === 'transformer' && (
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-4">

          {/* No profile warning */}
          {!profile && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                No style profile found.{' '}
                <button
                  onClick={() => setActiveTab('analyser')}
                  className="underline hover:text-amber-900 dark:text-amber-200 transition-colors"
                >
                  Go to Style Analyser
                </button>{' '}
                to generate one first.
              </div>
            </div>
          )}

          {/* Profile indicator */}
          {profile && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 w-fit">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-semibold">
                Style profile active — {(profile.word_count_analysed || 0).toLocaleString()} words analysed
              </span>
            </div>
          )}

          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-2">
              Text to Transform
            </label>
            <div className="relative">
              <textarea
                value={targetText}
                onChange={e => setTargetText(e.target.value)}
                placeholder="Paste the text you want rewritten in your style…"
                className="w-full h-52 bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:bg-white dark:focus:bg-black focus:border-purple-500 rounded-2xl p-4 resize-none focus:outline-none transition-all duration-200 leading-relaxed"
                disabled={transforming || !profile}
              />
              <div className="absolute bottom-3 right-3">
                <WordCountBadge text={targetText} warnBelow={0} />
              </div>
            </div>
          </div>

          {/* Transform button */}
          <button
            onClick={handleTransform}
            disabled={transforming || !targetText.trim() || !profile}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black tracking-wide bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-sm"
          >
            {transforming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Transforming across all 10 style domains…
              </>
            ) : (
              <>
                <Shuffle size={16} />
                Transform Text
              </>
            )}
          </button>

          {/* Transform error */}
          {transformError && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{transformError}</p>
            </div>
          )}

          {/* Output */}
          {transformedText && (
            <div className="space-y-3">
              {/* Word count comparison */}
              {transformStats && (
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-slate-500 dark:text-neutral-500" />
                    <span className="text-xs text-slate-500 dark:text-neutral-500">Word count</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-700 dark:text-neutral-300">{transformStats.input.toLocaleString()}</span>
                    <ArrowRight size={12} className="text-neutral-600" />
                    <span className={`font-semibold ${
                      Math.abs(transformStats.output - transformStats.input) / transformStats.input < 0.15
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      {transformStats.output.toLocaleString()}
                    </span>
                    <span className="text-neutral-600 text-xs">
                      ({transformStats.output > transformStats.input ? '+' : ''}
                      {Math.round(((transformStats.output - transformStats.input) / transformStats.input) * 100)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Output area */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">
                    Transformed Output
                  </label>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 text-slate-700 dark:text-neutral-300 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-slate-900 dark:text-white"
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm text-slate-900 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto font-medium">
                  {transformedText}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
