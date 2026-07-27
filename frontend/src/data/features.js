import { 
  Sparkles, 
  BookOpen, 
  ArrowLeftRight, 
  PenTool, 
  Layers,
  Fingerprint,
  Bookmark
} from 'lucide-react';

export const featureTimelineData = [
  {
    id: 3,
    title: "Citation & Reference Manager",
    date: "Manager",
    content: "Verify in-text citations against academic databases, extract references from drafts, format bibliographies in APA/Harvard/MLA, and resolve DOIs.",
    category: "Catalog",
    icon: Bookmark,
    relatedIds: [5],
    status: "completed",
    energy: 95,
    navId: "library",
    imageSrc: "/mockups/feature_3.png",
    subFeatures: [
      { label: "Citation Verifier", toolId: "citation_verifier" },
      { label: "DOI Verifier", toolId: "verifier" },
      { label: "Reference Manager", toolId: "generator" },
      { label: "Style Formatter", toolId: "formatter" }
    ]
  },
  {
    id: 5,
    title: "PDF/File Conversion Tools",
    date: "Export",
    content: "Convert, merge, split, compress, watermark, redact, and organize academic documents effortlessly in seconds.",
    category: "Format",
    icon: ArrowLeftRight,
    relatedIds: [1, 3],
    status: "completed",
    energy: 85,
    navId: "converter",
    imageSrc: "/mockups/feature_5.png",
    subFeatures: [
      { label: "Add Page Numbers", toolId: "add-page-numbers" },
      { label: "Add Watermark", toolId: "add-watermark" },
      { label: "Compare PDFs", toolId: "compare-pdf" },
      { label: "Compress Image", toolId: "compress-image" },
      { label: "Compress PDF", toolId: "compress-pdf" },
      { label: "Excel to PDF", toolId: "excel-to-pdf" },
      { label: "Excel to Word", toolId: "excel-to-word" },
      { label: "Extract Pages", toolId: "extract-pages" },
      { label: "Flatten PDF Forms", toolId: "flatten-pdf" },
      { label: "HTML to PDF", toolId: "html-to-pdf" },
      { label: "Image to PDF", toolId: "image-to-pdf" },
      { label: "Lock PDF", toolId: "lock-pdf" },
      { label: "Merge PDF", toolId: "merge-pdf" },
      { label: "OCR to Word", toolId: "ocr-to-word" },
      { label: "Organize PDF", toolId: "organize-pdf" },
      { label: "PDF to Excel", toolId: "pdf-to-excel" },
      { label: "PDF to Images", toolId: "pdf-to-images" },
      { label: "PDF to Markdown", toolId: "pdf-to-markdown" },
      { label: "PDF to PDF/A", toolId: "pdf-to-pdfa" },
      { label: "PDF to PowerPoint", toolId: "pdf-to-pptx" },
      { label: "PDF to Text", toolId: "pdf-to-text" },
      { label: "PDF to Word", toolId: "pdf-to-word" },
      { label: "PowerPoint to PDF", toolId: "pptx-to-pdf" },
      { label: "PowerPoint to Word", toolId: "pptx-to-word" },
      { label: "Redact PDF", toolId: "redact-pdf" },
      { label: "Remove Pages", toolId: "remove-pages" },
      { label: "Repair PDF", toolId: "repair-pdf" },
      { label: "Rotate PDF", toolId: "rotate-pdf" },
      { label: "Split PDF", toolId: "split-pdf" },
      { label: "Text to PDF", toolId: "text-to-pdf" },
      { label: "Unlock PDF", toolId: "unlock-pdf" },
      { label: "Word to Excel", toolId: "word-to-excel" },
      { label: "Word to PDF", toolId: "word-to-pdf" },
      { label: "Word to PowerPoint", toolId: "word-to-pptx" }
    ]
  },
  {
    id: 6,
    title: "PDF Editor",
    date: "Review",
    content: "Annotate, draw, edit text, fill forms, highlight passages, and organize pages directly in the high-performance browser workspace.",
    category: "Editor",
    icon: PenTool,
    relatedIds: [1, 3],
    status: "completed",
    energy: 98,
    navId: "pdf_editor",
    imageSrc: "/mockups/feature_6.png",
    subFeatures: [
      { label: "Annotate & Draw", toolId: "draw" },
      { label: "Shapes & Eraser", toolId: "shape" },
      { label: "Sign & Image", toolId: "signature" },
      { label: "Sticky Notes", toolId: "sticky" },
      { label: "Text & Highlight", toolId: "text" }
    ]
  },
  {
    id: 7,
    title: "Depth & Breadth Analyzer",
    date: "Evaluation",
    content: "Measure analytical depth, contextual breadth, claim justification, and methodological rigor of your writing against scholarly standards.",
    category: "Audit",
    icon: Sparkles,
    relatedIds: [1],
    status: "completed",
    energy: 90,
    navId: "depth_breadth",
    imageSrc: "/mockups/feature_7.png",
    subFeatures: [
      { label: "Analytical Depth Audit", toolId: "depth" },
      { label: "Contextual Breadth", toolId: "breadth" },
      { label: "Evidence Gap Finder", toolId: "gaps" },
      { label: "Scholarly Advice", toolId: "advice" },
      { label: "Sub-Dimension Audit", toolId: "subdim" }
    ]
  },
  {
    id: 9,
    title: "Style Analyser",
    date: "Profile",
    content: "10-domain writing style capture: sentence architecture, punctuation logic, vocabulary density, voice, and instant AI text transformation.",
    category: "Analysis",
    icon: Fingerprint,
    relatedIds: [7],
    status: "completed",
    energy: 96,
    navId: "style_analyser",
    imageSrc: "/mockups/feature_7.png",
    subFeatures: [
      { label: "AI Voice Matching", toolId: "voice" },
      { label: "Punctuation Logic", toolId: "punctuation" },
      { label: "Sentence Architecture", toolId: "sentence" },
      { label: "Style Analyser", toolId: "analyser" },
      { label: "Text Transformer", toolId: "transformer" }
    ]
  }
];

