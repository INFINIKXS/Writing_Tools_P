import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  ArrowLeft, ArrowLeftRight, FileText, FileType2, Type, ImageIcon, Images,
  Layers, Minimize2, Upload, Download, CheckCircle2, AlertCircle,
  Loader2, X, Plus, GripVertical, Zap, Clock, Ban, Scissors, Trash2,
  BookOpen, SlidersHorizontal, RotateCw, Droplets, Hash, Crop,
  Wrench, Presentation, Table, FileSpreadsheet, FileCheck,
  Code, ShieldCheck, GitCompare, ChevronUp, ChevronDown,
  ZoomIn, ZoomOut, Eye, ChevronLeft, ChevronRight, Maximize2, Check, Search,
  FileSearch, ScanText, FileCode, Sparkles,
  Lock, Unlock, EyeOff, ShieldAlert, Key, MousePointer, Square, Highlighter, Palette
} from 'lucide-react';

import { PDFDocument } from '@cantoo/pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const API_BASE = 'http://127.0.0.1:8000';

// Helper to extract PDF total page count
async function getPdfPageCount(file) {
  if (!file || !file.name || !file.name.toLowerCase().endsWith('.pdf')) {
    return null;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (_) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));
      const matches = [...text.matchAll(/\/Count\s+(\d+)/g)];
      if (matches.length > 0) {
        return Math.max(...matches.map(m => parseInt(m[1], 10)));
      }
    } catch (__) {}
    return null;
  }
}

//  Tool Definitions 
const TOOLS = [
  //  Convert from PDF 
  {
    id: 'pdf-to-word',
    title: 'PDF to Word',
    description: 'Convert PDF documents to editable DOCX files with layout preservation. OCR support for scanned PDFs.',
    icon: FileText,
    color: '#3B82F6',
    colorLight: 'rgba(59, 130, 246, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-word',
    multiple: false,
    outputExt: '.docx',
    async: true,
  },
  {
    id: 'word-to-pdf',
    title: 'Word to PDF',
    description: 'Convert Word documents to high-quality PDF files using LibreOffice.',
    icon: FileType2,
    color: '#10B981',
    colorLight: 'rgba(16, 185, 129, 0.12)',
    accept: '.docx,.doc,.odt,.rtf',
    acceptLabel: 'DOCX, DOC, ODT, RTF',
    endpoint: '/api/convert/word-to-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'pdf-to-text',
    title: 'PDF to Text',
    description: 'Extract all text content from PDF files. Uses OCR for scanned documents.',
    icon: Type,
    color: '#F59E0B',
    colorLight: 'rgba(245, 158, 11, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-text',
    multiple: false,
    outputExt: '.txt',
    async: true,
  },
  {
    id: 'image-to-pdf',
    title: 'Image to PDF',
    description: 'Convert JPG, PNG, or other images into a single PDF document.',
    icon: ImageIcon,
    color: '#8B5CF6',
    colorLight: 'rgba(139, 92, 246, 0.12)',
    accept: '.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp',
    acceptLabel: 'JPG, PNG, BMP, TIFF, WebP',
    endpoint: '/api/convert/image-to-pdf',
    multiple: true,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'pdf-to-images',
    title: 'PDF to Images',
    description: 'Convert each page of one or more PDFs to high-quality JPG images. Downloads as ZIP.',
    icon: Images,
    color: '#EC4899',
    colorLight: 'rgba(236, 72, 153, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-images',
    multiple: true,
    minFiles: 1,
    outputExt: '.zip',
    async: true,
  },
  //  Organize PDF 
  {
    id: 'merge-pdf',
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into a single document in your desired order.',
    icon: Layers,
    color: '#06B6D4',
    colorLight: 'rgba(6, 182, 212, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/merge-pdf',
    multiple: true,
    minFiles: 2,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'split-pdf',
    title: 'Split PDF',
    description: 'Split a PDF into multiple files by defining page ranges for each output.',
    icon: Scissors,
    color: '#EF4444',
    colorLight: 'rgba(239, 68, 68, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/split-pdf',
    multiple: false,
    outputExt: '.zip',
    async: true,
    params: [
      {
        key: 'ranges',
        label: 'Page groups (one output PDF per group)',
        placeholder: 'e.g.  1-3 ; 4-6 ; 7',
        hint: 'Separate each output file with a semicolon. Use ranges (1-3) or single pages (5).',
        type: 'text',
        required: true,
        default: '1-3 ; 4-6',
      },
    ],
  },
  {
    id: 'remove-pages',
    title: 'Remove Pages',
    description: 'Delete specific pages from a PDF document.',
    icon: Trash2,
    color: '#DC2626',
    colorLight: 'rgba(220, 38, 38, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/remove-pages',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'pages',
        label: 'Pages to remove',
        placeholder: 'e.g.  2, 5, 8-10',
        hint: 'Comma-separated page numbers or ranges (1-indexed).',
        type: 'text',
        required: true,
        default: '',
      },
    ],
  },
  {
    id: 'extract-pages',
    title: 'Extract Pages',
    description: 'Keep only the pages you choose and save them as a new PDF.',
    icon: BookOpen,
    color: '#F97316',
    colorLight: 'rgba(249, 115, 22, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/extract-pages',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'pages',
        label: 'Pages to keep',
        placeholder: 'e.g.  1, 3, 5-10',
        hint: 'Comma-separated page numbers or ranges (1-indexed).',
        type: 'text',
        required: true,
        default: '',
      },
    ],
  },
  {
    id: 'organize-pdf',
    title: 'Organize PDF',
    description: 'Reorder pages in a PDF by specifying a new page order.',
    icon: SlidersHorizontal,
    color: '#A855F7',
    colorLight: 'rgba(168, 85, 247, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/organize-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'order',
        label: 'New page order',
        placeholder: 'e.g.  3, 1, 2, 4',
        hint: 'List every page number in the order you want them (1-indexed).',
        type: 'text',
        required: true,
        default: '',
      },
    ],
  },
  //  Compress 
  {
    id: 'compress-pdf',
    title: 'Compress PDF',
    description: 'Reduce PDF file size by compressing content streams and removing metadata.',
    icon: Minimize2,
    color: '#F97316',
    colorLight: 'rgba(249, 115, 22, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/compress-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'compress-image',
    title: 'Compress Image',
    description: 'Compress JPG, PNG, WebP, or BMP images to reduce file size without losing noticeable quality.',
    icon: ImageIcon,
    color: '#10B981',
    colorLight: 'rgba(16, 185, 129, 0.12)',
    accept: '.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif',
    acceptLabel: 'JPG, PNG, WebP, BMP, TIFF',
    endpoint: '/api/convert/compress-image',
    multiple: true,
    outputExt: '.jpg',
    async: true,
    params: [
      {
        key: 'quality',
        label: 'Quality Level',
        type: 'range',
        default: 75,
        min: 10,
        max: 100,
        hint: 'Lower quality yields smaller file sizes (75% recommended).',
      },
      {
        key: 'target_format',
        label: 'Target Format',
        type: 'select',
        default: 'original',
        options: [
          { value: 'original', label: 'Keep Original Format' },
          { value: 'jpeg', label: 'Convert to JPG' },
          { value: 'webp', label: 'Convert to WebP (Recommended for Web)' },
        ],
      },
      {
        key: 'max_dim',
        label: 'Max Dimensions (Resize)',
        type: 'select',
        default: 0,
        options: [
          { value: 0, label: 'Original Size (No Resize)' },
          { value: 2048, label: '2048px (4K / Large)' },
          { value: 1600, label: '1600px (HD / Web Standard)' },
          { value: 1200, label: '1200px (Medium)' },
          { value: 800, label: '800px (Small / Thumbnail)' },
        ],
      },
    ],
  },
  //  Edit PDF 
  {
    id: 'rotate-pdf',
    title: 'Rotate PDF',
    description: 'Rotate all or selected pages of a PDF by 90, 180, or 270.',
    icon: RotateCw,
    color: '#6366F1',
    colorLight: 'rgba(99, 102, 241, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/rotate-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'rotation',
        label: 'Rotation angle',
        type: 'select',
        options: ['90', '180', '270'],
        default: '90',
        required: false,
      },
      {
        key: 'pages',
        label: 'Pages to rotate',
        placeholder: 'all  or  1, 3, 5',
        hint: 'Leave blank or type "all" to rotate every page.',
        type: 'text',
        required: false,
        default: 'all',
      },
    ],
  },
  {
    id: 'add-watermark',
    title: 'Add Watermark',
    description: 'Stamp a diagonal text watermark on every page of a PDF.',
    icon: Droplets,
    color: '#8B5CF6',
    colorLight: 'rgba(139, 92, 246, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/add-watermark',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'text',
        label: 'Watermark text',
        placeholder: 'e.g.  CONFIDENTIAL',
        type: 'text',
        required: true,
        default: '',
      },
    ],
  },
  {
    id: 'add-page-numbers',
    title: 'Add Page Numbers',
    description: 'Insert page numbers at the top or bottom of every page.',
    icon: Hash,
    color: '#14B8A6',
    colorLight: 'rgba(20, 184, 166, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/add-page-numbers',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'position',
        label: 'Position',
        type: 'select',
        options: ['bottom', 'top'],
        default: 'bottom',
        required: false,
      },
      {
        key: 'start',
        label: 'Starting number',
        placeholder: '1',
        type: 'number',
        required: false,
        default: '1',
      },
    ],
  },
  {
    id: 'ocr-to-word',
    title: 'OCR to Word Transcriber',
    description: 'Extract text from scanned PDFs & images into editable Word documents.',
    icon: ScanText,
    color: '#EC4899',
    colorLight: 'rgba(236, 72, 153, 0.12)',
    accept: '.pdf,.png,.jpg,.jpeg,.webp,.tiff',
    acceptLabel: 'PDF, PNG, JPG, WebP, TIFF',
    endpoint: '/api/convert/ocr-to-word',
    multiple: false,
    outputExt: '.docx',
    async: true,
    params: [
      {
        key: 'lang',
        label: 'Document Language',
        type: 'select',
        default: 'eng',
        options: [
          { value: 'eng', label: 'English' },
          { value: 'spa', label: 'Spanish' },
          { value: 'fra', label: 'French' },
          { value: 'deu', label: 'German' },
          { value: 'ita', label: 'Italian' },
          { value: 'por', label: 'Portuguese' },
        ],
      },
    ],
  },
  {
    id: 'pdf-to-markdown',
    title: 'PDF to Markdown',
    description: 'Convert PDF documents into formatted Markdown (.md) files.',
    icon: FileCode,
    color: '#0284C7',
    colorLight: 'rgba(2, 132, 199, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-markdown',
    multiple: false,
    outputExt: '.md',
    async: true,
  },
  {
    id: 'repair-pdf',
    title: 'Repair PDF',
    description: 'Fix corrupt or damaged PDF documents by rebuilding structure and cross-references.',
    icon: Wrench,
    color: '#10B981',
    colorLight: 'rgba(16, 185, 129, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/repair-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'pdf-to-pptx',
    title: 'PDF to PowerPoint',
    description: 'Convert PDF document pages into PowerPoint presentation slides.',
    icon: Presentation,
    color: '#F97316',
    colorLight: 'rgba(249, 115, 22, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-pptx',
    multiple: false,
    outputExt: '.pptx',
    async: true,
  },
  {
    id: 'pdf-to-excel',
    title: 'PDF to Excel',
    description: 'Extract tables from PDF files into an editable Excel workbook.',
    icon: Table,
    color: '#16A34A',
    colorLight: 'rgba(22, 163, 74, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-excel',
    multiple: false,
    outputExt: '.xlsx',
    async: true,
  },
  {
    id: 'pptx-to-pdf',
    title: 'PowerPoint to PDF',
    description: 'Convert PowerPoint presentations (.pptx, .ppt) to high-quality PDF files.',
    icon: Presentation,
    color: '#EA580C',
    colorLight: 'rgba(234, 88, 12, 0.12)',
    accept: '.pptx,.ppt,.odp',
    acceptLabel: 'PPTX, PPT, ODP',
    endpoint: '/api/convert/pptx-to-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'excel-to-pdf',
    title: 'Excel to PDF',
    description: 'Convert Excel spreadsheets (.xlsx, .xls, .csv) to PDF documents.',
    icon: FileSpreadsheet,
    color: '#059669',
    colorLight: 'rgba(5, 150, 105, 0.12)',
    accept: '.xlsx,.xls,.ods,.csv',
    acceptLabel: 'XLSX, XLS, CSV',
    endpoint: '/api/convert/excel-to-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'flatten-pdf',
    title: 'Flatten PDF Forms',
    description: 'Bake interactive PDF form fields into read-only static content.',
    icon: FileCheck,
    color: '#6366F1',
    colorLight: 'rgba(99, 102, 241, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/flatten-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  //  Convert to PDF 
  {
    id: 'html-to-pdf',
    title: 'HTML to PDF',
    description: 'Convert web pages, HTML files, or raw code into a clean PDF document.',
    icon: Code,
    color: '#06B6D4',
    colorLight: 'rgba(6, 182, 212, 0.12)',
    accept: '.html,.htm',
    acceptLabel: 'HTML, HTM',
    endpoint: '/api/convert/html-to-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },

  {
    id: 'text-to-pdf',
    title: 'Text to PDF',
    description: 'Convert plain text files (.txt, .log, .md, .csv) into clean PDF documents.',
    icon: FileText,
    color: '#3B82F6',
    colorLight: 'rgba(59, 130, 246, 0.12)',
    accept: '.txt,.text,.log,.md,.csv',
    acceptLabel: 'TXT, LOG, MD, CSV',
    endpoint: '/api/convert/text-to-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'pdf-to-pdfa',
    title: 'PDF to PDF/A',
    description: 'Convert PDF documents into ISO-compliant long-term archival format (PDF/A).',
    icon: ShieldCheck,
    color: '#059669',
    colorLight: 'rgba(5, 150, 105, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/pdf-to-pdfa',
    multiple: false,
    outputExt: '.pdf',
    async: true,
    params: [
      {
        key: 'conformance',
        label: 'PDF/A Conformance Level',
        type: 'select',
        options: [
          { value: 'PDF/A-2b', label: 'PDF/A-2b (Recommended - Modern ISO 19005-2)' },
          { value: 'PDF/A-1b', label: 'PDF/A-1b (Legacy Archival - ISO 19005-1)' },
          { value: 'PDF/A-3b', label: 'PDF/A-3b (Allows Embedded XML & Files)' },
        ],
        default: 'PDF/A-2b',
      },
      {
        key: 'allow_downgrade',
        label: 'Allow Downgrade of PDF/A Compliance Level',
        type: 'checkbox',
        default: true,
      },
    ],
  },
  //  Organize / Edit PDF 
  {
    id: 'compare-pdf',
    title: 'Compare PDFs',
    description: 'Compare two PDF documents side-by-side to visually inspect differences.',
    icon: GitCompare,
    color: '#8B5CF6',
    colorLight: 'rgba(139, 92, 246, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/compare-pdf',
    multiple: true,
    minFiles: 2,
    outputExt: '.pdf',
    async: true,
  },
  //  Direct Office Converters 
  {
    id: 'word-to-pptx',
    title: 'Word to PowerPoint',
    description: 'Convert Word documents (.docx) into PowerPoint presentation slides.',
    icon: Presentation,
    color: '#E056FD',
    colorLight: 'rgba(224, 86, 253, 0.12)',
    accept: '.docx,.doc',
    acceptLabel: 'DOCX, DOC',
    endpoint: '/api/convert/word-to-pptx',
    multiple: false,
    outputExt: '.pptx',
    async: true,
  },
  {
    id: 'pptx-to-word',
    title: 'PowerPoint to Word',
    description: 'Convert PowerPoint presentations (.pptx) into editable Word documents.',
    icon: FileText,
    color: '#F97316',
    colorLight: 'rgba(249, 115, 22, 0.12)',
    accept: '.pptx,.ppt',
    acceptLabel: 'PPTX, PPT',
    endpoint: '/api/convert/pptx-to-word',
    multiple: false,
    outputExt: '.docx',
    async: true,
  },
  {
    id: 'word-to-excel',
    title: 'Word to Excel',
    description: 'Extract tables, lists, and structured data from Word documents into Excel spreadsheets.',
    icon: FileSpreadsheet,
    color: '#10B981',
    colorLight: 'rgba(16, 185, 129, 0.12)',
    accept: '.docx,.doc',
    acceptLabel: 'DOCX, DOC',
    endpoint: '/api/convert/word-to-excel',
    multiple: false,
    outputExt: '.xlsx',
    async: true,
  },
  {
    id: 'excel-to-word',
    title: 'Excel to Word',
    description: 'Convert Excel spreadsheets (.xlsx) into styled Word document reports.',
    icon: FileType2,
    color: '#06B6D4',
    colorLight: 'rgba(6, 182, 212, 0.12)',
    accept: '.xlsx,.xls',
    acceptLabel: 'XLSX, XLS',
    endpoint: '/api/convert/excel-to-word',
    multiple: false,
    outputExt: '.docx',
    async: true,
  },
  {
    id: 'lock-pdf',
    title: 'Lock PDF',
    description: 'Protect your PDF document with a password (256-bit AES encryption).',
    icon: Lock,
    color: '#EF4444',
    colorLight: 'rgba(239, 68, 68, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/lock-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'unlock-pdf',
    title: 'Unlock PDF',
    description: 'Remove security password protection & permissions from PDF files.',
    icon: Unlock,
    color: '#F59E0B',
    colorLight: 'rgba(245, 158, 11, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/unlock-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
  {
    id: 'redact-pdf',
    title: 'Redact PDF',
    description: 'Permanently remove or block sensitive text and rectangular areas from PDF pages.',
    icon: EyeOff,
    color: '#DC2626',
    colorLight: 'rgba(220, 38, 38, 0.12)',
    accept: '.pdf',
    acceptLabel: 'PDF',
    endpoint: '/api/convert/redact-pdf',
    multiple: false,
    outputExt: '.pdf',
    async: true,
  },
];


//  Category Definitions 
const CATEGORIES = [
  {
    id: 'structure',
    title: 'Document Structure & Ordering',
    description: 'Merge, split, reorder, remove, or compare PDF pages.',
    badgeColor: '#06B6D4',
    toolIds: ['merge-pdf', 'split-pdf', 'remove-pages', 'extract-pages', 'organize-pdf', 'compare-pdf'],
  },
  {
    id: 'optimization',
    title: 'Optimization & Security',
    description: 'Compress size, repair corrupt PDFs, or flatten form fields.',
    badgeColor: '#10B981',
    toolIds: ['compress-pdf', 'compress-image', 'repair-pdf', 'flatten-pdf', 'lock-pdf', 'unlock-pdf', 'redact-pdf'],
  },
  {
    id: 'styling',
    title: 'Page Layout & Styling',
    description: 'Rotate, number, watermark, or archive to PDF/A.',
    badgeColor: '#F59E0B',
    toolIds: ['rotate-pdf', 'add-page-numbers', 'add-watermark', 'pdf-to-pdfa'],
  },
  {
    id: 'extraction',
    title: 'Smart Extraction & Web',
    description: 'Convert web pages, OCR scanned text, or Markdown code.',
    badgeColor: '#E056FD',
    toolIds: ['html-to-pdf', 'ocr-to-word', 'pdf-to-markdown'],
  },
  {
    id: 'generate',
    title: 'Create & Import PDF',
    description: 'Convert Office documents, images, or spreadsheets into PDF.',
    badgeColor: '#8B5CF6',
    toolIds: ['image-to-pdf', 'word-to-pdf', 'pptx-to-pdf', 'excel-to-pdf', 'text-to-pdf'],
  },
  {
    id: 'export',
    title: 'Export & Extract Content',
    description: 'Extract editable text, Office docs, sheets, or images from PDF.',
    badgeColor: '#3B82F6',
    toolIds: ['pdf-to-word', 'pdf-to-pptx', 'pdf-to-excel', 'pdf-to-images', 'pdf-to-text'],
  },
  {
    id: 'office',
    title: 'Direct Office Converters',
    description: 'Convert directly between Word, PowerPoint, and Excel formats.',
    badgeColor: '#EC4899',
    toolIds: ['word-to-pptx', 'pptx-to-word', 'word-to-excel', 'excel-to-word'],
  },
];


// Tool Card Component 
function ToolCard({ tool, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      onClick={onClick}
      className="glass-card p-5 md:p-6 flex flex-col items-start gap-4 group cursor-pointer text-left transition-all duration-300 hover:-translate-y-1 hover:border-black/20 dark:hover:border-slate-300 dark:border-white/20 active:scale-[0.98] h-full min-h-[180px] rounded-2xl relative overflow-hidden w-full"
      id={`tool-card-${tool.id}`}
    >
      {/* Radial brand color corner glow on hover */}
      <div
        className="absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${tool.color}30 0%, transparent 70%)` }}
      />

      {/* Icon Tile */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0"
        style={{ background: tool.colorLight, border: `1px solid ${tool.color}40`, boxShadow: `0 0 15px ${tool.color}15` }}
      >
        <Icon size={24} style={{ color: tool.color }} />
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-between w-full">
        <div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white mb-1.5 transition-colors">
            {tool.title}
          </h3>
          <p className="text-xs md:text-sm text-slate-600 dark:text-neutral-300 leading-relaxed font-normal mb-4">
            {tool.description}
          </p>
        </div>

        {/* Accept Format Badge */}
        <div className="flex items-center gap-2 mt-auto">
          <span
            className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-md transition-all bg-slate-200/60 dark:bg-white/5 border border-slate-300 dark:border-white/10"
            style={{ background: tool.colorLight, color: tool.color, border: `1px solid ${tool.color}30` }}
          >
            {tool.acceptLabel}
          </span>
        </div>
        </div>
    </button>
  );
}


//  Multi-Segment Builder Component for Split PDF 
function MultiSegmentBuilder({ value = '', onChange, pdfPageCount = null }) {
  const parseRangesStr = (str) => {
    if (!str || typeof str !== 'string') return ['1-3', '4-6'];
    const parts = str.split(';').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['1-3', '4-6'];
  };

  const [segments, setSegments] = useState(() => parseRangesStr(value));
  const [activePreset, setActivePreset] = useState('custom');

  useEffect(() => {
    if (!value) {
      onChange('1-3 ; 4-6');
    } else {
      const currentCombined = segments.map(s => s.trim()).filter(Boolean).join(' ; ');
      if (value !== currentCombined) {
        setSegments(parseRangesStr(value));
      }
    }
  }, [value]);

  const updateSegments = (newSegs, presetName = 'custom') => {
    setSegments(newSegs);
    setActivePreset(presetName);
    const combined = newSegs.map(s => s.trim()).filter(Boolean).join(' ; ');
    onChange(combined);
  };

  const handleSegmentChange = (index, val) => {
    const next = [...segments];
    next[index] = val;
    updateSegments(next, 'custom');
  };

  const addSegment = () => {
    const lastSeg = segments[segments.length - 1] || '';
    let nextVal = '1';
    const match = lastSeg.match(/(\d+)-(\d+)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      const diff = Math.max(1, end - start + 1);
      const newStart = end + 1;
      const newEnd = pdfPageCount ? Math.min(pdfPageCount, newStart + diff - 1) : newStart + diff - 1;
      nextVal = `${newStart}-${newEnd}`;
    } else {
      const singleNum = parseInt(lastSeg, 10);
      if (!isNaN(singleNum)) {
        nextVal = `${singleNum + 1}`;
      }
    }
    updateSegments([...segments, nextVal], 'custom');
  };

  const removeSegment = (index) => {
    if (segments.length <= 1) return;
    const next = segments.filter((_, i) => i !== index);
    updateSegments(next, 'custom');
  };

  const applyPreset = (presetKey) => {
    const totalP = pdfPageCount || 10;
    if (presetKey === '2-part') {
      const half = Math.ceil(totalP / 2);
      updateSegments([`1-${half}`, `${half + 1}-${totalP}`], '2-part');
    } else if (presetKey === 'odd-even') {
      const odds = [];
      const evens = [];
      for (let i = 1; i <= Math.min(totalP, 20); i++) {
        if (i % 2 !== 0) odds.push(i);
        else evens.push(i);
      }
      updateSegments([odds.join(', '), evens.join(', ')], 'odd-even');
    } else if (presetKey === 'single-pages') {
      const singleList = [];
      for (let i = 1; i <= Math.min(totalP, 5); i++) {
        singleList.push(String(i));
      }
      updateSegments(singleList, 'single-pages');
    } else if (presetKey === 'custom') {
      const half = Math.max(1, Math.floor(totalP / 2));
      updateSegments([`1-${half}`, `${half + 1}-${totalP}`], 'custom');
    }
  };

  const validSegmentsCount = segments.map(s => s.trim()).filter(Boolean).length;
  const isZipOutput = validSegmentsCount > 1;

  return (
    <div className="space-y-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 font-sans">
      {/* Total Page Count Guidance Banner */}
      {pdfPageCount ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-xs font-semibold font-mono shadow-inner">
          <span className="flex items-center gap-2">
            <BookOpen size={15} className="text-cyan-400 shrink-0" />
            <span>Uploaded PDF Length:</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 font-extrabold border border-cyan-400/40 text-xs">
            {pdfPageCount} {pdfPageCount === 1 ? 'Page' : 'Pages'} Total
          </span>
        </div>
      ) : null}
      {/* Presets Header & Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
        <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">
          Quick Range Presets:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset('custom')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              activePreset === 'custom'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
            }`}
          >
            Custom Segments
          </button>
          <button
            type="button"
            onClick={() => applyPreset('2-part')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              activePreset === '2-part'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
            }`}
          >
            2-Part Split
          </button>
          <button
            type="button"
            onClick={() => applyPreset('odd-even')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              activePreset === 'odd-even'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
            }`}
          >
            Odd / Even
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single-pages')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              activePreset === 'single-pages'
                ? 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40 shadow-sm'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
            }`}
          >
            Single Pages
          </button>
        </div>
      </div>

      {/* Segments Input List */}
      <div className="space-y-2.5">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 shrink-0 min-w-[95px] text-center">
              Output #{idx + 1}
            </span>
            <input
              type="text"
              value={seg}
              placeholder="e.g. 1-3 or 1, 3, 5"
              onChange={(e) => handleSegmentChange(idx, e.target.value)}
              className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-neutral-600 focus:outline-none focus:border-red-500/50 transition-colors font-mono"
            />
            {segments.length > 1 && (
              <button
                type="button"
                onClick={() => removeSegment(idx)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-red-500/20 text-slate-600 dark:text-neutral-400 hover:text-red-800 dark:text-red-300 transition-colors border border-slate-200 dark:border-white/10 hover:border-red-500/30 shrink-0 cursor-pointer"
                title="Remove segment"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Controls & Summary Output Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={addSegment}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
        >
          <Plus size={15} /> Add Segment
        </button>

        {/* Clear Segment & Output Count Indicator */}
        <div className="flex items-center gap-2.5 text-xs px-3.5 py-2 rounded-xl bg-slate-100/90 dark:bg-black/40 border border-slate-200 dark:border-white/10">
          <span className="text-slate-700 dark:text-neutral-300 font-semibold">
            {validSegmentsCount} {validSegmentsCount === 1 ? 'Segment' : 'Segments'}
          </span>
          <span className="text-slate-500 dark:text-neutral-500 font-bold">→</span>
          <span className={`font-bold ${isZipOutput ? 'text-amber-400' : 'text-emerald-400'}`}>
            {validSegmentsCount} {validSegmentsCount === 1 ? 'Output PDF' : 'Output PDFs'}
            {isZipOutput ? ' (ZIP Archive)' : ''}
          </span>
        </div>
      </div>

      {/* Semicolon-Separated Combined String Live Preview */}
      <div className="text-[11px] text-slate-500 dark:text-neutral-500 flex items-center justify-between pt-1 border-t border-white/5">
        <span>Combined Payload Range:</span>
        <span className="font-mono text-slate-700 dark:text-neutral-300 bg-slate-100/90 dark:bg-black/40 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 max-w-[280px] md:max-w-[400px] truncate">
          {value || segments.filter(s => s.trim()).join(' ; ') || '1-3'}
        </span>
      </div>
    </div>
  );
}


// Helper to parse page range strings into a Set of 1-indexed numbers (e.g. "2, 4-6, 9")
function parsePageRanges(inputStr, totalPages) {
  const pages = new Set();
  if (!inputStr || typeof inputStr !== 'string') return pages;

  const parts = inputStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const rangeParts = trimmed.split('-').map(s => parseInt(s.trim(), 10));
      if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
        const start = Math.max(1, Math.min(rangeParts[0], rangeParts[1]));
        const end = Math.min(totalPages, Math.max(rangeParts[0], rangeParts[1]));
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        pages.add(num);
      }
    }
  }
  return pages;
}

// Helper to format a Set of 1-indexed page numbers into a compact range string e.g. "2, 4-6, 9"
function formatPageRanges(pageNumbersSet) {
  const sorted = Array.from(pageNumbersSet).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const num = sorted[i];
    if (num === end + 1) {
      end = num;
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = num;
      end = num;
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(', ');
}


// Interactive Page Thumbnail Card Component
function ThumbnailCard({
  pdfDoc,
  pageNum,
  isSelected,
  onToggleSelect,
  onZoom,
  onCardClick,
  mode = 'remove' // 'remove' | 'extract'
}) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);
  const isExtract = mode === 'extract';

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const renderThumbnail = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering thumbnail page ${pageNum}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum]);

  return (
    <div
      onClick={(e) => onCardClick(e, pageNum)}
      onDoubleClick={() => onZoom(pageNum)}
      className={`
        relative group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 select-none
        border-2 flex flex-col items-center bg-white dark:bg-neutral-900/90 shadow-md hover:shadow-2xl hover:-translate-y-1
        ${isSelected
          ? isExtract
            ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
            : 'border-red-500 ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.35)]'
          : 'border-slate-200 dark:border-white/10 hover:border-white/30'
        }
      `}
    >
      {/* Page Badge */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-950/80 border-b border-slate-200 dark:border-white/10 z-10">
        <span className="text-xs font-extrabold font-mono text-slate-700 dark:text-neutral-300">
          Page {pageNum}
        </span>
        {isSelected && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            isExtract
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            {isExtract ? 'Extracted' : 'Removed'}
          </span>
        )}
      </div>

      {/* Canvas Area with Overlay */}
      <div className="relative w-full aspect-[1/1.3] bg-neutral-950 flex items-center justify-center p-2 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-950/80 z-10">
            <Loader2 className="animate-spin text-slate-500 dark:text-neutral-500" size={22} />
          </div>
        )}
        <canvas ref={canvasRef} className="max-h-full max-w-full object-contain rounded shadow-sm" />

        {/* Selected / Marked Overlay */}
        {isSelected && (
          <div className={`absolute inset-0 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-20 transition-all animate-fade-in ${
            isExtract ? 'bg-emerald-950/60' : 'bg-red-950/60'
          }`}>
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-slate-900 dark:text-white shadow-2xl scale-110 ${
              isExtract ? 'bg-emerald-600/90 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'bg-red-600/90 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.8)]'
            }`}>
              {isExtract ? <CheckCircle2 size={28} strokeWidth={3} /> : <X size={28} strokeWidth={3} />}
            </div>
            <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
              isExtract ? 'text-emerald-900 dark:text-emerald-200 bg-emerald-950/90 border-emerald-500/40' : 'text-red-900 dark:text-red-200 bg-red-950/90 border-red-500/40'
            }`}>
              {isExtract ? 'Marked for Extraction' : 'Marked for Removal'}
            </span>
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className={`
          absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200
          flex items-center justify-center gap-3 z-30
          ${isSelected ? 'bg-slate-200/80 dark:bg-black/60' : ''}
        `}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoom(pageNum);
            }}
            className="w-10 h-10 rounded-xl bg-white/20 hover:bg-cyan-500 text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20"
            title="Zoom / Preview Page"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(pageNum);
            }}
            className={`
              w-10 h-10 rounded-xl text-slate-900 dark:text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20
              ${isExtract
                ? isSelected
                  ? 'bg-neutral-800 hover:bg-neutral-700'
                  : 'bg-emerald-600/80 hover:bg-emerald-500'
                : isSelected
                  ? 'bg-emerald-500/80 hover:bg-emerald-500'
                  : 'bg-red-500/80 hover:bg-red-600'
              }
            `}
            title={
              isExtract
                ? (isSelected ? 'Deselect Page' : 'Extract Page')
                : (isSelected ? 'Keep Page' : 'Remove Page')
            }
          >
            {isExtract ? (
              isSelected ? <X size={18} /> : <CheckCircle2 size={18} />
            ) : (
              isSelected ? <CheckCircle2 size={18} /> : <Trash2 size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// Full Page Zoom & Content Inspection Modal Component
function PageZoomModal({
  isOpen,
  pdfDoc,
  pageNum,
  totalPages,
  isSelected,
  onClose,
  onNavigate,
  onToggleSelect,
  mode = 'remove'
}) {
  const canvasRef = useRef(null);
  const [zoomScale, setZoomScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);
  const isExtractMode = mode === 'split-pages' || mode === 'extract' || mode === 'extract-pages';

  useEffect(() => {
    if (!isOpen || !pdfDoc || !canvasRef.current || !pageNum) return;

    let isCancelled = false;
    const renderHighResPage = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: zoomScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering zoomed page ${pageNum}:`, err);
        }
      }
    };

    renderHighResPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [isOpen, pdfDoc, pageNum, zoomScale]);

  if (!isOpen || !pageNum) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white/95 dark:bg-black/90 backdrop-blur-xl animate-fade-in font-sans">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-neutral-950/80">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
          <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white tracking-wide">
            Page {pageNum} of {totalPages} Preview
          </h3>
          {isSelected && (
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1 ${
              isExtractMode
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {isExtractMode ? <CheckCircle2 size={13} /> : null}
              {isExtractMode ? 'Selected for Extraction' : 'Marked for Removal'}
            </span>
          )}
        </div>

        {/* Zoom Controls & Close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-1">
            <button
              onClick={() => setZoomScale(s => Math.max(0.75, s - 0.25))}
              className="p-2 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-neutral-300 px-2 min-w-[50px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(s => Math.min(3.0, s + 0.25))}
              className="p-2 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={() => setZoomScale(1.5)}
              className="p-2 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-200/60 dark:bg-white/10 hover:bg-red-500/20 text-slate-700 dark:text-neutral-300 hover:text-red-400 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer ml-2"
            title="Close Preview (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Canvas Container (Scrollable) */}
      <div className="flex-1 overflow-y-auto overflow-x-auto py-8 px-6 flex items-start justify-center relative min-h-0 bg-neutral-900/50">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/70 z-20">
            <Loader2 className="animate-spin text-cyan-400" size={36} />
            <span className="text-xs font-mono text-slate-700 dark:text-neutral-300">Rendering high-DPI page...</span>
          </div>
        )}
        <div className={`relative shadow-2xl rounded-lg overflow-hidden border border-white/15 bg-white ${
          isSelected
            ? (isExtractMode ? 'ring-4 ring-emerald-500/80' : 'ring-4 ring-red-500/80')
            : ''
        }`}>
          <canvas ref={canvasRef} className="block max-w-full" />
          {isSelected && (
            <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${
              isExtractMode ? 'bg-emerald-950/20' : 'bg-red-950/30'
            }`}>
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-slate-900 dark:text-white shadow-2xl ${
                isExtractMode ? 'bg-emerald-600/90 border-emerald-300' : 'bg-red-600/90 border-red-300'
              }`}>
                {isExtractMode ? <CheckCircle2 size={60} strokeWidth={3} /> : <X size={60} strokeWidth={3} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-neutral-950/90 gap-4">
        {/* Previous / Next Page Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(pageNum - 1)}
            disabled={pageNum <= 1}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 disabled:opacity-30 disabled:hover:bg-slate-100 dark:bg-white/5 text-neutral-200 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
          >
            <ChevronLeft size={16} /> Previous Page
          </button>
          <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
            Page {pageNum} of {totalPages}
          </span>
          <button
            onClick={() => onNavigate(pageNum + 1)}
            disabled={pageNum >= totalPages}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 disabled:opacity-30 disabled:hover:bg-slate-100 dark:bg-white/5 text-neutral-200 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
          >
            Next Page <ChevronRight size={16} />
          </button>
        </div>

        {/* Toggle Action State */}
        <button
          onClick={() => onToggleSelect(pageNum)}
          className={`
            px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 shadow-lg transition-all cursor-pointer hover:scale-105
            ${isExtractMode
              ? isSelected
                ? 'bg-neutral-800 hover:bg-neutral-700 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-white/10'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : isSelected
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
            }
          `}
        >
          {isExtractMode ? (
            isSelected ? (
              <>
                <X size={16} /> Deselect Page for Extraction
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Select Page for Extraction
              </>
            )
          ) : isSelected ? (
            <>
              <CheckCircle2 size={16} /> Keep Page in Document
            </>
          ) : (
            <>
              <Trash2 size={16} /> Mark Page for Removal
            </>
          )}
        </button>
      </div>
    </div>
  );
}


// Draggable Card component for Organize PDF
function DraggableOrganizePageCard({
  card,
  index,
  totalCards,
  pdfDoc,
  onMoveLeft,
  onMoveRight,
  onRemoveCard,
  onZoomCard,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver
}) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current || card.pageIndex == null) return;

    const renderThumbnail = async () => {
      try {
        setLoading(true);
        const pageNum = card.pageIndex + 1;
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering organize thumbnail page ${card.pageIndex + 1}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, card.pageIndex]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className={`
        relative group rounded-2xl overflow-hidden transition-all duration-200 select-none
        border-2 flex flex-col items-center bg-white dark:bg-neutral-900/90 shadow-md hover:shadow-2xl
        ${isDragging ? 'opacity-40 scale-95 border-cyan-500 border-dashed' : ''}
        ${isDragOver ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-[1.02]' : 'border-slate-200 dark:border-white/10 hover:border-white/30'}
      `}
    >
      {/* Top Bar: Drag Grip & Doc Label & Sequence Index */}
      <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-neutral-950/80 border-b border-slate-200 dark:border-white/10 z-10 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical size={14} className="text-slate-500 dark:text-neutral-500 cursor-grab shrink-0 hover:text-slate-900 dark:text-white" />
          <span className="text-xs font-bold font-mono text-purple-800 dark:text-purple-300 truncate" title={card.docLabel}>
            {card.docLabel}
          </span>
        </div>
        <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 shrink-0">
          #{index + 1}
        </span>
      </div>

      {/* Canvas Area */}
      <div className="relative w-full aspect-[1/1.3] bg-neutral-950 flex items-center justify-center p-2 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-950/80 z-10">
            <Loader2 className="animate-spin text-slate-500 dark:text-neutral-500" size={22} />
          </div>
        )}
        <canvas ref={canvasRef} className="max-h-full max-w-full object-contain rounded shadow-sm pointer-events-none" />

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-slate-200/80 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-20">
          <button
            type="button"
            onClick={() => onZoomCard(card)}
            className="p-2.5 rounded-xl bg-white/20 hover:bg-cyan-500 text-white backdrop-blur-md transition-all hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20"
            title="Zoom / Preview Page"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => onRemoveCard(index)}
            className="p-2.5 rounded-xl bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-md transition-all hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20"
            title="Remove Page"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Bottom Reorder Bar: Sideways Chevron Left / Right Buttons */}
      <div className="w-full flex items-center justify-between px-2 py-1.5 bg-slate-100 dark:bg-neutral-950/90 border-t border-slate-200 dark:border-white/10 z-10">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMoveLeft(index)}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-white/15 disabled:opacity-20 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Move Left"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono">
          Page {card.pageIndex + 1}
        </span>

        <button
          type="button"
          disabled={index === totalCards - 1}
          onClick={() => onMoveRight(index)}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-white/15 disabled:opacity-20 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
          title="Move Right"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// Visual Interactive Organize PDF View with Drag-and-Drop & Page Numbering Controls
function OrganizePdfVisualView({
  files,
  setFiles,
  extraParams,
  setExtraParams,
  tool,
  onConvert,
  status,
  onChangeFile,
  onClearFile,
  focusedFeature
}) {
  const [docPdfs, setDocPdfs] = useState([]); // array of { fileIndex, file, pdfDoc, numPages, name }
  const [pagesList, setPagesList] = useState([]); // array of { id, docIndex, pageIndex, docLabel }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [zoomedCard, setZoomedCard] = useState(null);

  const insertFileInputRef = useRef(null);
  const draggedIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Load all PDF documents in `files` list
  useEffect(() => {
    let isMounted = true;
    if (!files || files.length === 0) {
      setDocPdfs([]);
      setPagesList([]);
      setLoading(false);
      return;
    }

    const loadAllPdfs = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const loadedDocs = [];
        for (let idx = 0; idx < files.length; idx++) {
          const f = files[idx];
          const arrayBuffer = await f.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          loadedDocs.push({
            fileIndex: idx,
            file: f,
            pdfDoc: pdfDoc,
            numPages: pdfDoc.numPages,
            name: f.name
          });
        }

        if (!isMounted) return;
        setDocPdfs(loadedDocs);

        // Build or maintain page cards
        setPagesList(prevList => {
          const existingDocIndices = new Set(prevList.map(p => p.docIndex));
          const newCards = [...prevList];

          loadedDocs.forEach(doc => {
            if (!existingDocIndices.has(doc.fileIndex)) {
              for (let p = 0; p < doc.numPages; p++) {
                newCards.push({
                  id: `doc_${doc.fileIndex}_p_${p}_${Math.random().toString(36).substring(2, 9)}`,
                  docIndex: doc.fileIndex,
                  pageIndex: p,
                  docLabel: loadedDocs.length > 1 ? `Doc ${doc.fileIndex + 1}: Page ${p + 1}` : `Page ${p + 1}`
                });
              }
            }
          });

          // Filter out cards for docIndices that no longer exist in loadedDocs
          const validDocIndices = new Set(loadedDocs.map(d => d.fileIndex));
          const filteredCards = newCards.filter(c => validDocIndices.has(c.docIndex));

          // Update docLabels if single/multi state changed
          const updatedLabelsCards = filteredCards.map(c => ({
            ...c,
            docLabel: loadedDocs.length > 1 ? `Doc ${c.docIndex + 1}: Page ${c.pageIndex + 1}` : `Page ${c.pageIndex + 1}`
          }));

          return updatedLabelsCards;
        });

        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF documents for organize view:', err);
        if (isMounted) {
          setLoadError('Failed to parse PDF document(s).');
          setLoading(false);
        }
      }
    };

    loadAllPdfs();

    return () => { isMounted = false; };
  }, [files]);

  // Sync pagesList to extraParams.order whenever pagesList changes
  useEffect(() => {
    if (pagesList.length > 0) {
      const orderStr = pagesList.map(p => `${p.docIndex}:${p.pageIndex}`).join(', ');
      setExtraParams(prev => {
        if (prev.order === orderStr) return prev;
        return { ...prev, order: orderStr };
      });
    }
  }, [pagesList, setExtraParams]);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = draggedIndexRef.current;
    if (sourceIndex === null || sourceIndex === undefined || sourceIndex === targetIndex) {
      setDragOverIndex(null);
      draggedIndexRef.current = null;
      return;
    }

    setPagesList(prev => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });

    setDragOverIndex(null);
    draggedIndexRef.current = null;
  };

  // Sideways Move Left / Move Right
  const handleMoveLeft = (index) => {
    if (index <= 0) return;
    setPagesList(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveRight = (index) => {
    if (index >= pagesList.length - 1) return;
    setPagesList(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  // Remove page card
  const handleRemoveCard = (index) => {
    setPagesList(prev => prev.filter((_, i) => i !== index));
  };

  // Insert New PDF File(s)
  const handleInsertPdfFiles = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const validPdfs = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (validPdfs.length > 0) {
      setFiles(prev => [...prev, ...validPdfs]);
    }
    e.target.value = '';
  };

  // Page Numbers Controls Default Values
  const addPageNumbers = extraParams.add_page_numbers === true || extraParams.add_page_numbers === 'true';
  const pageNumberPosition = extraParams.page_number_position || 'bottom-center';
  const pageNumberFormat = extraParams.page_number_format || 'Page {page} of {total}';
  const startNumber = extraParams.start_number ?? 1;

  const totalPagesCount = docPdfs.reduce((sum, d) => sum + d.numPages, 0);

  if (loading) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className="animate-spin text-purple-400" size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Loading PDF Pages for Organizing...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Preparing visual interactive page cards</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Preview Rendering Warning
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* File Header Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <SlidersHorizontal size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={files.map(f => f.name).join(', ')}>
              {files.length === 1 ? files[0].name : `${files.length} PDF Documents Loaded`}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
              {files.length} File{files.length > 1 ? 's' : ''} • <strong className="text-purple-400">{totalPagesCount} Total Pages</strong> ({pagesList.length} in sequence)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={insertFileInputRef}
            onChange={handleInsertPdfFiles}
            accept=".pdf"
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => insertFileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-800 dark:text-purple-300 text-xs font-bold border border-purple-500/40 transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-105"
          >
            <Plus size={15} /> + Insert PDF / Pages
          </button>

          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              Replace Main
            </button>
          )}

          {onClearFile && (
            <button
              type="button"
              onClick={onClearFile}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Main Multi-Column Organize Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Draggable Cards Grid (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                <GripVertical size={15} className="text-purple-400" />
                Drag cards sideways or use arrows to reorder pages
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertFileInputRef.current?.click()}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus size={13} className="text-purple-400" /> Insert PDF
              </button>
            </div>
          </div>

          {pagesList.length === 0 ? (
            <div className="glass-card-static p-12 text-center rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 text-sm">
              No pages currently in output document. Click <strong>+ Insert PDF / Pages</strong> to add pages.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-1 p-1">
              {pagesList.map((card, idx) => {
                const docObj = docPdfs.find(d => d.fileIndex === card.docIndex);
                return (
                  <DraggableOrganizePageCard
                    key={card.id}
                    card={card}
                    index={idx}
                    totalCards={pagesList.length}
                    pdfDoc={docObj?.pdfDoc}
                    onMoveLeft={handleMoveLeft}
                    onMoveRight={handleMoveRight}
                    onRemoveCard={handleRemoveCard}
                    onZoomCard={(c) => setZoomedCard(c)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    isDragging={draggedIndexRef.current === idx}
                    isDragOver={dragOverIndex === idx}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Settings Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Guidance Banner */}
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 space-y-2 text-xs shadow-lg">
            <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300 text-sm">
              <Zap size={16} className="text-purple-400" /> Organize PDF Guidance
            </div>
            <p className="leading-relaxed text-purple-900/90 dark:text-purple-200/90">
              Drag cards sideways or use left/right arrows to reorder pages. Insert additional PDF files to combine and organize pages across documents.
            </p>
          </div>

          {/* Add Page Numbers Controls Panel */}
          <div className={`glass-card-static p-5 rounded-2xl border transition-all ${
            focusedFeature === 'page-numbers' || addPageNumbers
              ? 'border-purple-500/80 ring-2 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
              : 'border-slate-200 dark:border-white/10'
          }`}>
            {focusedFeature === 'page-numbers' && (
              <div className="mb-3 p-3 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-900 dark:text-purple-200 text-xs font-bold flex items-center gap-2.5 animate-pulse">
                <Sparkles size={18} className="text-purple-800 dark:text-purple-300 shrink-0" />
                <span>👉 Page Numbering enabled! Configure position, format & starting number below.</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                <Hash size={15} className="text-purple-400" /> Add Page Numbers to PDF
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={addPageNumbers}
                  onChange={(e) => setExtraParams(prev => ({ ...prev, add_page_numbers: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200/60 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {addPageNumbers && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10 animate-fade-in">
                {/* Position Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Position</label>
                  <select
                    value={pageNumberPosition}
                    onChange={(e) => setExtraParams(prev => ({ ...prev, page_number_position: e.target.value }))}
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    <option value="bottom-center" className="bg-neutral-900 text-slate-900 dark:text-white">Bottom Center</option>
                    <option value="bottom-right" className="bg-neutral-900 text-slate-900 dark:text-white">Bottom Right</option>
                    <option value="top-right" className="bg-neutral-900 text-slate-900 dark:text-white">Top Right</option>
                    <option value="top-center" className="bg-neutral-900 text-slate-900 dark:text-white">Top Center</option>
                    <option value="bottom-left" className="bg-neutral-900 text-slate-900 dark:text-white">Bottom Left</option>
                    <option value="top-left" className="bg-neutral-900 text-slate-900 dark:text-white">Top Left</option>
                  </select>
                </div>

                {/* Format Options */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300 font-sans">Format Options</label>
                  <input
                    type="text"
                    value={pageNumberFormat}
                    onChange={(e) => setExtraParams(prev => ({ ...prev, page_number_format: e.target.value }))}
                    placeholder="Page {page} of {total}"
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['Page {page} of {total}', '{page}', 'Page {page}'].map(fmt => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setExtraParams(prev => ({ ...prev, page_number_format: fmt }))}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all ${
                          pageNumberFormat === fmt
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-800 dark:text-purple-300'
                            : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-neutral-200 font-bold hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Start Number</label>
                  <input
                    type="number"
                    min="1"
                    value={startNumber}
                    onChange={(e) => setExtraParams(prev => ({ ...prev, start_number: parseInt(e.target.value, 10) || 1 }))}
                    className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <button
            disabled={pagesList.length === 0 || status === 'converting'}
            onClick={onConvert}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl cursor-pointer bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
          >
            <SlidersHorizontal size={18} />
            Save & Organize PDF ({pagesList.length} Pages)
          </button>
        </div>
      </div>

      {/* Full Page Zoom Modal */}
      {zoomedCard && (() => {
        const docObj = docPdfs.find(d => d.fileIndex === zoomedCard.docIndex);
        return (
          <PageZoomModal
            isOpen={true}
            pdfDoc={docObj?.pdfDoc}
            pageNum={zoomedCard.pageIndex + 1}
            totalPages={docObj?.numPages || 1}
            isSelected={false}
            onClose={() => setZoomedCard(null)}
            onNavigate={(newPageNum) => {
              setZoomedCard(prev => ({ ...prev, pageIndex: newPageNum - 1 }));
            }}
            onToggleSelect={() => {}}
            mode="organize"
          />
        );
      })()}
    </div>
  );
}


// Interactive Visual Page Removal Grid Component (ILovePDF Style)
function RemovePagesVisualGrid({ file, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [selectedPages, setSelectedPages] = useState(new Set());
  const [lastClickedPage, setLastClickedPage] = useState(null);
  const [zoomedPageNum, setZoomedPageNum] = useState(null);

  // 1. Load PDF document using pdfjs-dist
  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setLoadingPdf(false);
      return;
    }

    const loadPdf = async () => {
      try {
        setLoadingPdf(true);
        setLoadError(null);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoadingPdf(false);
      } catch (err) {
        console.error('Failed to parse PDF with pdfjs:', err);
        if (isMounted) {
          setLoadError('Unable to render PDF page previews. You can still type page numbers below.');
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [file]);

  // 2. Sync from manual text box input (extraParams.pages) -> selectedPages Set
  useEffect(() => {
    if (numPages > 0) {
      const rawPagesStr = extraParams.pages ?? '';
      const parsedSet = parsePageRanges(rawPagesStr, numPages);

      // Compare Sets to avoid infinite loop
      const isSame = parsedSet.size === selectedPages.size &&
        Array.from(parsedSet).every(p => selectedPages.has(p));

      if (!isSame) {
        setSelectedPages(parsedSet);
      }
    }
  }, [extraParams.pages, numPages]);

  // 3. Helper to update selectedPages and sync formatted string back to extraParams['pages']
  const updateSelectedPages = (newSet) => {
    setSelectedPages(newSet);
    const formattedStr = formatPageRanges(newSet);
    setExtraParams(prev => ({ ...prev, pages: formattedStr }));
  };

  // 4. Single / Shift-click selection handler
  const handleCardClick = (e, pageNum) => {
    const newSet = new Set(selectedPages);

    if (e.shiftKey && lastClickedPage !== null) {
      const start = Math.min(lastClickedPage, pageNum);
      const end = Math.max(lastClickedPage, pageNum);
      const shouldSelect = !selectedPages.has(pageNum);

      for (let p = start; p <= end; p++) {
        if (shouldSelect) {
          newSet.add(p);
        } else {
          newSet.delete(p);
        }
      }
    } else {
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      setLastClickedPage(pageNum);
    }

    updateSelectedPages(newSet);
  };

  const handleToggleSelect = (pageNum) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(pageNum)) {
      newSet.delete(pageNum);
    } else {
      newSet.add(pageNum);
    }
    setLastClickedPage(pageNum);
    updateSelectedPages(newSet);
  };

  // 5. Quick Actions
  const selectAll = () => {
    const allSet = new Set();
    for (let i = 1; i <= numPages; i++) allSet.add(i);
    updateSelectedPages(allSet);
  };

  const deselectAll = () => {
    updateSelectedPages(new Set());
  };

  const invertSelection = () => {
    const invertedSet = new Set();
    for (let i = 1; i <= numPages; i++) {
      if (!selectedPages.has(i)) {
        invertedSet.add(i);
      }
    }
    updateSelectedPages(invertedSet);
  };

  const remainingPagesCount = Math.max(0, numPages - selectedPages.size);
  const isExtract = tool?.id === 'extract-pages';
  const actionText = tool?.title || (isExtract ? 'Extract Pages' : 'Remove Pages');
  const ActionIcon = tool?.icon || (isExtract ? CheckCircle2 : Trash2);

  if (loadingPdf) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className={`animate-spin ${isExtract ? 'text-emerald-400' : 'text-red-500'}`} size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Parsing PDF Pages...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Rendering visual thumbnails for document inspection</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Preview Rendering Warning
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* File Header Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isExtract ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <FileText size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
              {(file.size / 1024).toFixed(1)} KB • <strong className="text-cyan-400">{numPages} Pages</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              Change File
            </button>
          )}
          {onClearFile && (
            <button
              type="button"
              onClick={onClearFile}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Multi-Column ILovePDF Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Visual Page Grid Area (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Grid Toolbar & Quick Selection Buttons */}
          <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                <BookOpen size={15} className={isExtract ? "text-emerald-400" : "text-red-400"} />
                {isExtract ? 'Select pages to extract' : 'Select pages to remove'}
              </span>
            </div>

            {/* Quick Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer hover:scale-105"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer hover:scale-105"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={invertSelection}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer hover:scale-105"
              >
                Invert Selection
              </button>
            </div>
          </div>

          {/* Responsive Thumbnail Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto pr-1 p-1">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
              <ThumbnailCard
                key={pageNum}
                pdfDoc={pdfDoc}
                pageNum={pageNum}
                isSelected={selectedPages.has(pageNum)}
                onToggleSelect={handleToggleSelect}
                onZoom={(p) => setZoomedPageNum(p)}
                onCardClick={handleCardClick}
                mode={isExtract ? 'extract' : 'remove'}
              />
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Guidance & Controls Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Guidance Banner */}
          <div className={`p-4 rounded-2xl border space-y-2 text-xs shadow-lg ${
            isExtract
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-900 dark:text-cyan-200'
          }`}>
            <div className={`flex items-center gap-2 font-bold text-sm ${
              isExtract ? 'text-emerald-800 dark:text-emerald-300' : 'text-cyan-800 dark:text-cyan-300'
            }`}>
              <Zap size={16} className={isExtract ? 'text-emerald-400' : 'text-cyan-400'} />
              {isExtract ? 'Page Extraction Guidance' : 'Page Removal Guidance'}
            </div>
            <p className="leading-relaxed">
              {isExtract
                ? "Click on pages to extract into a new PDF document. You can use 'shift' key to set ranges."
                : "Click on pages to remove from document. You can use 'shift' key to set ranges."}
            </p>
          </div>

          {/* Counter Summary Card */}
          <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center gap-2">
              <Hash size={14} className={isExtract ? "text-emerald-400" : "text-red-400"} /> Document Summary
            </span>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex flex-col items-center">
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{numPages}</span>
                <span className="text-[10px] text-slate-600 dark:text-neutral-400 uppercase font-semibold">Total</span>
              </div>
              <div className={`p-3 rounded-xl border flex flex-col items-center ${
                isExtract ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
              }`}>
                <span className={`text-lg font-black font-mono ${isExtract ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedPages.size}
                </span>
                <span className={`text-[10px] uppercase font-semibold font-sans ${isExtract ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                  {isExtract ? 'Extracted' : 'Removed'}
                </span>
              </div>
              <div className={`p-3 rounded-xl border flex flex-col items-center ${
                isExtract ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10' : 'bg-emerald-500/10 border-emerald-500/20'
              }`}>
                <span className={`text-lg font-black font-mono ${isExtract ? 'text-slate-700 dark:text-neutral-300' : 'text-emerald-400'}`}>
                  {remainingPagesCount}
                </span>
                <span className={`text-[10px] uppercase font-semibold font-sans ${isExtract ? 'text-slate-600 dark:text-neutral-400' : 'text-emerald-800 dark:text-emerald-300'}`}>
                  {isExtract ? 'Unselected' : 'Remaining'}
                </span>
              </div>
            </div>
          </div>

          {/* Pages to Remove / Extract Text Input Box */}
          <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-2.5">
            <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 flex items-center justify-between">
              <span>{isExtract ? 'Pages to extract' : 'Pages to remove'}</span>
              <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono">e.g. 2, 4-6</span>
            </label>
            <input
              type="text"
              value={extraParams.pages ?? ''}
              onChange={(e) => setExtraParams(prev => ({ ...prev, pages: e.target.value }))}
              placeholder="e.g. 2, 5, 8-10"
              className={`w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-neutral-600 focus:outline-none transition-colors font-mono ${
                isExtract ? 'focus:border-emerald-500/50' : 'focus:border-red-500/50'
              }`}
            />
            <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-relaxed">
              Directly edit range syntax here or click page thumbnails to update automatically.
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            disabled={selectedPages.size === 0 || status === 'converting'}
            onClick={onConvert}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl cursor-pointer text-slate-900 dark:text-white ${
              isExtract
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
            }`}
          >
            <ActionIcon size={18} />
            {actionText} ({selectedPages.size} {selectedPages.size === 1 ? 'Page' : 'Pages'} Marked)
          </button>
        </div>
      </div>

      {/* Full Page Zoom Modal */}
      <PageZoomModal
        isOpen={zoomedPageNum !== null}
        pdfDoc={pdfDoc}
        pageNum={zoomedPageNum}
        totalPages={numPages}
        isSelected={zoomedPageNum ? selectedPages.has(zoomedPageNum) : false}
        onClose={() => setZoomedPageNum(null)}
        onNavigate={(nextPage) => setZoomedPageNum(nextPage)}
        onToggleSelect={handleToggleSelect}
        mode={isExtract ? 'extract' : 'remove'}
      />
    </div>
  );
}


// Interactive Thumbnail Card for Split PDF Mode
function SplitPdfThumbnailCard({
  pdfDoc,
  pageNum,
  isSelected,
  onToggleSelect,
  onZoom,
  onCardClick,
  showCheckmark = true
}) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const renderThumbnail = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering thumbnail page ${pageNum}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum]);

  return (
    <div
      onClick={(e) => onCardClick && onCardClick(e, pageNum)}
      onDoubleClick={() => onZoom && onZoom(pageNum)}
      className={`
        relative group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 select-none
        border-2 flex flex-col items-center bg-white dark:bg-neutral-900/90 shadow-md hover:shadow-2xl hover:-translate-y-1
        ${isSelected
          ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
          : 'border-slate-200 dark:border-white/10 hover:border-white/30'
        }
      `}
    >
      {/* Top Header Bar with Page Badge */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-neutral-950/80 border-b border-slate-200 dark:border-white/10 z-10">
        <span className="text-[11px] font-extrabold font-mono text-slate-700 dark:text-neutral-300">
          Page {pageNum}
        </span>
        {isSelected && showCheckmark && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={10} /> Selected
          </span>
        )}
      </div>

      {/* Canvas Container */}
      <div className="relative w-full aspect-[1/1.3] bg-neutral-950 flex items-center justify-center p-2 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-950/80 z-10">
            <Loader2 className="animate-spin text-slate-500 dark:text-neutral-500" size={20} />
          </div>
        )}
        <canvas ref={canvasRef} className="max-h-full max-w-full object-contain rounded shadow-sm" />

        {/* Green Checkmark Badge overlay */}
        {isSelected && showCheckmark && (
          <div className="absolute top-2 right-2 z-20">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg border border-emerald-300 font-bold">
              <CheckCircle2 size={18} strokeWidth={3} />
            </div>
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-slate-200/80 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-30">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onZoom && onZoom(pageNum);
            }}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-cyan-500 text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20"
            title="Zoom / Preview Page"
          >
            <ZoomIn size={16} />
          </button>
          {onToggleSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(pageNum);
              }}
              className={`
                w-9 h-9 rounded-xl text-slate-900 dark:text-white backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 shadow-lg cursor-pointer border border-slate-300 dark:border-white/20
                ${isSelected ? 'bg-neutral-800 hover:bg-red-500' : 'bg-emerald-500 hover:bg-emerald-600'}
              `}
              title={isSelected ? 'Deselect Page' : 'Select Page'}
            >
              {isSelected ? <X size={16} /> : <CheckCircle2 size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// Visual Range Card for Split PDF Range Mode
function RangeCardVisual({
  rangeIndex,
  fromPage,
  toPage,
  totalPages,
  pdfDoc,
  onZoom,
  onRemove,
  onFromChange,
  onToChange,
  isCustomMode
}) {
  const pageCount = Math.max(0, toPage - fromPage + 1);

  const pages = [];
  if (fromPage > 0 && toPage >= fromPage) {
    for (let p = fromPage; p <= Math.min(toPage, totalPages); p++) {
      pages.push(p);
    }
  }

  let displayPages = [];
  let isTruncated = false;
  if (pages.length <= 4) {
    displayPages = pages;
  } else {
    displayPages = [pages[0], pages[1], pages[pages.length - 1]];
    isTruncated = true;
  }

  return (
    <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3 relative group">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
            Range {rangeIndex + 1}
          </span>
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'} (Page {fromPage} to {toPage})
          </span>
        </div>

        {isCustomMode && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-neutral-300 font-mono">
              <span>from</span>
              <input
                type="number"
                min={1}
                max={totalPages || 9999}
                value={fromPage}
                onChange={(e) => onFromChange(parseInt(e.target.value, 10) || 1)}
                className="w-16 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
              <span>to</span>
              <input
                type="number"
                min={fromPage}
                max={totalPages || 9999}
                value={toPage}
                onChange={(e) => onToChange(parseInt(e.target.value, 10) || fromPage)}
                className="w-16 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-red-500/20 text-slate-600 dark:text-neutral-400 hover:text-red-400 transition-colors border border-slate-200 dark:border-white/10 cursor-pointer"
                title="Remove range"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visual Range Card Thumbnails Row */}
      <div className="flex items-center gap-3 overflow-x-auto py-1">
        {pages.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-neutral-500 italic p-3">Invalid page range</div>
        ) : !isTruncated ? (
          pages.map(p => (
            <div key={p} className="w-24 shrink-0">
              <SplitPdfThumbnailCard
                pdfDoc={pdfDoc}
                pageNum={p}
                isSelected={false}
                onZoom={onZoom}
                showCheckmark={false}
              />
            </div>
          ))
        ) : (
          <>
            <div className="w-24 shrink-0">
              <SplitPdfThumbnailCard pdfDoc={pdfDoc} pageNum={displayPages[0]} isSelected={false} onZoom={onZoom} showCheckmark={false} />
            </div>
            <div className="w-24 shrink-0">
              <SplitPdfThumbnailCard pdfDoc={pdfDoc} pageNum={displayPages[1]} isSelected={false} onZoom={onZoom} showCheckmark={false} />
            </div>
            <div className="w-24 shrink-0 aspect-[1/1.3] rounded-2xl bg-neutral-900 border border-dashed border-slate-300 dark:border-white/20 flex flex-col items-center justify-center p-2 text-center">
              <span className="text-sm font-extrabold text-cyan-400 font-mono">...</span>
              <span className="text-[10px] text-slate-600 dark:text-neutral-400 font-semibold mt-1">
                +{pages.length - 3} pages
              </span>
            </div>
            <div className="w-24 shrink-0">
              <SplitPdfThumbnailCard pdfDoc={pdfDoc} pageNum={displayPages[2]} isSelected={false} onZoom={onZoom} showCheckmark={false} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// Interactive 3-Mode Visual View for Split PDF (ILovePDF Design)
function SplitPdfVisualView({
  file,
  pdfPageCount: propPdfPageCount,
  extraParams,
  setExtraParams,
  tool,
  onConvert,
  status,
  onChangeFile,
  onClearFile
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(propPdfPageCount || 0);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [zoomedPageNum, setZoomedPageNum] = useState(null);

  // 3 Mode Tabs: 'range' | 'pages' | 'size'
  const [activeTab, setActiveTab] = useState('range');

  // --- Tab 1: Range Mode State ---
  const [rangeMode, setRangeMode] = useState('custom'); // 'custom' | 'fixed'
  const [customRanges, setCustomRanges] = useState([
    { from: 1, to: Math.min(5, propPdfPageCount || 5) }
  ]);
  const [fixedRangeSize, setFixedRangeSize] = useState(2);
  const [mergeAllRanges, setMergeAllRanges] = useState(false);

  // --- Tab 2: Pages Mode State ---
  const [pagesMode, setPagesMode] = useState('select'); // 'all' | 'select'
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [lastClickedPage, setLastClickedPage] = useState(null);
  const [mergeExtractedPages, setMergeExtractedPages] = useState(false);

  // --- Tab 3: Size Mode State ---
  const [maxFileSize, setMaxFileSize] = useState(500);
  const [sizeUnit, setSizeUnit] = useState('KB'); // 'KB' | 'MB'
  const [allowCompression, setAllowCompression] = useState(true);

  // 1. Load PDF using pdfjs-dist
  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setLoadingPdf(false);
      return;
    }

    const loadPdf = async () => {
      try {
        setLoadingPdf(true);
        setLoadError(null);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoadingPdf(false);

        if (pdf.numPages > 0) {
          const half = Math.max(1, Math.ceil(pdf.numPages / 2));
          if (pdf.numPages > 5) {
            setCustomRanges([
              { from: 1, to: half },
              { from: half + 1, to: pdf.numPages }
            ]);
          } else {
            setCustomRanges([{ from: 1, to: pdf.numPages }]);
          }

          const allSet = new Set();
          for (let i = 1; i <= pdf.numPages; i++) allSet.add(i);
          setSelectedPages(allSet);
        }
      } catch (err) {
        console.error('Failed to parse PDF for split view:', err);
        if (isMounted) {
          setLoadError('Unable to render PDF page previews. You can still set split options below.');
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => { isMounted = false; };
  }, [file]);

  // 2. Compute payload ranges string and sync to extraParams.ranges
  useEffect(() => {
    if (numPages <= 0) return;

    let computedRanges = '';

    if (activeTab === 'range') {
      if (rangeMode === 'custom') {
        const valid = customRanges.filter(r => r.from > 0 && r.to >= r.from);
        const strList = valid.map(r => r.from === r.to ? `${r.from}` : `${r.from}-${r.to}`);
        computedRanges = strList.join(mergeAllRanges ? ', ' : ' ; ');
      } else {
        const size = Math.max(1, fixedRangeSize);
        const fixedList = [];
        for (let i = 1; i <= numPages; i += size) {
          const end = Math.min(numPages, i + size - 1);
          fixedList.push(i === end ? `${i}` : `${i}-${end}`);
        }
        computedRanges = fixedList.join(mergeAllRanges ? ', ' : ' ; ');
      }
    } else if (activeTab === 'pages') {
      if (pagesMode === 'all') {
        if (mergeExtractedPages) {
          computedRanges = `1-${numPages}`;
        } else {
          const allList = [];
          for (let i = 1; i <= numPages; i++) allList.push(String(i));
          computedRanges = allList.join(' ; ');
        }
      } else {
        const sorted = Array.from(selectedPages).sort((a, b) => a - b);
        if (sorted.length > 0) {
          if (mergeExtractedPages) {
            computedRanges = formatPageRanges(selectedPages);
          } else {
            computedRanges = sorted.join(' ; ');
          }
        } else {
          computedRanges = '1';
        }
      }
    } else if (activeTab === 'size') {
      const totalBytes = file?.size || 1024 * 1024;
      const maxBytes = (sizeUnit === 'MB' ? maxFileSize * 1024 * 1024 : maxFileSize * 1024) || 500 * 1024;
      const bytesPerPage = totalBytes / numPages;
      const pagesPerPart = Math.max(1, Math.floor(maxBytes / bytesPerPage));
      const sizeList = [];
      for (let i = 1; i <= numPages; i += pagesPerPart) {
        const end = Math.min(numPages, i + pagesPerPart - 1);
        sizeList.push(i === end ? `${i}` : `${i}-${end}`);
      }
      computedRanges = sizeList.join(' ; ');
    }

    setExtraParams(prev => ({ ...prev, ranges: computedRanges }));
  }, [
    activeTab, rangeMode, customRanges, fixedRangeSize, mergeAllRanges,
    pagesMode, selectedPages, mergeExtractedPages, maxFileSize, sizeUnit,
    numPages, file?.size
  ]);

  // Range Modification Handlers
  const addCustomRange = () => {
    const last = customRanges[customRanges.length - 1];
    const newFrom = last ? Math.min(numPages, last.to + 1) : 1;
    const newTo = Math.min(numPages, newFrom + 4);
    setCustomRanges([...customRanges, { from: newFrom, to: Math.max(newFrom, newTo) }]);
  };

  const removeCustomRange = (idx) => {
    if (customRanges.length <= 1) return;
    setCustomRanges(customRanges.filter((_, i) => i !== idx));
  };

  const updateCustomRange = (idx, key, val) => {
    const next = customRanges.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, [key]: val };
    });
    setCustomRanges(next);
  };

  // Pages selection handlers
  const togglePageSelect = (pageNum) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(pageNum)) {
      newSet.delete(pageNum);
    } else {
      newSet.add(pageNum);
    }
    setLastClickedPage(pageNum);
    setSelectedPages(newSet);
  };

  const handleCardClick = (e, pageNum) => {
    const newSet = new Set(selectedPages);
    if (e.shiftKey && lastClickedPage !== null) {
      const start = Math.min(lastClickedPage, pageNum);
      const end = Math.max(lastClickedPage, pageNum);
      const shouldSelect = !selectedPages.has(pageNum);
      for (let p = start; p <= end; p++) {
        if (shouldSelect) newSet.add(p);
        else newSet.delete(p);
      }
    } else {
      if (newSet.has(pageNum)) newSet.delete(pageNum);
      else newSet.add(pageNum);
      setLastClickedPage(pageNum);
    }
    setSelectedPages(newSet);
  };

  const selectAllPages = () => {
    const allSet = new Set();
    for (let i = 1; i <= numPages; i++) allSet.add(i);
    setSelectedPages(allSet);
  };

  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  // Calculate output file count summary
  const currentPayloadStr = extraParams.ranges || '';
  const groupCount = currentPayloadStr.split(';').map(s => s.trim()).filter(Boolean).length || 1;
  const isZipOutput = groupCount > 1;

  if (loadingPdf) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className="animate-spin text-red-500" size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Loading PDF for Split View...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Rendering visual range cards and thumbnail grid</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Preview Rendering Warning
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* File Header Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <Scissors size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
              {(file.size / 1024).toFixed(1)} KB • <strong className="text-cyan-400">{numPages} Pages Total</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              Change File
            </button>
          )}
          {onClearFile && (
            <button
              type="button"
              onClick={onClearFile}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Multi-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Visual Canvas Area (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">

          {/* TAB 1: RANGE CANVAS AREA */}
          {activeTab === 'range' && (
            <div className="space-y-4">
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                  <BookOpen size={16} className="text-red-400" />
                  Visual Range Cards ({rangeMode === 'custom' ? customRanges.length : Math.ceil(numPages / fixedRangeSize)} Ranges)
                </span>
                <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono">
                  {mergeAllRanges ? 'Merged into 1 PDF' : 'Separate Output PDFs'}
                </span>
              </div>

              <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                {rangeMode === 'custom' ? (
                  customRanges.map((r, idx) => (
                    <RangeCardVisual
                      key={idx}
                      rangeIndex={idx}
                      fromPage={r.from}
                      toPage={r.to}
                      totalPages={numPages}
                      pdfDoc={pdfDoc}
                      onZoom={(p) => setZoomedPageNum(p)}
                      onRemove={customRanges.length > 1 ? () => removeCustomRange(idx) : null}
                      onFromChange={(val) => updateCustomRange(idx, 'from', val)}
                      onToChange={(val) => updateCustomRange(idx, 'to', val)}
                      isCustomMode={true}
                    />
                  ))
                ) : (
                  Array.from({ length: Math.ceil(numPages / Math.max(1, fixedRangeSize)) }, (_, idx) => {
                    const fromP = idx * fixedRangeSize + 1;
                    const toP = Math.min(numPages, (idx + 1) * fixedRangeSize);
                    return (
                      <RangeCardVisual
                        key={idx}
                        rangeIndex={idx}
                        fromPage={fromP}
                        toPage={toP}
                        totalPages={numPages}
                        pdfDoc={pdfDoc}
                        onZoom={(p) => setZoomedPageNum(p)}
                        isCustomMode={false}
                      />
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PAGES CANVAS AREA */}
          {activeTab === 'pages' && (
            <div className="space-y-4">
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                  <Scissors size={16} className="text-red-400" />
                  {pagesMode === 'all' ? 'All Pages Selected for Extraction' : 'Select Pages for Extraction'}
                </span>

                {pagesMode === 'select' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPages}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-neutral-200 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              {/* Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[580px] overflow-y-auto pr-1 p-1">
                {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                  <SplitPdfThumbnailCard
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    isSelected={pagesMode === 'all' ? true : selectedPages.has(pageNum)}
                    onToggleSelect={pagesMode === 'select' ? togglePageSelect : null}
                    onZoom={(p) => setZoomedPageNum(p)}
                    onCardClick={pagesMode === 'select' ? handleCardClick : null}
                    showCheckmark={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SIZE CANVAS AREA */}
          {activeTab === 'size' && (
            <div className="space-y-4">
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                  <Minimize2 size={16} className="text-red-400" />
                  Split by File Size ({maxFileSize} {sizeUnit})
                </span>
                <span className="text-xs text-slate-600 dark:text-neutral-400 font-mono">
                  Approx. {groupCount} file(s)
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-neutral-900/80 border border-slate-200 dark:border-white/10 space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                  <Minimize2 size={32} />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Split by File Size</h4>
                  <p className="text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
                    This PDF will be divided into estimated chunks of no larger than <strong className="text-slate-900 dark:text-white font-mono">{maxFileSize} {sizeUnit}</strong> each.
                  </p>
                </div>

                <div className="pt-2 flex justify-center">
                  <span className="text-xs font-mono bg-black/50 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-cyan-800 dark:text-cyan-300">
                    Payload ranges: {currentPayloadStr || '1-end'}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Side Panel Controls & Options (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* 3 MODE TABS AT THE TOP OF THE SIDE PANEL */}
          <div className="glass-card-static p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('range')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'range'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
              }`}
            >
              <BookOpen size={14} /> Range
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pages')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'pages'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
              }`}
            >
              <Scissors size={14} /> Pages
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('size')}
              className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'size'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
              }`}
            >
              <Minimize2 size={14} /> Size
            </button>
          </div>

          {/* TAB SPECIFIC SIDE PANEL CONTROLS */}
          <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4">
            {activeTab === 'range' && (
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 block">
                  Range Settings
                </span>

                {/* Custom vs Fixed Selector */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setRangeMode('custom')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rangeMode === 'custom'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    Custom
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeMode('fixed')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rangeMode === 'fixed'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    Fixed
                  </button>
                </div>

                {/* Custom Blocks Controls */}
                {rangeMode === 'custom' ? (
                  <div className="space-y-3">
                    {customRanges.map((r, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-neutral-300">
                          <span className="font-mono text-red-400">Range {idx + 1}</span>
                          {customRanges.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCustomRange(idx)}
                              className="text-slate-600 dark:text-neutral-400 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-600 dark:text-neutral-400">from page</span>
                          <input
                            type="number"
                            min={1}
                            max={numPages}
                            value={r.from}
                            onChange={(e) => updateCustomRange(idx, 'from', parseInt(e.target.value, 10) || 1)}
                            className="w-16 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-slate-900 dark:text-white font-mono focus:outline-none focus:border-red-500"
                          />
                          <span className="text-slate-600 dark:text-neutral-400">to</span>
                          <input
                            type="number"
                            min={r.from}
                            max={numPages}
                            value={r.to}
                            onChange={(e) => updateCustomRange(idx, 'to', parseInt(e.target.value, 10) || r.from)}
                            className="w-16 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-slate-900 dark:text-white font-mono focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addCustomRange}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Plus size={15} /> Add Range
                    </button>
                  </div>
                ) : (
                  /* Fixed Ranges Input */
                  <div className="space-y-2 p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block">
                      Split in page ranges of:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={fixedRangeSize}
                        onChange={(e) => setFixedRangeSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-center text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-red-500"
                      />
                      <span className="text-xs text-slate-600 dark:text-neutral-400 font-semibold">pages per file</span>
                    </div>
                  </div>
                )}

                {/* Checkbox: Merge all ranges in one PDF file */}
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-neutral-300 font-medium pt-1">
                  <input
                    type="checkbox"
                    checked={mergeAllRanges}
                    onChange={(e) => setMergeAllRanges(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-500 bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/20"
                  />
                  <span>Merge all ranges in one PDF file.</span>
                </label>
              </div>
            )}

            {activeTab === 'pages' && (
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 block">
                  Extract Options
                </span>

                {/* Extract all pages vs Select pages */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setPagesMode('all')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pagesMode === 'all'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    Extract all pages
                  </button>
                  <button
                    type="button"
                    onClick={() => setPagesMode('select')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pagesMode === 'select'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    Select pages
                  </button>
                </div>

                {/* Checkbox: Merge extracted pages into one PDF file */}
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-neutral-300 font-medium pt-1">
                  <input
                    type="checkbox"
                    checked={mergeExtractedPages}
                    onChange={(e) => setMergeExtractedPages(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-500 bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/20"
                  />
                  <span>Merge extracted pages into one PDF file.</span>
                </label>

                {/* Guidance Notice */}
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-900 dark:text-cyan-200 text-xs leading-relaxed space-y-1">
                  <div className="font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Zap size={14} /> Guidance Notice
                  </div>
                  <p>
                    {mergeExtractedPages
                      ? `Selected pages will be merged into 1 PDF file.`
                      : `Selected pages will be converted into separate PDF files. ${
                          pagesMode === 'all' ? numPages : selectedPages.size
                        } PDF will be created.`}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'size' && (
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 block">
                  Size Settings
                </span>

                <div className="space-y-2 p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 block">
                    Maximum size per file
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={maxFileSize}
                      onChange={(e) => setMaxFileSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-red-500"
                    />
                    <select
                      value={sizeUnit}
                      onChange={(e) => setSizeUnit(e.target.value)}
                      className="bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-bold focus:outline-none"
                    >
                      <option value="KB">KB</option>
                      <option value="MB">MB</option>
                    </select>
                  </div>
                </div>

                {/* Checkbox: Allow compression */}
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 dark:text-neutral-300 font-medium">
                  <input
                    type="checkbox"
                    checked={allowCompression}
                    onChange={(e) => setAllowCompression(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-500 bg-slate-200/60 dark:bg-white/10 border-slate-300 dark:border-white/20"
                  />
                  <span>Allow compression</span>
                </label>

                {/* Guidance Notice */}
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-900 dark:text-cyan-200 text-xs leading-relaxed space-y-1">
                  <div className="font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Zap size={14} /> Guidance Notice
                  </div>
                  <p>
                    This PDF will be split into files no larger than {maxFileSize} {sizeUnit} each.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SUMMARY CARD & PRIMARY CONVERT BUTTON */}
          <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center justify-between">
              <span>Output Summary</span>
              <span className="font-mono text-cyan-400">{groupCount} {groupCount === 1 ? 'PDF' : 'PDFs'}</span>
            </span>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-700 dark:text-neutral-300">
                <span>Split Mode:</span>
                <span className="font-bold uppercase text-red-400">{activeTab}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-neutral-300">
                <span>Output Format:</span>
                <span className={`font-bold font-mono ${isZipOutput ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isZipOutput ? 'ZIP Archive' : 'PDF Document'}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-neutral-300">
                <span>Payload Ranges:</span>
                <span className="font-mono text-slate-600 dark:text-neutral-400 truncate max-w-[150px]" title={currentPayloadStr}>
                  {currentPayloadStr || '1-end'}
                </span>
              </div>
            </div>

            <button
              disabled={status === 'converting' || (activeTab === 'pages' && pagesMode === 'select' && selectedPages.size === 0)}
              onClick={onConvert}
              className="w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl cursor-pointer bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
            >
              <Scissors size={18} />
              Split PDF ({groupCount} {groupCount === 1 ? 'PDF' : 'PDFs'})
            </button>
          </div>

        </div>
      </div>

      {/* Page Zoom Modal */}
      <PageZoomModal
        isOpen={zoomedPageNum !== null}
        pdfDoc={pdfDoc}
        pageNum={zoomedPageNum}
        totalPages={numPages}
        isSelected={zoomedPageNum ? selectedPages.has(zoomedPageNum) : false}
        onClose={() => setZoomedPageNum(null)}
        onNavigate={(nextPage) => setZoomedPageNum(nextPage)}
        onToggleSelect={togglePageSelect}
        mode="split-pages"
      />
    </div>
  );
}


//  Helper to extract PDF text for semantic comparison 
async function extractPdfText(pdfDoc) {
  const pagesText = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      pagesText.push(text);
    } catch (_) {
      pagesText.push('');
    }
  }
  return pagesText;
}

// Compute semantic text differences (additions & deletions) per page
function computeTextDifferences(pagesText1 = [], pagesText2 = []) {
  const maxPages = Math.max(pagesText1.length, pagesText2.length);
  const changes = [];

  for (let p = 1; p <= maxPages; p++) {
    const text1 = pagesText1[p - 1] || '';
    const text2 = pagesText2[p - 1] || '';

    if (text1 === text2) continue;

    const sentences1 = text1.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    const sentences2 = text2.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);

    const set2 = new Set(sentences2);
    const set1 = new Set(sentences1);

    const deleted = sentences1.filter(s => !set2.has(s));
    const added = sentences2.filter(s => !set1.has(s));

    deleted.forEach((s, idx) => {
      changes.push({
        id: `del_p${p}_${idx}`,
        page: p,
        type: 'deletion',
        text: s
      });
    });

    added.forEach((s, idx) => {
      changes.push({
        id: `add_p${p}_${idx}`,
        page: p,
        type: 'addition',
        text: s
      });
    });
  }

  return changes;
}

// Single Page Canvas Renderer for Compare PDF
function CompareSinglePageCanvas({ pdfDoc, pageNum, zoomScale = 1.0 }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current || !pageNum || pageNum > pdfDoc.numPages) return;

    const renderPage = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.6 * zoomScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering compare page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum, zoomScale]);

  if (!pdfDoc || pageNum > pdfDoc.numPages) {
    return (
      <div className="w-full aspect-[1/1.3] bg-neutral-950/40 border border-dashed border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center text-neutral-600 text-xs font-mono">
        No Page {pageNum}
      </div>
    );
  }

  return (
    <div className="relative w-full bg-neutral-950 rounded-xl p-2 flex items-center justify-center border border-slate-200 dark:border-white/10 overflow-hidden shadow-inner">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-950/80 z-10">
          <Loader2 className="animate-spin text-purple-400" size={24} />
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full h-auto object-contain rounded shadow" />
    </div>
  );
}

// Overlay Visual Diff Canvas Component (Mode 2)
function ContentOverlayCanvas({ pdfDoc1, pdfDoc2, page1, page2, opacity = 50, blendMode = 'difference', zoomScale = 1.0 }) {
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const [loading1, setLoading1] = useState(true);
  const [loading2, setLoading2] = useState(true);
  const renderTask1Ref = useRef(null);
  const renderTask2Ref = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc1 || !canvas1Ref.current || !page1 || page1 > pdfDoc1.numPages) return;

    const renderLayer1 = async () => {
      try {
        setLoading1(true);
        const p1 = await pdfDoc1.getPage(page1);
        if (isCancelled) return;

        const viewport = p1.getViewport({ scale: 0.75 * zoomScale });
        const canvas = canvas1Ref.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTask1Ref.current) {
          try { renderTask1Ref.current.cancel(); } catch (_) {}
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = p1.render(renderContext);
        renderTask1Ref.current = task;
        await task.promise;
        if (!isCancelled) setLoading1(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Error rendering layer 1:', err);
      }
    };

    renderLayer1();
    return () => {
      isCancelled = true;
      if (renderTask1Ref.current) { try { renderTask1Ref.current.cancel(); } catch (_) {} }
    };
  }, [pdfDoc1, page1, zoomScale]);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc2 || !canvas2Ref.current || !page2 || page2 > pdfDoc2.numPages) return;

    const renderLayer2 = async () => {
      try {
        setLoading2(true);
        const p2 = await pdfDoc2.getPage(page2);
        if (isCancelled) return;

        const viewport = p2.getViewport({ scale: 0.75 * zoomScale });
        const canvas = canvas2Ref.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTask2Ref.current) {
          try { renderTask2Ref.current.cancel(); } catch (_) {}
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = p2.render(renderContext);
        renderTask2Ref.current = task;
        await task.promise;
        if (!isCancelled) setLoading2(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') console.error('Error rendering layer 2:', err);
      }
    };

    renderLayer2();
    return () => {
      isCancelled = true;
      if (renderTask2Ref.current) { try { renderTask2Ref.current.cancel(); } catch (_) {} }
    };
  }, [pdfDoc2, page2, zoomScale]);

  return (
    <div className="relative w-full min-h-[500px] bg-neutral-950 rounded-2xl p-4 flex items-center justify-center border border-slate-200 dark:border-white/10 overflow-auto">
      {(loading1 || loading2) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-neutral-950/80 z-30">
          <Loader2 className="animate-spin text-purple-400" size={32} />
          <span className="text-xs text-slate-700 dark:text-neutral-300 font-mono">Rendering visual overlay...</span>
        </div>
      )}
      <div className="relative inline-block border border-slate-300 dark:border-white/20 rounded shadow-2xl bg-white">
        {/* Base Layer: PDF 1 */}
        <canvas ref={canvas1Ref} className="block max-w-full" />

        {/* Overlay Layer: PDF 2 with blend mode & opacity */}
        <canvas
          ref={canvas2Ref}
          className="absolute top-0 left-0 max-w-full pointer-events-none transition-all"
          style={{
            opacity: opacity / 100,
            mixBlendMode: blendMode
          }}
        />
      </div>
    </div>
  );
}

// Custom Options View for PDF to PDF/A (Matching ILovePDF Design)
function PdfToPdfaOptionsView({ extraParams, setExtraParams }) {
  const conformance = extraParams.conformance || 'PDF/A-2b';
  const allowDowngrade = extraParams.allow_downgrade !== false && extraParams.allow_downgrade !== 'false';

  return (
    <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4 font-sans animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-emerald-400" />
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            PDF/A Archival Settings
          </h4>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
          ISO 19005 Standard
        </span>
      </div>

      {/* Conformance level dropdown selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
          PDF/A Conformance Level
        </label>
        <select
          value={conformance}
          onChange={(e) => setExtraParams(prev => ({ ...prev, conformance: e.target.value }))}
          className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
        >
          <option value="PDF/A-2b" className="bg-neutral-900 text-slate-900 dark:text-white">
            PDF/A-2b (Recommended - Modern ISO 19005-2 Standard)
          </option>
          <option value="PDF/A-1b" className="bg-neutral-900 text-slate-900 dark:text-white">
            PDF/A-1b (Legacy Archival - ISO 19005-1 Level B)
          </option>
          <option value="PDF/A-3b" className="bg-neutral-900 text-slate-900 dark:text-white">
            PDF/A-3b (Allows Embedded XML & Source Files)
          </option>
        </select>
      </div>

      {/* Feature highlights list */}
      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
        <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider block">
          Automatic Compliance Features:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>JPEG 2000 image compression</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>OpenType fonts embedding</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>Digital signatures provision</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>Set archiving metadata</span>
          </div>
        </div>
      </div>

      {/* Checkbox for Allow Downgrade of PDF/A Compliance Level */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-neutral-200">
            Allow Downgrade of PDF/A Compliance Level
          </span>
          <span className="text-[11px] text-slate-600 dark:text-neutral-400">
            Automatically fallback to highest achievable PDF/A level if strict validation fails.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
          <input
            type="checkbox"
            checked={allowDowngrade}
            onChange={(e) => setExtraParams(prev => ({ ...prev, allow_downgrade: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-200/60 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* ISO 32000-1 informational callout box */}
      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
        <div className="font-bold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
          <BookOpen size={15} /> ISO 32000-1 Standard Information
        </div>
        <p className="leading-relaxed text-emerald-800 dark:text-emerald-300/90">
          PDF/A guarantees long-term digital preservation based on ISO 32000-1 specifications by embedding all device-independent visual components (fonts, color spaces, and document structures) directly into the file.
        </p>
      </div>
    </div>
  );
}

// Rotate PDF Thumbnail Card Component
function RotatePdfThumbnailCard({ pageNum, pdfDoc, angle, onRotateLeft, onRotateRight, onReset }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const renderThumbnail = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering rotate thumbnail page ${pageNum}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum]);

  const formattedAngle = ((angle % 360) + 360) % 360;

  return (
    <div className="glass-card p-3 rounded-2xl flex flex-col items-center gap-3 border border-slate-200 dark:border-white/10 hover:border-indigo-500/40 transition-all group relative">
      {/* Page header and rotation angle badge */}
      <div className="w-full flex items-center justify-between px-1">
        <span className="text-xs font-mono font-bold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10">
          Page {pageNum}
        </span>
        <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md border transition-all ${
          formattedAngle !== 0
            ? 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 shadow-sm'
            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10'
        }`}>
          {formattedAngle}° {formattedAngle !== 0 ? '↻' : ''}
        </span>
      </div>

      {/* Visual Canvas Container with real-time CSS transform rotation */}
      <div className="relative w-full aspect-[3/4] max-h-[220px] rounded-xl bg-slate-100/90 dark:bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center p-2">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs z-10">
            <Loader2 className="animate-spin text-indigo-400" size={24} />
          </div>
        )}
        <div
          className="transition-transform duration-300 ease-in-out flex items-center justify-center"
          style={{ transform: `rotate(${formattedAngle}deg)` }}
        >
          <canvas ref={canvasRef} className="max-w-full max-h-[190px] object-contain rounded shadow-lg" />
        </div>
      </div>

      {/* Independent per-page rotation control buttons */}
      <div className="flex items-center justify-center gap-1.5 w-full pt-1">
        <button
          type="button"
          onClick={onRotateLeft}
          className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/20 text-slate-700 dark:text-neutral-300 hover:text-indigo-800 dark:text-indigo-300 border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
          title="Rotate 90° Counter-Clockwise ↺"
        >
          <RotateCw size={13} className="-scale-x-100" />
          -90°
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={formattedAngle === 0}
          className="py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Reset to 0°"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={onRotateRight}
          className="flex-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-indigo-500/20 text-slate-700 dark:text-neutral-300 hover:text-indigo-800 dark:text-indigo-300 border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
          title="Rotate 90° Clockwise ↻"
        >
          <RotateCw size={13} />
          +90°
        </button>
      </div>
    </div>
  );
}

// Visual Interactive Rotate PDF Suite View Component
function RotatePdfVisualView({
  file,
  extraParams,
  setExtraParams,
  tool,
  onConvert,
  status,
  onChangeFile,
  onClearFile
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rotations, setRotations] = useState({}); // { [pageNum]: angle }

  // Load PDF with pdfjsLib
  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setLoading(false);
      return;
    }

    const loadPdf = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load PDF for Rotate view:', err);
        if (isMounted) {
          setLoadError('Unable to render PDF page previews for rotation.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => { isMounted = false; };
  }, [file]);

  // Sync rotations map to extraParams.rotations as JSON string
  useEffect(() => {
    if (numPages > 0) {
      const rotationsJson = JSON.stringify(rotations);
      setExtraParams(prev => {
        if (prev.rotations === rotationsJson) return prev;
        return { ...prev, rotations: rotationsJson };
      });
    }
  }, [rotations, numPages, setExtraParams]);

  // Quick Action toolbar handlers
  const handleRotatePage = (pageNum, delta) => {
    setRotations(prev => {
      const current = prev[pageNum] || 0;
      const nextAngle = ((current + delta) % 360 + 360) % 360;
      return { ...prev, [pageNum]: nextAngle };
    });
  };

  const handleResetPage = (pageNum) => {
    setRotations(prev => {
      const next = { ...prev };
      delete next[pageNum];
      return next;
    });
  };

  const handleRotateAll = (delta) => {
    setRotations(prev => {
      const next = {};
      for (let p = 1; p <= numPages; p++) {
        const current = prev[p] || 0;
        next[p] = ((current + delta) % 360 + 360) % 360;
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setRotations({});
  };

  const rotatedPagesCount = Object.values(rotations).filter(a => a % 360 !== 0).length;

  if (loading) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Loading PDF Pages for Rotation...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Rendering visual interactive page thumbnails</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Preview Rendering Warning
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* File & Controls Header Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <RotateCw size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
              {numPages} Pages Total • <strong className="text-indigo-400">{rotatedPagesCount} Pages Rotated</strong>
            </span>
          </div>
        </div>

        {/* Top Toolbar Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleRotateAll(-90)}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-all cursor-pointer flex items-center gap-1.5"
            title="Rotate All Pages Left 90°"
          >
            <RotateCw size={14} className="-scale-x-100" /> Rotate All Left ↺
          </button>
          <button
            type="button"
            onClick={() => handleRotateAll(90)}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-500/40 transition-all cursor-pointer flex items-center gap-1.5"
            title="Rotate All Pages Right 90°"
          >
            <RotateCw size={14} /> Rotate All Right ↻
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={rotatedPagesCount === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
          >
            Reset All 0°
          </button>

          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              Replace PDF
            </button>
          )}
          {onClearFile && (
            <button
              type="button"
              onClick={onClearFile}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Grid of Page Thumbnail Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[580px] overflow-y-auto pr-1 p-1">
        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
          <RotatePdfThumbnailCard
            key={pageNum}
            pageNum={pageNum}
            pdfDoc={pdfDoc}
            angle={rotations[pageNum] || 0}
            onRotateLeft={() => handleRotatePage(pageNum, -90)}
            onRotateRight={() => handleRotatePage(pageNum, 90)}
            onReset={() => handleResetPage(pageNum)}
          />
        ))}
      </div>

      {/* Footer Convert Action Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-neutral-400">
          <Zap size={15} className="text-indigo-400" />
          <span>
            {rotatedPagesCount > 0
              ? `${rotatedPagesCount} page(s) custom rotated.`
              : 'All pages at default 0° rotation.'}
          </span>
        </div>

        <button
          onClick={onConvert}
          disabled={status === 'converting'}
          className="px-6 py-2.5 rounded-xl text-slate-900 dark:text-white font-bold text-sm shadow-lg transition-all duration-300 hover:scale-105 flex items-center gap-2 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}
        >
          {status === 'converting' ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Rotating PDF...
            </>
          ) : (
            <>
              <RotateCw size={16} /> Rotate PDF & Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}

//  Add Watermark Visual View & Interactive Workspace Components 

//  Custom Premium Dark Theme Dropdown Component 
function CustomSelect({ value, onChange, options, className = '', placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const normalizedOptions = (options || []).map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label ?? String(opt.value) };
    }
    return { value: opt, label: String(opt) };
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value)) || normalizedOptions[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full bg-slate-100 dark:bg-neutral-900/80 border border-slate-300 dark:border-white/15 hover:border-purple-500/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between shadow-sm cursor-pointer transition-all duration-200 outline-none select-none"
      >
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-slate-600 dark:text-neutral-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-purple-400' : ''}`}
        />
      </button>

      {/* Dropover Popup Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-neutral-900/95 backdrop-blur-2xl border border-slate-200 dark:border-white/20 rounded-xl shadow-2xl py-1.5 z-[100] max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div
                key={String(opt.value)}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors duration-150 rounded-lg mx-1 my-0.5 ${
                  isSelected
                    ? 'bg-purple-600/30 text-white font-bold'
                    : 'text-neutral-200 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={14} className="text-purple-400 shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

//  Add Watermark Visual View & Interactive Workspace Components 

function AddWatermarkThumbnailCard({
  pageNum,
  pdfDoc,
  position,
  setPosition,
  scale = 100,
  setScale,
  isMosaic,
  mode,
  text,
  textColor,
  fontFamily,
  fontSize,
  isBold,
  isItalic,
  isUnderline,
  watermarkImage,
  transparency,
  rotation,
  fromPage,
  toPage,
}) {
  const canvasRef = useRef(null);
  const thumbnailBoxRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isDraggingBox, setIsDraggingBox] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    if (!pdfDoc || !canvasRef.current) return;

    const renderThumbnail = async () => {
      try {
        setLoading(true);
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch (_) {}
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        if (!isCancelled) setLoading(false);
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering watermark thumbnail page ${pageNum}:`, err);
        }
      }
    };

    renderThumbnail();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum]);

  const isIncluded = pageNum >= Number(fromPage || 1) && pageNum <= Number(toPage || 999999);

  const opacityMap = {
    '100%': 1.0,
    '75%': 0.75,
    '50%': 0.50,
    '25%': 0.25,
  };
  const previewOpacity = opacityMap[transparency] ?? 0.75;

  const rotationMap = {
    '0°': '0deg',
    '45°': '45deg',
    '90°': '90deg',
    '-45°': '-45deg',
  };
  const previewRotation = rotationMap[rotation] ?? '45deg';

  const getDotStyle = (pos) => {
    switch (pos) {
      case 'top-left': return { top: '15%', left: '15%' };
      case 'top-center': return { top: '15%', left: '50%' };
      case 'top-right': return { top: '15%', left: '85%' };
      case 'center-left': return { top: '50%', left: '15%' };
      case 'center-right': return { top: '50%', left: '85%' };
      case 'bottom-left': return { top: '85%', left: '15%' };
      case 'bottom-center': return { top: '85%', left: '50%' };
      case 'bottom-right': return { top: '85%', left: '85%' };
      case 'center':
      default: return { top: '50%', left: '50%' };
    }
  };

  const mosaicGrid = [
    { top: '20%', left: '20%' },
    { top: '20%', left: '50%' },
    { top: '20%', left: '80%' },
    { top: '50%', left: '20%' },
    { top: '50%', left: '50%' },
    { top: '50%', left: '80%' },
    { top: '80%', left: '20%' },
    { top: '80%', left: '50%' },
    { top: '80%', left: '80%' },
  ];

  return (
    <div className={`glass-card p-3 rounded-2xl flex flex-col items-center gap-2 border transition-all relative group overflow-hidden ${
      isIncluded ? 'border-slate-200 dark:border-white/10 hover:border-purple-500/50' : 'border-white/5 opacity-50 bg-slate-100/90 dark:bg-black/40'
    }`}>
      {/* Page Badge */}
      <div className="w-full flex items-center justify-between px-1">
        <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10">
          Page {pageNum}
        </span>
        {!isIncluded && (
          <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
            Excluded
          </span>
        )}
      </div>

      {/* Canvas Box with Interactive Watermark Overlay */}
      <div
        ref={thumbnailBoxRef}
        className="relative w-full aspect-[3/4] bg-neutral-900/80 rounded-xl overflow-hidden flex items-center justify-center border border-white/5 group/canvas"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 z-10">
            <Loader2 className="animate-spin text-purple-400" size={24} />
          </div>
        )}
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none" />

        {/* Floating Quick Scale Controls on Card Hover */}
        {isIncluded && (
          <div className="absolute top-2 right-2 z-30 opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-white dark:bg-neutral-900/90 backdrop-blur-md border border-slate-300 dark:border-white/20 rounded-full px-1.5 py-0.5 shadow-xl pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (setScale) setScale(prev => Math.max(50, prev - 10));
              }}
              className="w-5 h-5 rounded-full bg-slate-200/60 dark:bg-white/10 hover:bg-purple-600 hover:text-white text-neutral-200 flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
              title="Decrease watermark scale (-10%)"
            >
              -
            </button>
            <span className="text-[10px] font-mono font-bold text-purple-800 dark:text-purple-300 px-1">
              {scale}%
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (setScale) setScale(prev => Math.min(300, prev + 10));
              }}
              className="w-5 h-5 rounded-full bg-slate-200/60 dark:bg-white/10 hover:bg-purple-600 hover:text-white text-neutral-200 flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
              title="Increase watermark scale (+10%)"
            >
              +
            </button>
          </div>
        )}

        {/* Live Watermark Red Dot & Micro-Preview Overlay */}
        {isIncluded && (
          <div className="absolute inset-0 z-10 overflow-hidden">
            {isMosaic ? (
              mosaicGrid.map((pos, idx) => (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
                  style={{
                    top: pos.top,
                    left: pos.left,
                    opacity: previewOpacity,
                    transform: `translate(-50%, -50%) scale(${scale / 100})`,
                  }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] border border-white" />
                  <span
                    className="text-[9px] font-bold truncate max-w-[50px] select-none"
                    style={{
                      color: textColor,
                      fontFamily: fontFamily,
                      transform: `rotate(${previewRotation})`,
                      fontWeight: isBold ? 'bold' : 'normal',
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration: isUnderline ? 'underline' : 'none',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {mode === 'text' ? (text || 'WATERMARK') : 'IMG'}
                  </span>
                </div>
              ))
            ) : (
              /* Draggable & Resizable Watermark Box */
              <div
                className={`absolute flex flex-col items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing p-1.5 rounded-xl border-2 transition-all ${
                  isDraggingBox || isResizing
                    ? 'border-purple-400 bg-purple-600/30 shadow-[0_0_20px_rgba(168,85,247,0.6)] z-30 scale-105'
                    : 'border-purple-500/60 hover:border-purple-400 bg-slate-200/80 dark:bg-black/60 shadow-lg hover:shadow-purple-500/20 z-20'
                }`}
                style={{
                  ...getDotStyle(position),
                  opacity: previewOpacity,
                  transform: `translate(-50%, -50%) scale(${scale / 100})`,
                  transformOrigin: 'center center',
                }}
                onMouseDown={(e) => {
                  if (e.target.dataset.handle) return;
                  e.stopPropagation();
                  setIsDraggingBox(true);

                  const handleMouseMove = (moveEvt) => {
                    if (!thumbnailBoxRef.current) return;
                    const rect = thumbnailBoxRef.current.getBoundingClientRect();
                    const relX = (moveEvt.clientX - rect.left) / rect.width;
                    const relY = (moveEvt.clientY - rect.top) / rect.height;

                    let yPos = 'center';
                    if (relY < 0.33) yPos = 'top';
                    else if (relY > 0.66) yPos = 'bottom';

                    let xPos = 'center';
                    if (relX < 0.33) xPos = 'left';
                    else if (relX > 0.66) xPos = 'right';

                    let newPos = 'center';
                    if (yPos === 'center' && xPos === 'center') {
                      newPos = 'center';
                    } else {
                      newPos = `${yPos}-${xPos}`;
                    }

                    if (setPosition) setPosition(newPos);
                  };

                  const handleMouseUp = () => {
                    setIsDraggingBox(false);
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                  };

                  window.addEventListener('mousemove', handleMouseMove);
                  window.addEventListener('mouseup', handleMouseUp);
                }}
              >
                {/* Red Watermark Position Indicator Dot */}
                <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] border-2 border-white animate-pulse" />

                {/* Live Micro Text / Image Preview */}
                {mode === 'text' ? (
                  <span
                    className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/70 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white select-none whitespace-nowrap shadow-lg mt-1"
                    style={{
                      color: textColor,
                      fontFamily: fontFamily,
                      transform: `rotate(${previewRotation})`,
                      fontWeight: isBold ? 'bold' : 'normal',
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration: isUnderline ? 'underline' : 'none',
                    }}
                  >
                    {text || 'CONFIDENTIAL'}
                  </span>
                ) : (
                  <div
                    className="p-1 rounded bg-slate-900/90 dark:bg-black/80 border border-slate-300 dark:border-white/20 shadow-lg flex items-center justify-center mt-1"
                    style={{ transform: `rotate(${previewRotation})` }}
                  >
                    {watermarkImage?.previewUrl ? (
                      <img src={watermarkImage.previewUrl} alt="wm preview" className="w-6 h-6 object-contain rounded" />
                    ) : (
                      <ImageIcon size={14} className="text-purple-400" />
                    )}
                  </div>
                )}

                {/* Interactive Resize Corner Handles */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((handle) => {
                  let handlePosClass = '';
                  let cursorClass = '';
                  if (handle === 'top-left') {
                    handlePosClass = '-top-1.5 -left-1.5';
                    cursorClass = 'cursor-nwse-resize';
                  } else if (handle === 'top-right') {
                    handlePosClass = '-top-1.5 -right-1.5';
                    cursorClass = 'cursor-nesw-resize';
                  } else if (handle === 'bottom-left') {
                    handlePosClass = '-bottom-1.5 -left-1.5';
                    cursorClass = 'cursor-nesw-resize';
                  } else if (handle === 'bottom-right') {
                    handlePosClass = '-bottom-1.5 -right-1.5';
                    cursorClass = 'cursor-nwse-resize';
                  }

                  return (
                    <div
                      key={handle}
                      data-handle={handle}
                      className={`absolute w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-white shadow-md hover:scale-125 transition-transform z-40 ${handlePosClass} ${cursorClass}`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsResizing(true);
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startScale = scale;

                        const handleMouseMove = (moveEvt) => {
                          const dx = moveEvt.clientX - startX;
                          const dy = moveEvt.clientY - startY;
                          let delta = 0;
                          if (handle === 'bottom-right') delta = dx + dy;
                          else if (handle === 'top-right') delta = dx - dy;
                          else if (handle === 'bottom-left') delta = -dx + dy;
                          else if (handle === 'top-left') delta = -dx - dy;

                          const scaleDelta = Math.round(delta * 0.8);
                          const newScale = Math.min(300, Math.max(50, startScale + scaleDelta));
                          if (setScale) setScale(newScale);
                        };

                        const handleMouseUp = () => {
                          setIsResizing(false);
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                        };

                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lock PDF Visual View ──────────────────────────────────────────────────
function LockPdfVisualView({ file, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile }) {
  const [lockMode, setLockMode] = useState('open'); // 'open' | 'permission'
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [pageCount, setPageCount] = useState(null);

  useEffect(() => {
    if (!file) return;
    (async () => {
      try {
        const ab = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
        setPageCount(pdfDoc.getPageCount());
      } catch { setPageCount(null); }
    })();
  }, [file]);

  const handleSelectLockMode = (mode) => {
    setLockMode(mode);
    if (mode === 'permission') {
      setAllowPrint(false);
      setAllowCopy(false);
    } else {
      setAllowPrint(true);
      setAllowCopy(true);
    }
  };

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] || '';
  const strengthColor = ['', '#EF4444', '#F59E0B', '#10B981', '#10B981'][strength] || '';
  const passwordsMatch = confirmPassword !== '' && password === confirmPassword;
  const canSubmit = password.length > 0 && passwordsMatch;

  const handleSubmit = () => {
    const params = {
      password,
      lock_mode: lockMode,
      allow_print: allowPrint ? 'true' : 'false',
      allow_copy: allowCopy ? 'true' : 'false'
    };
    setExtraParams(params);
    onConvert(null, params);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', minHeight: '480px', paddingBottom: '80px' }}>
      {/* Center: PDF Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'rgba(30,30,40,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minHeight: '320px', justifyContent: 'center' }}>
          <div style={{ width: '120px', height: '160px', background: 'rgba(239,68,68,0.06)', border: '2px solid rgba(239,68,68,0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative' }}>
            <FileText size={40} style={{ color: '#EF4444' }} />
            <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: '#EF4444', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(239,68,68,0.5)' }}>
              <Lock size={14} color="#fff" />
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '14px', margin: 0 }}>{file.name}</p>
            <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0' }}>
              {pageCount !== null ? `${pageCount} page${pageCount !== 1 ? 's' : ''} · ` : ''}{(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onChangeFile} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#d1d5db', cursor: 'pointer' }}>
              Change file
            </button>
            <button onClick={onClearFile} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Password Controls */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
        <div style={{ background: 'rgba(30,30,40,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'min(430px, calc(100vh - 380px))', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={15} style={{ color: '#EF4444' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#f3f4f6' }}>Protect PDF</h3>
              <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>256-bit AES Encryption</p>
            </div>
          </div>

          {/* Lock Type Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protection Type</label>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', gap: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setLockMode('open')}
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  borderRadius: '6px',
                  border: 'none',
                  background: lockMode === 'open' ? 'rgba(239,68,68,0.2)' : 'transparent',
                  color: lockMode === 'open' ? '#f87171' : '#9ca3af',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: lockMode === 'open' ? '1px solid rgba(239,68,68,0.4)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                🔒 Strict Lock
              </button>
              <button
                type="button"
                onClick={() => setLockMode('permission')}
                style={{
                  flex: 1,
                  padding: '5px 6px',
                  borderRadius: '6px',
                  border: 'none',
                  background: lockMode === 'permission' ? 'rgba(245,158,11,0.2)' : 'transparent',
                  color: lockMode === 'permission' ? '#fbbf24' : '#9ca3af',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: lockMode === 'permission' ? '1px solid rgba(245,158,11,0.4)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                🛡 Reversible
              </button>
            </div>

            {/* Implication Warning Box */}
            <div style={{ background: lockMode === 'open' ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${lockMode === 'open' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '8px', padding: '7px 9px', fontSize: '10.5px', color: lockMode === 'open' ? '#f87171' : '#fbbf24', lineHeight: 1.35 }}>
              {lockMode === 'open' ? (
                <>⚠ <strong>Strict Open Lock</strong>: Requires password to view. Cannot be unlocked without password.</>
              ) : (
                <>ℹ <strong>Reversible Open Lock</strong>: Requires password to view, BUT can be unlocked anytime via Unlock PDF!</>
              )}
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lockMode === 'open' ? 'Open Password' : 'Permissions Password'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 40px 10px 12px', color: '#f3f4f6', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {password && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '3px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${(strength / 4) * 100}%`, height: '100%', background: strengthColor, transition: 'all 0.3s ease', borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '11px', color: strengthColor, fontWeight: 600, minWidth: '36px' }}>{strengthLabel}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${confirmPassword ? (passwordsMatch ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)') : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', padding: '10px 40px 10px 12px', color: '#f3f4f6', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}>
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPassword && (
              <p style={{ margin: 0, fontSize: '11px', color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          {/* Permissions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Restrictions</label>
            {[
              { label: 'Allow Printing', value: allowPrint, setter: setAllowPrint },
              { label: 'Allow Copying Text', value: allowCopy, setter: setAllowCopy },
            ].map(({ label, value, setter }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <div
                  onClick={() => setter(v => !v)}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#EF4444' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0, boxShadow: value ? '0 0 8px rgba(239,68,68,0.4)' : 'none' }}
                >
                  <div style={{ position: 'absolute', top: '3px', left: value ? '18px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#d1d5db' }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: canSubmit ? (lockMode === 'open' ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'linear-gradient(135deg, #F59E0B, #D97706)') : 'rgba(255,255,255,0.06)', color: canSubmit ? '#fff' : '#4b5563', fontWeight: 700, fontSize: '14px', cursor: canSubmit ? 'pointer' : 'not-allowed', boxShadow: canSubmit ? (lockMode === 'open' ? '0 4px 24px rgba(239,68,68,0.35)' : '0 4px 24px rgba(245,158,11,0.35)') : 'none', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Lock size={16} /> Protect PDF ({lockMode === 'open' ? 'Open Lock' : 'Restriction Lock'})
          </button>
          {!canSubmit && password && !passwordsMatch && (
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>Passwords must match to proceed</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Unlock PDF Visual View ────────────────────────────────────────────────
function UnlockPdfVisualView({ file, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pageCount, setPageCount] = useState(null);
  const [lockStatus, setLockStatus] = useState('checking'); // 'checking' | 'unencrypted' | 'auto_unlockable' | 'requires_password'

  useEffect(() => {
    if (!file) return;
    (async () => {
      setLockStatus('checking');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/convert/check-pdf-lock', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setLockStatus(data.status || 'requires_password');
        } else {
          setLockStatus('requires_password');
        }
      } catch {
        setLockStatus('requires_password');
      }

      try {
        const ab = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
        setPageCount(pdfDoc.getPageCount());
      } catch {
        setPageCount(null);
      }
    })();
  }, [file]);

  const handleSubmit = () => {
    const params = { password };
    setExtraParams(params);
    onConvert(null, params);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', minHeight: '480px', paddingBottom: '80px' }}>
      {/* Center: PDF Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'rgba(30,30,40,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minHeight: '320px', justifyContent: 'center' }}>
          <div style={{ width: '120px', height: '160px', background: lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)', border: `2px solid ${lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.2)'}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative' }}>
            <FileText size={40} style={{ color: lockStatus === 'auto_unlockable' ? '#10b981' : '#F59E0B' }} />
            <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: 'rgba(30,30,40,0.95)', border: `2px solid ${lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.4)'}`, borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lockStatus === 'auto_unlockable' ? <Sparkles size={14} style={{ color: '#10b981' }} /> : <Lock size={13} style={{ color: '#F59E0B' }} />}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '14px', margin: 0 }}>{file.name}</p>
            <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0' }}>
              {pageCount !== null ? `${pageCount} page${pageCount !== 1 ? 's' : ''} · ` : ''}{(file.size / 1024).toFixed(1)} KB
            </p>
            {lockStatus !== 'checking' && (
              <span style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.15)' : lockStatus === 'unencrypted' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: lockStatus === 'auto_unlockable' ? '#34d399' : lockStatus === 'unencrypted' ? '#60a5fa' : '#fbbf24', border: `1px solid ${lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.35)' : lockStatus === 'unencrypted' ? 'rgba(59,130,246,0.35)' : 'rgba(245,158,11,0.35)'}` }}>
                {lockStatus === 'auto_unlockable' && <><Sparkles size={11}/> ⚡ Instant Unlockable (No Password Needed)</>}
                {lockStatus === 'unencrypted' && <><Unlock size={11}/> 🔓 Unrestricted / Unencrypted</>}
                {lockStatus === 'requires_password' && <><Lock size={11}/> 🔒 Open Password Required</>}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onChangeFile} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: '#d1d5db', cursor: 'pointer' }}>
              Change file
            </button>
            <button onClick={onClearFile} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Unlock Controls */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
        <div style={{ background: 'rgba(30,30,40,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'min(430px, calc(100vh - 380px))', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lockStatus === 'auto_unlockable' ? <Sparkles size={15} style={{ color: '#10b981' }} /> : <Unlock size={15} style={{ color: '#F59E0B' }} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#f3f4f6' }}>Unlock PDF</h3>
              <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>Smart Detection Engine</p>
            </div>
          </div>

          {/* Smart Notification Banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.08)' : lockStatus === 'unencrypted' ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.07)', border: `1px solid ${lockStatus === 'auto_unlockable' ? 'rgba(16,185,129,0.25)' : lockStatus === 'unencrypted' ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.18)'}`, borderRadius: '10px', padding: '10px' }}>
            {lockStatus === 'auto_unlockable' ? (
              <>
                <Sparkles size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '11.5px', color: '#34d399', lineHeight: 1.45 }}>
                  ✅ <strong>Instant Unlock Available</strong>: This PDF can be unlocked automatically! No password entry is required.
                </p>
              </>
            ) : lockStatus === 'unencrypted' ? (
              <>
                <Unlock size={15} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '11.5px', color: '#93c5fd', lineHeight: 1.45 }}>
                  ℹ <strong>Unrestricted PDF</strong>: This file has no password lock applied.
                </p>
              </>
            ) : (
              <>
                <ShieldAlert size={15} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '11.5px', color: '#fbbf24', lineHeight: 1.45 }}>
                  🔑 <strong>Open Password Required</strong>: Enter the open password below to decrypt and unlock this PDF.
                </p>
              </>
            )}
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lockStatus === 'auto_unlockable' ? 'Password (Not Required)' : 'Password (If Required)'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={lockStatus === 'auto_unlockable' ? 'No password needed...' : 'Enter password...'}
                disabled={lockStatus === 'unencrypted'}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 36px 8px 10px', color: '#f3f4f6', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 0 }}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '10.5px', color: lockStatus === 'auto_unlockable' ? '#34d399' : '#6b7280' }}>
              {lockStatus === 'auto_unlockable' ? '⚡ Auto-unlock engine ready' : 'Leave blank if restriction-locked.'}
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: lockStatus === 'auto_unlockable' ? 'linear-gradient(135deg, #10B981, #047857)' : 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: lockStatus === 'auto_unlockable' ? '0 4px 20px rgba(16,185,129,0.35)' : '0 4px 20px rgba(245,158,11,0.35)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {lockStatus === 'auto_unlockable' ? <Sparkles size={15} /> : <Unlock size={15} />}
            {lockStatus === 'auto_unlockable' ? 'Instant Unlock PDF' : 'Unlock PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Compress PDF Visual View ──────────────────────────────────────────────
function CompressPdfVisualView({ file, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile }) {
  const [level, setLevel] = useState('recommended'); // 'extreme' | 'recommended' | 'less' | 'custom'
  const [customDpi, setCustomDpi] = useState(120);
  const [customQuality, setCustomQuality] = useState(60);
  const [pageCount, setPageCount] = useState(null);

  useEffect(() => {
    if (!file) return;
    getPdfPageCount(file).then(count => setPageCount(count));
  }, [file]);

  const fmtSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Estimated target size preview calculation
  const targetEstimation = (() => {
    const size = file?.size || 0;
    if (level === 'extreme') return `~${fmtSize(size * 0.35)} – ${fmtSize(size * 0.55)}`;
    if (level === 'less') return `~${fmtSize(size * 0.75)} – ${fmtSize(size * 0.88)}`;
    if (level === 'custom') {
      const factor = (customQuality / 100.0) * (customDpi / 200.0);
      return `~${fmtSize(size * Math.max(0.25, Math.min(0.9, factor)))}`;
    }
    // recommended
    return `~${fmtSize(size * 0.45)} – ${fmtSize(size * 0.65)}`;
  })();

  const handleSubmit = () => {
    const params = {
      compression_level: level,
      dpi: level === 'custom' ? customDpi : 0,
      quality: level === 'custom' ? customQuality : 0,
    };
    setExtraParams(params);
    onConvert(null, params);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', minHeight: '480px', paddingBottom: '80px' }}>
      {/* Center: File Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'rgba(30,30,40,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minHeight: '320px', justifyContent: 'center' }}>
          <div style={{ width: '120px', height: '160px', background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.25)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', position: 'relative' }}>
            <Minimize2 size={40} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f3f4f6', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {file?.name}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>{file?.name}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              {pageCount ? `${pageCount} pages · ` : ''}{fmtSize(file?.size)}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '10px 16px', color: '#34d399', fontSize: '12.5px', fontWeight: 600 }}>
            <Sparkles size={16} />
            Target Size Estimate: {targetEstimation}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={onChangeFile} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#d1d5db', fontSize: '12px', cursor: 'pointer' }}>
              Change file
            </button>
            <button onClick={onClearFile} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Compression Settings */}
      <div style={{ width: '330px', background: 'rgba(20,20,28,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'min(500px, calc(100vh - 350px))', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Minimize2 size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff' }}>Compress PDF</h4>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Choose compression level</p>
          </div>
        </div>

        {/* Compression Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'extreme', title: 'Extreme Compression', desc: 'Maximum size reduction (~60-80% smaller). Best for large Word-converted PDFs.', badge: '🔥 Max Reduction', color: '#EF4444' },
            { id: 'recommended', title: 'Recommended Compression', desc: 'Optimal balance of image quality and PDF size reduction (~40-60% smaller).', badge: '⭐ Recommended', color: '#F59E0B' },
            { id: 'less', title: 'Less Compression', desc: 'Preserves sharp high-resolution images (~15-30% smaller).', badge: '🎨 High Quality', color: '#3B82F6' },
            { id: 'custom', title: 'Custom Quality & DPI', desc: 'Fine-tune image quality percentage and resolution DPI.', badge: '⚙ Custom', color: '#E056FD' }
          ].map(opt => (
            <div
              key={opt.id}
              onClick={() => setLevel(opt.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: level === opt.id ? `2px solid ${opt.color}` : '1px solid rgba(255,255,255,0.08)',
                background: level === opt.id ? `${opt.color}15` : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: level === opt.id ? '#fff' : '#d1d5db' }}>{opt.title}</span>
                <span style={{ fontSize: '9.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: `${opt.color}25`, color: opt.color }}>{opt.badge}</span>
              </div>
              <p style={{ margin: 0, fontSize: '10.5px', color: '#9ca3af', lineHeight: '1.3' }}>{opt.desc}</p>
            </div>
          ))}
        </div>

        {/* Custom Controls */}
        {level === 'custom' && (
          <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#d1d5db', marginBottom: '4px' }}>
                <span>JPEG Quality: <strong>{customQuality}%</strong></span>
              </div>
              <input
                type="range"
                min="15"
                max="95"
                value={customQuality}
                onChange={e => setCustomQuality(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#E056FD', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#d1d5db', marginBottom: '4px' }}>Resolution (DPI)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                {[72, 120, 150, 200].map(dpiVal => (
                  <button
                    key={dpiVal}
                    onClick={() => setCustomDpi(dpiVal)}
                    style={{
                      padding: '4px',
                      borderRadius: '6px',
                      border: customDpi === dpiVal ? '1px solid #E056FD' : '1px solid rgba(255,255,255,0.1)',
                      background: customDpi === dpiVal ? 'rgba(224,86,253,0.2)' : 'rgba(255,255,255,0.04)',
                      color: customDpi === dpiVal ? '#fff' : '#9ca3af',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {dpiVal} DPI
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(245,158,11,0.35)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: 'auto' }}
        >
          <Minimize2 size={15} />
          Compress PDF (Reduce Size)
        </button>
      </div>
    </div>
  );
}

// ─── Redact PDF Visual View ────────────────────────────────────────────────
function RedactPdfVisualView({ file, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [toolMode, setToolMode] = useState('pan'); // 'pan' | 'rect' | 'text'
  const [fillColor, setFillColor] = useState('#000000');
  const [redactionItems, setRedactionItems] = useState([]); // [{page, type, rect?, text?, color}]
  const [searchText, setSearchText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragCurrent, setDragCurrent] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 }); // rendered canvas dims
  const [pdfPageDims, setPdfPageDims] = useState({ width: 612, height: 792 }); // PDF point dims
  const [thumbnails, setThumbnails] = useState([]); // base64 thumbnails per page

  // Keep extraParams.redactions in sync with redactionItems
  useEffect(() => {
    const payload = JSON.stringify({ items: redactionItems });
    setExtraParams(prev => ({ ...prev, redactions: payload }));
  }, [redactionItems, setExtraParams]);

  const mainCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load PDF
  useEffect(() => {
    if (!file) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        if (!mounted) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setLoading(false);

        // Generate thumbnails
        const thumbs = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
          const pg = await pdf.getPage(i);
          const vp = pg.getViewport({ scale: 0.15 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          thumbs.push(canvas.toDataURL('image/png'));
        }
        if (mounted) setThumbnails(thumbs);
      } catch (e) {
        console.error(e);
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [file]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !mainCanvasRef.current) return;
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = mainCanvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = viewport.width;
        overlayCanvasRef.current.height = viewport.height;
      }
      await page.render({ canvasContext: ctx, viewport }).promise;
      setPageDimensions({ width: viewport.width, height: viewport.height });
      const origVp = page.getViewport({ scale: 1 });
      setPdfPageDims({ width: origVp.width, height: origVp.height });
    })();
  }, [pdfDoc, currentPage, zoom]);

  // Draw overlay redaction boxes
  useEffect(() => {
    if (!overlayCanvasRef.current || !pageDimensions.width) return;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = pageDimensions.width / pdfPageDims.width;
    const scaleY = pageDimensions.height / pdfPageDims.height;

    redactionItems.filter(item => item.page === currentPage - 1).forEach((item, idx) => {
      if (item.type === 'rect' && item.rect) {
        const [x0, y0, x1, y1] = item.rect;
        const cx0 = x0 * scaleX;
        const cy0 = y0 * scaleY;
        const cw = (x1 - x0) * scaleX;
        const ch = (y1 - y0) * scaleY;
        ctx.fillStyle = item.color || '#000000';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(cx0, cy0, cw, ch);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(cx0, cy0, cw, ch);
        ctx.setLineDash([]);
      }
    });

    // Draw live drag rect
    if (isDragging && dragStart && dragCurrent && toolMode === 'rect') {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.abs(dragCurrent.x - dragStart.x);
      const h = Math.abs(dragCurrent.y - dragStart.y);
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [redactionItems, currentPage, pageDimensions, pdfPageDims, isDragging, dragStart, dragCurrent, toolMode, fillColor]);

  const getCanvasPos = (e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    if (toolMode === 'pan') {
      e.preventDefault();
      setIsPanning(true);
      if (containerRef.current) {
        setPanStart({
          x: e.clientX,
          y: e.clientY,
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop,
        });
      }
      return;
    }
    if (toolMode !== 'rect') return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    setIsDragging(true);
    setDragStart(pos);
    setDragCurrent(pos);
  };

  const handleMouseMove = (e) => {
    if (isPanning && toolMode === 'pan') {
      if (containerRef.current) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        containerRef.current.scrollLeft = panStart.scrollLeft - dx;
        containerRef.current.scrollTop = panStart.scrollTop - dy;
      }
      return;
    }
    if (!isDragging || toolMode !== 'rect') return;
    setDragCurrent(getCanvasPos(e));
  };

  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (!isDragging || toolMode !== 'rect') return;
    const endPos = getCanvasPos(e);
    const scaleX = pdfPageDims.width / pageDimensions.width;
    const scaleY = pdfPageDims.height / pageDimensions.height;
    const cx0 = Math.min(dragStart.x, endPos.x) * scaleX;
    const cx1 = Math.max(dragStart.x, endPos.x) * scaleX;
    const cy0 = Math.min(dragStart.y, endPos.y) * scaleY;
    const cy1 = Math.max(dragStart.y, endPos.y) * scaleY;

    if (Math.abs(cx1 - cx0) > 5 && Math.abs(cy1 - cy0) > 5) {
      setRedactionItems(prev => [...prev, {
        page: currentPage - 1,
        type: 'rect',
        rect: [cx0, cy0, cx1, cy1],
        color: fillColor,
      }]);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const handleSearchRedact = async () => {
    if (!searchText.trim() || !pdfDoc) return;
    const newItems = [];
    for (let p = 1; p <= numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const fullText = textContent.items.map(i => i.str).join(' ');
      if (fullText.toLowerCase().includes(searchText.toLowerCase())) {
        newItems.push({ page: p - 1, type: 'text', text: searchText.trim(), color: fillColor });
      }
    }
    if (newItems.length > 0) setRedactionItems(prev => [...prev, ...newItems]);
  };

  const itemsOnCurrentPage = redactionItems.filter(i => i.page === currentPage - 1);
  const canSubmit = redactionItems.length > 0;

  const handleSubmit = () => {
    const payload = JSON.stringify({ items: redactionItems });
    setExtraParams({ redactions: payload });
    onConvert(null, { redactions: payload });
  };

  const colorInputRef = useRef(null);

  const updateFillColor = (newColor) => {
    setFillColor(newColor);
    setRedactionItems(prev => prev.map(item => ({ ...item, color: newColor })));
  };

  const PRESET_COLORS = [
    { hex: '#000000', label: 'Black' },
    { hex: '#FFFFFF', label: 'White' },
    { hex: '#DC2626', label: 'Red' },
    { hex: '#2563EB', label: 'Blue' },
    { hex: '#10B981', label: 'Green' },
    { hex: '#F59E0B', label: 'Amber' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px', color: '#9ca3af' }}>
        <Loader2 size={24} className="animate-spin" /> Loading PDF...
      </div>
    );
  }

  return (
    <div className="flex gap-3 w-full min-h-[calc(100vh-220px)] pb-5">
      {/* Left: Page Thumbnails */}
      <div className="w-28 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-240px)] bg-slate-100 dark:bg-neutral-900 border-r border-slate-200 dark:border-white/10 p-3 space-y-3 rounded-2xl shrink-0">
        {Array.from({ length: numPages }, (_, i) => i + 1).map(p => {
          const count = redactionItems.filter(ri => ri.page === p - 1).length;
          return (
            <div
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                p === currentPage ? 'border-red-600 shadow-sm' : 'border-slate-300 dark:border-white/10'
              }`}
            >
              {thumbnails[p - 1] ? (
                <img src={thumbnails[p - 1]} alt={`Page ${p}`} className="w-full block" />
              ) : (
                <div className="bg-slate-200/50 dark:bg-white/5 h-32 flex items-center justify-center text-slate-500 dark:text-neutral-400 text-xs">P{p}</div>
              )}
              <div className="flex items-center justify-center bg-slate-200 dark:bg-neutral-800 text-slate-800 dark:text-white font-bold text-[10px] px-2 py-0.5 rounded-md text-center">
                P {p}
              </div>
              {count > 0 && (
                <div className="absolute top-1 right-1 bg-red-600 text-white rounded-full text-[9px] font-bold px-1.5 py-0.5 min-w-[16px] text-center shadow-sm">
                  {count}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Center: Canvas Workspace */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Toolbar */}
        <div className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-md flex-wrap">
          {[
            { mode: 'pan', icon: <MousePointer size={14} />, label: 'Pan' },
            { mode: 'rect', icon: <Square size={14} />, label: 'Redact Area' },
          ].map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => setToolMode(mode)}
              title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                toolMode === mode
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {icon} {label}
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Color selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-neutral-300">Fill:</span>
            {PRESET_COLORS.map(c => (
              <button
                key={c.hex}
                title={c.label}
                onClick={() => updateFillColor(c.hex)}
                className={`w-5 h-5 rounded-md border cursor-pointer transition-transform ${
                  fillColor.toUpperCase() === c.hex.toUpperCase() ? 'scale-110 border-red-500 ring-2 ring-red-500/30' : 'border-slate-300 dark:border-white/20'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}

            {/* Custom Color Picker */}
            <div className="relative flex items-center gap-1.5 ml-1">
              <button
                onClick={() => colorInputRef.current?.click()}
                title="Pick Custom Color"
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-neutral-300 text-xs cursor-pointer"
              >
                <Palette size={12} style={{ color: fillColor }} />
                <div
                  className="w-3.5 h-3.5 rounded border border-black/20 dark:border-white/40 shadow-sm"
                  style={{ backgroundColor: fillColor }}
                />
              </button>

              <input
                ref={colorInputRef}
                type="color"
                value={fillColor.startsWith('#') && fillColor.length === 7 ? fillColor : '#000000'}
                onChange={e => updateFillColor(e.target.value)}
                className="opacity-0 w-0 h-0 absolute pointer-events-none"
              />

              <input
                type="text"
                value={fillColor.toUpperCase()}
                onChange={e => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    updateFillColor(val);
                  }
                }}
                placeholder="#000000"
                className="w-16 bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-lg px-1.5 py-0.5 text-slate-900 dark:text-white text-[10px] font-mono text-center outline-none"
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-xs text-slate-700 dark:text-neutral-300 font-semibold min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/60 flex items-start justify-center min-h-[calc(100vh-310px)] relative p-4">
          <div className="relative inline-block shadow-lg rounded-lg overflow-hidden">
            <canvas ref={mainCanvasRef} className="block" />
            <canvas
              ref={overlayCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{ position: 'absolute', top: 0, left: 0, cursor: toolMode === 'rect' ? 'crosshair' : isPanning ? 'grabbing' : 'grab', zIndex: 10 }}
            />
          </div>
        </div>

        {/* Page Nav */}
        <div className="flex items-center justify-center gap-3 py-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl p-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
            Page {currentPage} of {numPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl p-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 flex flex-col shrink-0">
        <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-lg space-y-4 flex flex-col flex-1 max-h-[min(480px,calc(100vh-360px))] overflow-hidden">
          <h3 className="text-slate-900 dark:text-white font-extrabold text-base flex items-center gap-2">
            <EyeOff size={18} className="text-red-600" />
            Redact PDF
          </h3>

          {/* Search Redact */}
          <div className="space-y-1.5">
            <label className="text-slate-700 dark:text-neutral-300 font-extrabold text-xs tracking-wider block">
              SEARCH & REDACT
            </label>
            <div className="flex gap-2">
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchRedact()}
                placeholder="Search text..."
                className="flex-1 bg-slate-50 dark:bg-black/60 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-red-500/50 transition-colors min-w-0"
              />
              <button
                onClick={handleSearchRedact}
                disabled={!searchText.trim()}
                className="px-3 py-2.5 rounded-xl border-0 bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-40 disabled:hover:bg-red-600/10 cursor-pointer disabled:cursor-not-allowed transition-colors"
                title="Mark All Matches"
              >
                <Search size={14} />
              </button>
            </div>
          </div>

          {/* Redaction List */}
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
            <div className="flex items-center justify-between">
              <label className="text-slate-700 dark:text-neutral-300 font-extrabold text-xs tracking-wider">
                MARKED ({redactionItems.length})
              </label>
              {redactionItems.length > 0 && (
                <button
                  onClick={() => setRedactionItems([])}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline bg-none border-0 cursor-pointer p-0"
                >
                  Clear All
                </button>
              )}
            </div>
            {redactionItems.length === 0 ? (
              <div className="text-center py-6">
                <Square size={24} className="mx-auto mb-2 text-slate-400 dark:text-neutral-500 opacity-40 block" />
                <p className="text-slate-600 dark:text-neutral-400 text-xs font-normal">
                  Drag on the PDF to mark areas for redaction, or use search above.
                </p>
              </div>
            ) : (
              redactionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-500/20 rounded-xl p-2.5"
                >
                  <input
                    type="color"
                    value={item.color || fillColor}
                    onChange={e => {
                      const c = e.target.value;
                      setRedactionItems(prev => prev.map((it, i) => i === idx ? { ...it, color: c } : it));
                    }}
                    className="w-4 h-4 rounded border border-black/20 dark:border-white/40 cursor-pointer p-0 shrink-0"
                    title="Change color for this mark"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-neutral-200 m-0">
                      Page {item.page + 1}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate m-0">
                      {item.type === 'text' ? `"${item.text}"` : `Box [${item.rect?.map(v => Math.round(v)).join(', ')}]`}
                    </p>
                  </div>
                  <button
                    onClick={() => setRedactionItems(prev => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Warning */}
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300 text-xs p-3.5 rounded-xl font-medium">
            ⚠ Redactions permanently destroy underlying text &amp; image data. This cannot be undone.
          </div>

          {/* Action Button INSIDE CARD */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold shadow-lg shadow-red-600/30 py-3.5 rounded-xl cursor-pointer disabled:cursor-not-allowed transition-all mt-auto"
          >
            <EyeOff size={15} /> Redact PDF{canSubmit ? ` (${redactionItems.length} mark${redactionItems.length !== 1 ? 's' : ''})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddWatermarkVisualView({
  file,
  files,
  setFiles,
  extraParams,
  setExtraParams,
  tool,
  onConvert,
  status,
  onChangeFile,
  onClearFile,
  triggerAddFile,
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Watermark Options State
  const [mode, setMode] = useState('text'); // 'text' | 'image'
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState('36pt');
  const [scale, setScale] = useState(100);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textColor, setTextColor] = useState('#ef4444');

  const [watermarkImage, setWatermarkImage] = useState(null);
  const imageInputRef = useRef(null);

  const [position, setPosition] = useState('center'); // 3x3 position
  const [isMosaic, setIsMosaic] = useState(false);

  const [transparency, setTransparency] = useState('100%');
  const [rotation, setRotation] = useState('45°');

  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);

  const [layer, setLayer] = useState('over'); // 'over' | 'below'

  // Load PDF with pdfjsLib
  useEffect(() => {
    let isMounted = true;
    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setLoading(false);
      return;
    }

    const loadPdf = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setFromPage(1);
        setToPage(pdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load PDF for Watermark view:', err);
        if (isMounted) {
          setLoadError('Unable to render PDF page previews for watermark placement.');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => { isMounted = false; };
  }, [file]);

  // Sync state to extraParams
  useEffect(() => {
    const opacityVal = (parseFloat(transparency) || 100) / 100.0;
    const rotationVal = parseInt((rotation || '0').toString().replace('°', ''), 10) || 0;
    const fontSzVal = parseInt((fontSize || '36').toString().replace('pt', ''), 10) || 36;
    const scaleVal = (parseFloat(scale) || 100) / 100.0;

    setExtraParams(prev => ({
      ...prev,
      watermark_type: mode,
      watermark_mode: mode,
      text: mode === 'text' ? text : (watermarkImage?.name || 'WATERMARK'),
      image_file: mode === 'image' ? watermarkImage?.file : null,
      font_family: fontFamily,
      font_size: fontSzVal,
      scale: scaleVal,
      bold: isBold,
      italic: isItalic,
      is_bold: isBold ? 'true' : 'false',
      is_italic: isItalic ? 'true' : 'false',
      is_underline: isUnderline ? 'true' : 'false',
      color: textColor,
      text_color: textColor,
      position: position,
      is_mosaic: isMosaic ? 'true' : 'false',
      opacity: opacityVal,
      transparency: transparency,
      rotation: rotationVal,
      from_page: fromPage,
      to_page: toPage,
      layer: layer,
    }));
  }, [
    mode, text, watermarkImage, fontFamily, fontSize, scale, isBold, isItalic, isUnderline, textColor,
    position, isMosaic, transparency, rotation, fromPage, toPage, layer, setExtraParams
  ]);

  const handleImageUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    const previewUrl = URL.createObjectURL(uploadedFile);
    setWatermarkImage({
      file: uploadedFile,
      previewUrl,
      name: uploadedFile.name,
      size: (uploadedFile.size / 1024).toFixed(1) + ' KB',
    });
  };

  const removeImage = () => {
    if (watermarkImage?.previewUrl) {
      URL.revokeObjectURL(watermarkImage.previewUrl);
    }
    setWatermarkImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const positionsGrid = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-center', label: 'Top Center' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'center-left', label: 'Center Left' },
    { id: 'center', label: 'Center' },
    { id: 'center-right', label: 'Center Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-center', label: 'Bottom Center' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ];

  const presetColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#000000', '#ffffff'];

  if (loading) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className="animate-spin text-purple-400" size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Loading PDF Pages for Watermark...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Rendering visual interactive page thumbnails</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Preview Rendering Warning
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT CANVAS AREA */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Document Toolbar Header */}
          <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Droplets size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-xs font-mono text-slate-600 dark:text-neutral-400">
                  {numPages} Pages Total • <strong className="text-purple-400">Watermark Workspace</strong>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerAddFile || onChangeFile}
                className="flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-800 dark:text-purple-300 border border-purple-500/40 cursor-pointer"
              >
                <Plus size={14} /> Add more files
              </button>
              {onChangeFile && (
                <button
                  type="button"
                  onClick={onChangeFile}
                  className="flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-white/10 cursor-pointer"
                >
                  <Upload size={13} /> Change file
                </button>
              )}
              {onClearFile && (
                <button
                  type="button"
                  onClick={onClearFile}
                  className="flex items-center gap-1.5 text-xs font-bold transition-all px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                >
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Page Thumbnails Grid with Live Red Dot Indicator */}
          <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-neutral-400">
              <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Eye size={14} className="text-purple-400" /> Visual Page Preview (Interactive Drag & Resize)
              </span>
              <span className="font-mono text-[11px] text-purple-800 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {isMosaic ? 'Mosaic Pattern Grid' : `Position: ${position} • Scale: ${scale}%`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <AddWatermarkThumbnailCard
                  key={pageNum}
                  pageNum={pageNum}
                  pdfDoc={pdfDoc}
                  position={position}
                  setPosition={setPosition}
                  scale={scale}
                  setScale={setScale}
                  isMosaic={isMosaic}
                  mode={mode}
                  text={text}
                  textColor={textColor}
                  fontFamily={fontFamily}
                  fontSize={fontSize}
                  isBold={isBold}
                  isItalic={isItalic}
                  isUnderline={isUnderline}
                  watermarkImage={watermarkImage}
                  transparency={transparency}
                  rotation={rotation}
                  fromPage={fromPage}
                  toPage={toPage}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE PANEL: WATERMARK OPTIONS */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5 sticky top-4 pb-20">
          <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4 max-h-[min(480px,calc(100vh-380px))] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
              <Droplets className="text-purple-400" size={20} />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Watermark options</h3>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100/90 dark:bg-black/40 p-1 rounded-xl border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'text'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                }`}
              >
                <Type size={14} /> Place text
              </button>
              <button
                type="button"
                onClick={() => setMode('image')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'image'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                }`}
              >
                <ImageIcon size={14} /> Place image
              </button>
            </div>

            {/* TEXT MODE CONTROLS */}
            {mode === 'text' && (
              <div className="space-y-4 animate-fade-in">
                {/* Text input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Text:</label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL"
                    className="w-full bg-slate-100/90 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none transition-all font-semibold"
                  />
                </div>

                {/* Text Format Bar */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 font-sans">Format:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Font Family CustomSelect */}
                    <CustomSelect
                      value={fontFamily}
                      onChange={(val) => setFontFamily(val)}
                      options={[
                        { value: 'Arial', label: 'Arial' },
                        { value: 'Helvetica', label: 'Helvetica' },
                        { value: 'Times', label: 'Times New Roman' },
                        { value: 'Courier', label: 'Courier' },
                        { value: 'Impact', label: 'Impact' },
                      ]}
                    />

                    {/* Font Size CustomSelect */}
                    <CustomSelect
                      value={fontSize}
                      onChange={(val) => setFontSize(val)}
                      options={[
                        { value: '12pt', label: '12pt' },
                        { value: '18pt', label: '18pt' },
                        { value: '24pt', label: '24pt' },
                        { value: '36pt', label: '36pt' },
                        { value: '48pt', label: '48pt' },
                        { value: '72pt', label: '72pt' },
                      ]}
                    />
                  </div>

                  {/* Formatting Toggles & Color Picker */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsBold(!isBold)}
                      className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${
                        isBold ? 'bg-purple-500/30 border-purple-500 text-purple-800 dark:text-purple-300' : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-neutral-200 font-bold hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                      }`}
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsItalic(!isItalic)}
                      className={`w-8 h-8 rounded-lg italic font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${
                        isItalic ? 'bg-purple-500/30 border-purple-500 text-purple-800 dark:text-purple-300' : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-neutral-200 font-bold hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                      }`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUnderline(!isUnderline)}
                      className={`w-8 h-8 rounded-lg underline font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${
                        isUnderline ? 'bg-purple-500/30 border-purple-500 text-purple-800 dark:text-purple-300' : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-neutral-200 font-bold hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                      }`}
                      title="Underline"
                    >
                      U
                    </button>

                    {/* Color Swatches */}
                    <div className="flex items-center gap-1 ml-auto">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTextColor(color)}
                          className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                            textColor === color ? 'scale-125 border-white shadow-md' : 'border-slate-300 dark:border-white/20 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                        title="Custom Color"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* IMAGE MODE CONTROLS */}
            {mode === 'image' && (
              <div className="space-y-3 animate-fade-in">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Image file:</label>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept=".png,.jpg,.jpeg,.svg"
                  className="hidden"
                />

                {!watermarkImage ? (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-purple-500/40 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 text-purple-800 dark:text-purple-300 font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus size={20} />
                    <span>ADD IMAGE</span>
                    <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400">PNG, JPG, SVG</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {watermarkImage.previewUrl ? (
                        <img src={watermarkImage.previewUrl} alt="preview" className="w-10 h-10 object-contain rounded-lg bg-neutral-900 border border-slate-200 dark:border-white/10" />
                      ) : (
                        <ImageIcon size={24} className="text-purple-400" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={watermarkImage.name}>
                          {watermarkImage.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400">{watermarkImage.size}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* WATERMARK SIZE / SCALE CONTROLS */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Watermark Size / Scale:</label>
                <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {scale}%
                </span>
              </div>

              {/* Preset Scale Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { label: '50%', val: 50 },
                  { label: '75%', val: 75 },
                  { label: '100%', val: 100 },
                  { label: '125%', val: 125 },
                  { label: '150%', val: 150 },
                  { label: '200%', val: 200 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setScale(preset.val)}
                    className={`py-1.5 px-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer text-center ${
                      scale === preset.val
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-500/30'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 text-slate-800 dark:text-neutral-200 font-bold hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Step Buttons & Slider */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScale(prev => Math.max(50, prev - 10))}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:bg-purple-500/30 hover:border-purple-500 text-slate-900 dark:text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Decrease scale by 10%"
                >
                  -
                </button>
                <input
                  type="range"
                  min="50"
                  max="300"
                  step="5"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setScale(prev => Math.min(300, prev + 10))}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 hover:bg-purple-500/30 hover:border-purple-500 text-slate-900 dark:text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Increase scale by 10%"
                >
                  +
                </button>
              </div>

              {/* CustomSelect Dropdown for Scale */}
              <div className="pt-1">
                <CustomSelect
                  value={`${scale}%`}
                  onChange={(val) => {
                    const numericVal = parseInt(String(val).replace('%', ''), 10);
                    if (!isNaN(numericVal)) setScale(numericVal);
                  }}
                  options={[
                    { value: '50%', label: '50% (Small)' },
                    { value: '75%', label: '75% (Medium-Small)' },
                    { value: '100%', label: '100% (Default)' },
                    { value: '125%', label: '125% (Medium-Large)' },
                    { value: '150%', label: '150% (Large)' },
                    { value: '200%', label: '200% (Extra Large)' },
                    { value: '250%', label: '250% (Huge)' },
                    { value: '300%', label: '300% (Maximum)' },
                  ]}
                />
              </div>
            </div>

            {/* POSITION GRID SELECTOR & MOSAIC TOGGLE */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Position Grid Selector:</label>
                <span className="text-[10px] font-mono text-purple-400 capitalize">{isMosaic ? 'Mosaic' : position.replace('-', ' ')}</span>
              </div>

              {/* 3x3 Position Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-100/90 dark:bg-black/40 p-2 rounded-xl border border-slate-200 dark:border-white/10">
                {positionsGrid.map((pos) => {
                  const isActive = !isMosaic && position === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => { setPosition(pos.id); setIsMosaic(false); }}
                      className={`h-10 rounded-lg border transition-all flex items-center justify-center cursor-pointer relative group ${
                        isActive
                          ? 'bg-purple-600/40 border-purple-500 text-white shadow-md shadow-purple-500/30'
                          : 'bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-neutral-200 font-bold'
                      }`}
                      title={pos.label}
                    >
                      {/* Mini visual position dot inside grid button */}
                      <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] border border-white' : 'bg-neutral-500 group-hover:bg-neutral-300'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Mosaic Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isMosaic}
                  onChange={(e) => setIsMosaic(e.target.checked)}
                  className="rounded border-slate-300 dark:border-white/20 bg-slate-100/90 dark:bg-black/40 text-purple-500 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-neutral-200">
                  Mosaic (Repeat watermark across entire page)
                </span>
              </label>
            </div>

            {/* TRANSPARENCY & ROTATION CONTROLS */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Transparency:</label>
                <CustomSelect
                  value={transparency}
                  onChange={(val) => setTransparency(val)}
                  options={[
                    { value: '100%', label: 'No transparency (100%)' },
                    { value: '75%', label: '75% opacity' },
                    { value: '50%', label: '50% opacity' },
                    { value: '25%', label: '25% opacity' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Rotation:</label>
                <CustomSelect
                  value={rotation}
                  onChange={(val) => setRotation(val)}
                  options={[
                    { value: '0°', label: 'Do not rotate (0°)' },
                    { value: '45°', label: '45° diagonal' },
                    { value: '90°', label: '90° vertical' },
                    { value: '-45°', label: '-45° counter-diagonal' },
                  ]}
                />
              </div>
            </div>

            {/* PAGES RANGE SCOPE */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
              <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Pages Range Scope:</label>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-neutral-300 font-mono">
                <span>From page</span>
                <input
                  type="number"
                  min="1"
                  max={numPages}
                  value={fromPage}
                  onChange={(e) => setFromPage(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-slate-100/90 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none font-bold"
                />
                <span>to</span>
                <input
                  type="number"
                  min="1"
                  max={numPages}
                  value={toPage}
                  onChange={(e) => setToPage(Math.min(numPages, Math.max(1, parseInt(e.target.value) || numPages)))}
                  className="w-16 bg-slate-100/90 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none font-bold"
                />
              </div>
            </div>

            {/* LAYER OPTION CARDS */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <label className="text-xs font-bold text-slate-700 dark:text-neutral-300">Layer Option:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLayer('over')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    layer === 'over'
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <span className="text-xs font-bold">Over PDF content</span>
                  <span className="text-[10px] text-slate-600 dark:text-neutral-400">On top layer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayer('below')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    layer === 'below'
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white'
                  }`}
                >
                  <span className="text-xs font-bold">Below PDF content</span>
                  <span className="text-[10px] text-slate-600 dark:text-neutral-400">Behind PDF layer</span>
                </button>
              </div>
            </div>

            {/* PRIMARY ACTION BUTTON */}
            <button
              type="button"
              onClick={onConvert}
              disabled={status === 'converting' || (mode === 'image' && !watermarkImage)}
              className="w-full py-3.5 px-6 rounded-xl text-slate-900 dark:text-white font-bold text-sm shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)'
              }}
            >
              {status === 'converting' ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Adding Watermark...
                </>
              ) : (
                <>
                  <Droplets size={18} /> Add watermark
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Interactive ILovePDF-Style Dual-Mode Compare PDF Suite Component
function ComparePdfView({
  files, setFiles, extraParams, setExtraParams, tool, onConvert, status, onChangeFile, onClearFile
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [doc1, setDoc1] = useState(null);
  const [doc2, setDoc2] = useState(null);
  const [changes, setChanges] = useState([]);

  const [activeMode, setActiveMode] = useState('semantic'); // 'semantic' | 'overlay'
  const [scrollSync, setScrollSync] = useState(true);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState('');

  // Overlay mode states
  const [selectedPage1, setSelectedPage1] = useState(1);
  const [selectedPage2, setSelectedPage2] = useState(1);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [overlayBlendMode, setOverlayBlendMode] = useState('difference');

  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);

  // Load both PDF files and extract text
  useEffect(() => {
    let isMounted = true;
    if (!files || files.length < 2) return;

    const loadPdfs = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const f1 = files[0];
        const f2 = files[1];

        const [ab1, ab2] = await Promise.all([f1.arrayBuffer(), f2.arrayBuffer()]);
        const [pdf1, pdf2] = await Promise.all([
          pdfjsLib.getDocument({ data: ab1 }).promise,
          pdfjsLib.getDocument({ data: ab2 }).promise
        ]);

        const [text1, text2] = await Promise.all([
          extractPdfText(pdf1),
          extractPdfText(pdf2)
        ]);

        if (!isMounted) return;

        const parsedDoc1 = { file: f1, pdfDoc: pdf1, numPages: pdf1.numPages, name: f1.name, size: f1.size, pagesText: text1 };
        const parsedDoc2 = { file: f2, pdfDoc: pdf2, numPages: pdf2.numPages, name: f2.name, size: f2.size, pagesText: text2 };

        setDoc1(parsedDoc1);
        setDoc2(parsedDoc2);

        const diffs = computeTextDifferences(text1, text2);
        setChanges(diffs);
        setLoading(false);
      } catch (err) {
        console.error('Failed to parse PDF files for comparison:', err);
        if (isMounted) {
          setLoadError('Failed to parse PDF documents for side-by-side comparison.');
          setLoading(false);
        }
      }
    };

    loadPdfs();
    return () => { isMounted = false; };
  }, [files]);

  // Synchronized Vertical Scroll Handlers
  const handleLeftScroll = () => {
    if (!scrollSync || isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      const leftEl = leftScrollRef.current;
      const rightEl = rightScrollRef.current;
      const pct = leftEl.scrollTop / Math.max(1, leftEl.scrollHeight - leftEl.clientHeight);
      rightEl.scrollTop = pct * (rightEl.scrollHeight - rightEl.clientHeight);
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  };

  const handleRightScroll = () => {
    if (!scrollSync || isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      const leftEl = leftScrollRef.current;
      const rightEl = rightScrollRef.current;
      const pct = rightEl.scrollTop / Math.max(1, rightEl.scrollHeight - rightEl.clientHeight);
      leftEl.scrollTop = pct * (leftEl.scrollHeight - leftEl.clientHeight);
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  };

  // Scroll both views to specific page number when clicking a change card
  const scrollToPage = (pageNum) => {
    const leftTarget = document.getElementById(`left-compare-page-${pageNum}`);
    const rightTarget = document.getElementById(`right-compare-page-${pageNum}`);

    if (leftTarget) leftTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (rightTarget) rightTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Filtered change cards by search query
  const filteredChanges = changes.filter(c =>
    !searchQuery.trim() || c.text.toLowerCase().includes(searchQuery.toLowerCase()) || `page ${c.page}`.includes(searchQuery.toLowerCase())
  );

  const maxPagesCount = Math.max(doc1?.numPages || 0, doc2?.numPages || 0);

  if (loading) {
    return (
      <div className="glass-card-static p-12 flex flex-col items-center justify-center gap-4 text-center rounded-3xl min-h-[350px]">
        <Loader2 className="animate-spin text-purple-400" size={40} />
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">Comparing Documents...</h4>
          <p className="text-xs text-slate-600 dark:text-neutral-400">Extracting text & analyzing visual layout differences</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm space-y-2">
        <div className="font-bold flex items-center gap-2">
          <AlertCircle size={18} /> Comparison Error
        </div>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans animate-fade-in">
      {/* File Header Bar */}
      <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <GitCompare size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 font-bold truncate max-w-[200px]" title={doc1.name}>
                Left: {doc1.name} ({doc1.numPages} pgs)
              </span>
              <span className="text-slate-500 dark:text-neutral-500 font-bold">vs</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-bold truncate max-w-[200px]" title={doc2.name}>
                Right: {doc2.name} ({doc2.numPages} pgs)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              Change Files
            </button>
          )}
          {onClearFile && (
            <button
              type="button"
              onClick={onClearFile}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Suite Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER COLUMN: Main Comparison Canvas Workspace (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Control Toolbar (Scroll Sync, Document Labels, Zoom) */}
          <div className="glass-card-static p-3 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            {/* Scroll Sync Toggle Button */}
            <button
              type="button"
              onClick={() => setScrollSync(!scrollSync)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                scrollSync
                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
              }`}
            >
              <Zap size={14} className={scrollSync ? 'text-purple-400' : 'text-slate-500 dark:text-neutral-500'} />
              <span>Scroll Sync: <strong className={scrollSync ? 'text-purple-800 dark:text-purple-300' : 'text-slate-600 dark:text-neutral-400'}>{scrollSync ? 'ON' : 'OFF'}</strong></span>
            </button>

            {/* Document Labels indicator */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono font-semibold">
              <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 truncate max-w-[140px]">
                Left: {doc1.name}
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 truncate max-w-[140px]">
                Right: {doc2.name}
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setZoomScale(z => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-neutral-300 px-2 min-w-[45px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale(z => Math.min(2.0, z + 0.2))}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(1.0)}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
                title="Reset Zoom"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Mode 1: [ Semantic Text ] Dual Column Comparison Workspace */}
          {activeMode === 'semantic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column View: PDF 1 (Deletions in Red) */}
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    PDF 1: {doc1.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                    {doc1.numPages} Pages
                  </span>
                </div>

                {/* Left Scroll Container */}
                <div
                  ref={leftScrollRef}
                  onScroll={handleLeftScroll}
                  className="space-y-6 max-h-[600px] overflow-y-auto pr-1 p-1"
                >
                  {Array.from({ length: maxPagesCount }, (_, i) => i + 1).map(pageNum => {
                    const pageText = doc1.pagesText[pageNum - 1] || '';
                    const pageDeletions = changes.filter(c => c.page === pageNum && c.type === 'deletion');

                    return (
                      <div
                        key={pageNum}
                        id={`left-compare-page-${pageNum}`}
                        className="space-y-2 p-3 rounded-xl bg-neutral-900/60 border border-slate-200 dark:border-white/10 hover:border-red-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-neutral-400 pb-1 border-b border-white/5">
                          <span>Page {pageNum}</span>
                          {pageDeletions.length > 0 && (
                            <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold">
                              {pageDeletions.length} Deletion{pageDeletions.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* PDF Page Canvas */}
                        <CompareSinglePageCanvas
                          pdfDoc={doc1.pdfDoc}
                          pageNum={pageNum}
                          zoomScale={zoomScale}
                        />

                        {/* Deletion Highlights */}
                        {pageDeletions.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                              Deleted Text Highlights:
                            </span>
                            {pageDeletions.map(del => (
                              <div
                                key={del.id}
                                className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-900 dark:text-red-200 text-xs font-mono leading-relaxed break-words shadow-sm"
                              >
                                - Deleted: "{del.text}"
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column View: PDF 2 (Additions in Green) */}
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    PDF 2: {doc2.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                    {doc2.numPages} Pages
                  </span>
                </div>

                {/* Right Scroll Container */}
                <div
                  ref={rightScrollRef}
                  onScroll={handleRightScroll}
                  className="space-y-6 max-h-[600px] overflow-y-auto pr-1 p-1"
                >
                  {Array.from({ length: maxPagesCount }, (_, i) => i + 1).map(pageNum => {
                    const pageText = doc2.pagesText[pageNum - 1] || '';
                    const pageAdditions = changes.filter(c => c.page === pageNum && c.type === 'addition');

                    return (
                      <div
                        key={pageNum}
                        id={`right-compare-page-${pageNum}`}
                        className="space-y-2 p-3 rounded-xl bg-neutral-900/60 border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-neutral-400 pb-1 border-b border-white/5">
                          <span>Page {pageNum}</span>
                          {pageAdditions.length > 0 && (
                            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                              {pageAdditions.length} Addition{pageAdditions.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* PDF Page Canvas */}
                        <CompareSinglePageCanvas
                          pdfDoc={doc2.pdfDoc}
                          pageNum={pageNum}
                          zoomScale={zoomScale}
                        />

                        {/* Addition Highlights */}
                        {pageAdditions.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                              Added Text Highlights:
                            </span>
                            {pageAdditions.map(add => (
                              <div
                                key={add.id}
                                className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs font-mono leading-relaxed break-words shadow-sm"
                              >
                                + Added: "{add.text}"
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: [ Content Overlay ] Visual Diff Overlay Workspace */}
          {activeMode === 'overlay' && (
            <div className="space-y-4">
              <ContentOverlayCanvas
                pdfDoc1={doc1.pdfDoc}
                pdfDoc2={doc2.pdfDoc}
                page1={selectedPage1}
                page2={selectedPage2}
                opacity={overlayOpacity}
                blendMode={overlayBlendMode}
                zoomScale={zoomScale}
              />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Mode Switcher, Guidance & Controls Side Panel (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="glass-card-static p-2 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveMode('semantic')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'semantic'
                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
              }`}
            >
              <Type size={14} /> Semantic Text
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('overlay')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                activeMode === 'overlay'
                  ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10 hover:text-white'
              }`}
            >
              <Eye size={14} /> Content Overlay
            </button>
          </div>

          {/* Guidance Notice */}
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 space-y-2 text-xs shadow-lg">
            <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300 text-sm">
              <Zap size={16} className="text-purple-400" /> Comparison Guidance
            </div>
            <p className="leading-relaxed text-purple-900/90 dark:text-purple-200/90">
              {activeMode === 'semantic'
                ? "Compare text changes between two PDFs. Click any change card below to scroll both views directly to that page."
                : "Visual overlay mode highlights layout shifts, font changes, and repositioned graphics between pages."}
            </p>
          </div>

          {/* Controls for Mode 1: [ Semantic Text ] */}
          {activeMode === 'semantic' && (
            <>
              {/* Search text Input Box */}
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-neutral-300 flex items-center justify-between">
                  <span>Search text changes</span>
                  <span className="text-[10px] text-slate-500 dark:text-neutral-500 font-mono">Real-time filter</span>
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search additions, deletions..."
                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Change Report Summary & List Cards */}
              <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                    <FileText size={15} className="text-purple-400" /> Change Report ({filteredChanges.length})
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400">
                    {changes.filter(c => c.type === 'addition').length} + / {changes.filter(c => c.type === 'deletion').length} -
                  </span>
                </div>

                {filteredChanges.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-500 rounded-xl bg-slate-100 dark:bg-white/5 border border-white/5">
                    {changes.length === 0 ? 'No text differences detected between these PDFs.' : 'No matching changes found for search query.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {filteredChanges.map(change => (
                      <div
                        key={change.id}
                        onClick={() => scrollToPage(change.page)}
                        className={`
                          p-3 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.01] space-y-1.5
                          ${change.type === 'addition'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200 hover:bg-red-500/20'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-neutral-300">
                            Page {change.page}
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            change.type === 'addition'
                              ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-800 dark:text-red-300 border-red-500/40'
                          }`}>
                            {change.type === 'addition' ? 'Addition' : 'Deletion'}
                          </span>
                        </div>
                        <p className="font-mono text-xs leading-relaxed break-words">
                          {change.type === 'addition' ? `+ Added: "${change.text}"` : `- Deleted: "${change.text}"`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Controls for Mode 2: [ Content Overlay ] */}
          {activeMode === 'overlay' && (
            <div className="glass-card-static p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-neutral-300 flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-purple-400" /> Visual Overlay Controls
              </span>

              {/* Page selector for PDF 1 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-red-800 dark:text-red-300 flex items-center justify-between">
                  <span>PDF 1 Page ({doc1.name})</span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-neutral-500">Page {selectedPage1} of {doc1.numPages}</span>
                </label>
                <select
                  value={selectedPage1}
                  onChange={(e) => setSelectedPage1(parseInt(e.target.value, 10))}
                  className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                >
                  {Array.from({ length: doc1.numPages }, (_, i) => i + 1).map(p => (
                    <option key={p} value={p} className="bg-neutral-900 text-slate-900 dark:text-white">
                      {doc1.name} - Page {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Page selector for PDF 2 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>PDF 2 Page ({doc2.name})</span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-neutral-500">Page {selectedPage2} of {doc2.numPages}</span>
                </label>
                <select
                  value={selectedPage2}
                  onChange={(e) => setSelectedPage2(parseInt(e.target.value, 10))}
                  className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                >
                  {Array.from({ length: doc2.numPages }, (_, i) => i + 1).map(p => (
                    <option key={p} value={p} className="bg-neutral-900 text-slate-900 dark:text-white">
                      {doc2.name} - Page {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opacity Slider */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300 font-sans">Opacity</label>
                  <span className="font-mono text-xs text-purple-800 dark:text-purple-300 font-bold">{overlayOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* Blend Mode Selector */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-white/10">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">Blend Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverlayBlendMode('difference')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      overlayBlendMode === 'difference'
                        ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10'
                    }`}
                  >
                    Difference (Invert Diff)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverlayBlendMode('normal')}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      overlayBlendMode === 'normal'
                        ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-500/40'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-white/10 hover:bg-slate-200/60 dark:bg-white/10'
                    }`}
                  >
                    Normal Alpha Overlay
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Button: Download Report */}
          <button
            disabled={status === 'converting'}
            onClick={onConvert}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl cursor-pointer bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
          >
            {status === 'converting' ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Generating Comparison Report...
              </>
            ) : (
              <>
                <Download size={18} /> Download Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


//  File Drop Zone & Upload Progress Component 

function FileDropZone({
  tool, files, setFiles, pdfPageCount = null, onConvert, onCancelUpload, onAdjustSettings, onReturnToResult, status, error,
  resultBlob, resultInfo, elapsedTime, progressMsg, uploadMetrics, extraParams = {}, setExtraParams = () => {},
  onDismissError, focusedFeature = null
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const selectModeRef = useRef('append');

  const triggerAddFile = useCallback(() => {
    selectModeRef.current = 'append';
    fileInputRef.current?.click();
  }, []);

  const triggerChangeFile = useCallback(() => {
    selectModeRef.current = 'replace';
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (tool.multiple) {
      setFiles(prev => [...prev, ...dropped]);
    } else {
      setFiles(dropped.slice(0, 1));
    }
  }, [tool, setFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    if (selectModeRef.current === 'replace') {
      setFiles(selected.slice(0, tool.multiple ? undefined : 1));
    } else {
      if (tool.multiple) {
        setFiles(prev => [...prev, ...selected]);
      } else {
        setFiles(selected.slice(0, 1));
      }
    }
    e.target.value = '';
  }, [tool, setFiles]);

  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, [setFiles]);

  const moveFile = useCallback((fromIndex, toIndex) => {
    setFiles(prev => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  }, [setFiles]);

  const formatSize = (bytes) => {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultBlob.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [resultBlob]);

  const allRequiredParamsFilled = !tool.params || tool.params
    .filter(p => p.required)
    .every(p => (extraParams[p.key] ?? p.default ?? '').toString().trim() !== '');
  const isProcessing = status === 'converting' || status === 'uploading' || status === 'processing';
  const canConvert = files.length >= (tool.minFiles || 1) && !isProcessing && allRequiredParamsFilled;
  const totalFilesSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const ActionIcon = tool.icon || ArrowLeftRight;
  const actionText = tool.actionLabel || tool.title;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <input
        ref={fileInputRef}
        type="file"
        accept={tool.accept}
        multiple={tool.multiple}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start justify-between gap-3 text-red-400 animate-fade-in shadow-lg">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-400" />
            <div className="text-sm font-medium leading-relaxed break-words">
              {typeof error === 'object' ? (error?.detail || error?.message || JSON.stringify(error)) : String(error)}
            </div>
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-800 dark:text-red-300 transition-colors shrink-0 cursor-pointer"
              title="Dismiss error"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Previous Result Banner (If user returned to options/file adjustment page) */}
      {resultBlob && status !== 'done' && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Previous Conversion Ready</div>
              <div className="text-[11px] text-emerald-400/80 font-mono">
                {resultBlob.filename} ({formatSize(resultBlob.blob.size)})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Download size={14} /> Download File
            </button>
            {onReturnToResult && (
              <button
                type="button"
                onClick={onReturnToResult}
                className="px-3.5 py-1.5 rounded-xl bg-slate-200/60 dark:bg-white/10 hover:bg-white/20 text-slate-900 dark:text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition-all cursor-pointer"
              >
                <ArrowLeft className="rotate-180" size={14} /> Back to Download Screen
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 1: Drop Zone (No files selected yet) */}
      {files.length === 0 && status !== 'done' && !isProcessing && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            glass-card p-10 flex flex-col items-center justify-center text-center cursor-pointer
            transition-all duration-300 min-h-[280px] rounded-3xl border-2 border-dashed
            ${isDragOver ? 'scale-[1.01]' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:border-white/20'}
          `}
          style={{
            borderColor: isDragOver ? tool.color : undefined,
            background: isDragOver ? `${tool.colorLight}` : undefined
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 shadow-lg"
            style={{
              background: tool.colorLight,
              border: `1.5px solid ${tool.color}40`,
              transform: isDragOver ? 'scale(1.1)' : 'scale(1)',
              boxShadow: `0 0 25px ${tool.color}20`
            }}
          >
            <Upload size={28} style={{ color: tool.color }} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {isDragOver ? 'Drop files here' : `Select ${tool.acceptLabel} file${tool.multiple ? 's' : ''}`}
          </h3>
          <p className="text-xs text-slate-600 dark:text-neutral-400 mb-5">or drag and drop {tool.multiple ? 'files' : 'a file'} here</p>
          <button
            className="py-2.5 px-7 rounded-xl font-bold text-xs tracking-wide uppercase transition-all duration-300 hover:scale-105 shadow-md cursor-pointer"
            style={{ background: tool.color, color: '#fff', boxShadow: `0 4px 20px ${tool.color}40` }}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            Browse Files
          </button>
          <p className="text-[10px] text-slate-500 dark:text-neutral-500 mt-4 font-mono">
            Accepts: {tool.acceptLabel} {tool.minFiles ? `(min ${tool.minFiles} files)` : ''}
          </p>
        </div>
      )}

      {/* State 2: Selected Files Panel (Files selected, ready to run) */}
      {files.length > 0 && status !== 'done' && !isProcessing && (
        tool.id === 'split-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <SplitPdfVisualView
            file={files[0]}
            pdfPageCount={pdfPageCount}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'organize-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <OrganizePdfVisualView
            files={files}
            setFiles={setFiles}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
            focusedFeature={focusedFeature}
          />
        ) : tool.id === 'rotate-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <RotatePdfVisualView
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'add-watermark' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <AddWatermarkVisualView
            file={files[0]}
            files={files}
            setFiles={setFiles}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
            triggerAddFile={triggerAddFile}
          />
        ) : (tool.id === 'remove-pages' || tool.id === 'extract-pages') && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <RemovePagesVisualGrid
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'compare-pdf' && files.length >= 2 && files.every(f => f.name?.toLowerCase().endsWith('.pdf')) ? (
          <ComparePdfView
            files={files}
            setFiles={setFiles}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'compress-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <CompressPdfVisualView
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'lock-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <LockPdfVisualView
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'unlock-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <UnlockPdfVisualView
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : tool.id === 'redact-pdf' && files[0]?.name?.toLowerCase().endsWith('.pdf') ? (
          <RedactPdfVisualView
            file={files[0]}
            extraParams={extraParams}
            setExtraParams={setExtraParams}
            tool={tool}
            onConvert={onConvert}
            status={status}
            onChangeFile={triggerChangeFile}
            onClearFile={() => setFiles([])}
          />
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Selected File Cards */}
            <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400 flex items-center gap-2">
                  <FileText size={14} style={{ color: tool.color }} />
                  {files.length} file{files.length > 1 ? 's' : ''} selected ({formatSize(totalFilesSize)})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={triggerAddFile}
                    className="flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 border border-slate-200 dark:border-white/10 cursor-pointer text-neutral-200"
                    style={{ color: tool.color }}
                    title="Add more files to the document list"
                  >
                    <Plus size={14} /> Add file
                  </button>
                  <button
                    type="button"
                    onClick={triggerChangeFile}
                    className="flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 border border-slate-200 dark:border-white/10 cursor-pointer text-slate-700 dark:text-neutral-300"
                    title="Replace selected file"
                  >
                    <Upload size={13} /> Change file
                  </button>
                  <button
                    onClick={() => setFiles([])}
                    className="flex items-center gap-1.5 text-xs font-bold transition-all px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                    title="Remove selected file(s)"
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                </div>
              </div>

              <div className={`grid gap-3 max-h-[280px] overflow-y-auto pr-1 ${tool.multiple ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 glass-inner flex items-center justify-between gap-3 group hover:border-slate-300 dark:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {tool.multiple ? (
                        <span className="text-[11px] font-bold text-slate-600 dark:text-neutral-400 min-w-[24px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center shrink-0 font-mono">
                          #{i + 1}
                        </span>
                      ) : (
                        <GripVertical size={14} className="text-neutral-600 shrink-0" />
                      )}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: tool.colorLight, border: `1px solid ${tool.color}30` }}
                      >
                        <FileText size={18} style={{ color: tool.color }} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-slate-900 dark:text-white font-semibold truncate" title={f.name}>
                          {f.name}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-neutral-400 font-mono mt-0.5 flex items-center gap-1.5">
                          {formatSize(f.size)}
                          {pdfPageCount && f.name.toLowerCase().endsWith('.pdf') && (
                            <span className="text-cyan-400 font-bold font-mono">
                              • {pdfPageCount} {pdfPageCount === 1 ? 'Page' : 'Pages'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {tool.multiple && (
                        <>
                          <button
                            onClick={() => moveFile(i, i - 1)}
                            disabled={i === 0}
                            className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white disabled:opacity-25 disabled:hover:text-slate-600 dark:text-neutral-400 disabled:cursor-not-allowed transition-colors p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10"
                            title="Move Up"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            onClick={() => moveFile(i, i + 1)}
                            disabled={i === files.length - 1}
                            className="text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white disabled:opacity-25 disabled:hover:text-slate-600 dark:text-neutral-400 disabled:cursor-not-allowed transition-colors p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10"
                            title="Move Down"
                          >
                            <ChevronDown size={15} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => removeFile(i)}
                        className="text-slate-500 dark:text-neutral-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-200/60 dark:bg-white/10"
                        title="Remove file"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options Panel (If tool has parameters) */}
            {tool.params && tool.params.length > 0 && (
              tool.id === 'pdf-to-pdfa' ? (
                <PdfToPdfaOptionsView extraParams={extraParams} setExtraParams={setExtraParams} />
              ) : (
                <div className="glass-card-static p-5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-neutral-400 flex items-center gap-2">
                    <SlidersHorizontal size={14} style={{ color: tool.color }} /> Tool Options
                  </span>
                  <div className={`grid gap-4 ${tool.id === 'split-pdf' ? 'grid-cols-1' : tool.params.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {tool.params.map(param => {
                      const currentVal = extraParams[param.key] ?? param.default ?? '';

                      if (tool.id === 'split-pdf' && param.key === 'ranges') {
                        return (
                          <div key={param.key} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">{param.label}</label>
                            </div>
                            <MultiSegmentBuilder
                              value={String(currentVal)}
                              onChange={(newVal) => setExtraParams(prev => ({ ...prev, [param.key]: newVal }))}
                              pdfPageCount={pdfPageCount}
                            />
                            {param.hint && <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-relaxed">{param.hint}</p>}
                          </div>
                        );
                      }

                      return (
                        <div key={param.key} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-700 dark:text-neutral-300">{param.label}</label>
                            {param.type === 'range' && (
                              <span className="text-xs font-bold text-emerald-400 font-mono">
                                {currentVal}%
                              </span>
                            )}
                          </div>

                          {param.type === 'select' ? (
                            <select
                              value={currentVal}
                              onChange={e => setExtraParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                              className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-white/30 transition-colors outline-none"
                            >
                              {(param.options || []).map(opt => {
                                const optVal = typeof opt === 'object' && opt !== null ? opt.value : opt;
                                const optLabel = typeof opt === 'object' && opt !== null ? opt.label : opt;
                                return (
                                  <option key={String(optVal)} value={optVal} className="bg-neutral-900 text-slate-900 dark:text-white">
                                    {String(optLabel)}
                                  </option>
                                );
                              })}
                            </select>
                          ) : param.type === 'range' ? (
                            <input
                              type="range"
                              min={param.min ?? 10}
                              max={param.max ?? 100}
                              value={currentVal}
                              onChange={e => setExtraParams(prev => ({ ...prev, [param.key]: Number(e.target.value) }))}
                              className="w-full accent-emerald-500 bg-slate-200/60 dark:bg-white/10 h-2 rounded-lg cursor-pointer my-1"
                            />
                          ) : (
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              placeholder={param.placeholder || ''}
                              value={currentVal}
                              onChange={e => setExtraParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                              className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-neutral-600 focus:outline-none focus:border-white/30 transition-colors outline-none"
                            />
                          )}
                          {param.hint && <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-relaxed">{param.hint}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}

            {/* Primary Action Button & Return to Output Button */}
            <div className="flex flex-col gap-2.5">
              <button
                disabled={!canConvert}
                onClick={onConvert}
                className="w-full py-4 px-8 rounded-2xl font-black text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl cursor-pointer"
                style={{
                  background: canConvert ? tool.color : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  boxShadow: canConvert ? `0 10px 30px ${tool.color}40` : 'none'
                }}
              >
                <ActionIcon size={18} />
                {actionText}
              </button>

              {resultBlob && onReturnToResult && (
                <button
                  type="button"
                  onClick={onReturnToResult}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold text-xs tracking-wider transition-all duration-300 flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-white/10 cursor-pointer shadow-md hover:scale-[1.005]"
                >
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Return to Download Screen ({resultBlob.filename})
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* State 3: Live Upload & Processing Progress */}
      {isProcessing && (() => {
        const displayPercent = uploadMetrics.isUploading
          ? uploadMetrics.percent
          : Math.min(95, Math.max(10, Math.floor(elapsedTime * 6)));

        return (
          <div className="glass-card-static p-6 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] rounded-2xl relative overflow-hidden animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {uploadMetrics.isUploading ? 'Uploading file...' : (progressMsg || 'Processing document...')}
                </span>
              </div>
              <span className="text-xl font-extrabold font-mono text-cyan-400">
                {displayPercent}%
              </span>
            </div>

            <div className="h-3 w-full bg-neutral-800/80 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${displayPercent}%`,
                  background: `linear-gradient(90deg, ${tool.color} 0%, #00d285 100%)`,
                  boxShadow: `0 0 16px ${tool.color}80`
                }}
              />
            </div>

            {uploadMetrics.isUploading && uploadMetrics.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-600 dark:text-neutral-400 pt-1">
                <span>
                  {formatSize(uploadMetrics.loaded)} / {formatSize(uploadMetrics.total)}
                </span>
                <span>Speed: {formatSpeed(uploadMetrics.speed)}</span>
                <span>ETA: {uploadMetrics.eta > 0 ? `${uploadMetrics.eta}s` : 'calculating...'}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 text-xs text-slate-600 dark:text-neutral-400">
              <span>Time elapsed: <strong className="text-slate-900 dark:text-white font-mono">{elapsedTime}s</strong></span>
              {onCancelUpload && (
                <button
                  onClick={onCancelUpload}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Ban size={13} /> Cancel
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Success + Download View */}
      {status === 'done' && resultBlob && (
        <div className="glass-card p-8 flex flex-col items-center text-center animate-fade-in-up">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}
          >
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Conversion Complete!</h3>
          {resultInfo && (
            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-1">{resultInfo}</p>
          )}
          <p className="text-sm text-slate-500 dark:text-neutral-500 mb-6">{resultBlob.filename}  {formatSize(resultBlob.blob.size)}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleDownload}
              className="py-3.5 px-8 rounded-xl font-bold text-sm md:text-base transition-all duration-300 flex items-center gap-2.5 hover:scale-105 shadow-lg cursor-pointer"
              style={{ background: tool.color, color: '#fff', boxShadow: `0 8px 30px ${tool.color}40` }}
            >
              <Download size={18} />
              Download File
            </button>

            {onAdjustSettings && (
              <button
                onClick={onAdjustSettings}
                className="py-3.5 px-6 rounded-xl font-bold text-sm md:text-base transition-all duration-300 flex items-center gap-2 hover:scale-105 bg-slate-200/60 dark:bg-white/10 hover:bg-white/15 text-slate-900 dark:text-white border border-white/15 cursor-pointer shadow-lg"
              >
                <SlidersHorizontal size={18} />
                {tool.id === 'split-pdf'
                  ? 'Split Another Range'
                  : tool.params && tool.params.length > 0
                  ? 'Adjust Options'
                  : 'Adjust Document / Options'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


//  Persistent Floating Tasks Drawer 
function BackgroundTasksDrawer({
  bgJobs = [],
  onDownloadJob,
  onOpenJobTask,
  onCancelOrDismissJob,
  onClearCompleted,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!bgJobs || bgJobs.length === 0) return null;

  const processingJobs = bgJobs.filter(j => j.status === 'uploading' || j.status === 'processing');
  const readyJobs = bgJobs.filter(j => j.status === 'done');
  const failedJobs = bgJobs.filter(j => j.status === 'error');

  const processingCount = processingJobs.length;
  const readyCount = readyJobs.length;
  const failedCount = failedJobs.length;

  const formatSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] pointer-events-auto font-sans">
      {/* Collapsed Pill Badge */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-white dark:bg-neutral-900/90 backdrop-blur-xl border border-slate-300 dark:border-white/15 shadow-2xl rounded-full px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:border-slate-400 dark:hover:border-white/30 transition-all duration-300 hover:scale-105 group"
          id="bg-tasks-drawer-pill"
        >
          {processingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Loader2 size={14} className="animate-spin text-amber-600 dark:text-amber-400" />
              ⚡ {processingCount} Processing
            </span>
          )}

          {readyCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              ✅ {readyCount} Ready
            </span>
          )}

          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
              {failedCount} Failed
            </span>
          )}

          <ChevronUp size={16} className="text-slate-600 dark:text-neutral-400 group-hover:text-slate-900 dark:text-white transition-colors" />
        </button>
      )}

      {/* Expanded Drawer View */}
      {isExpanded && (
        <div className="bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl border border-slate-200 dark:border-white/15 shadow-2xl rounded-2xl p-4 w-full flex flex-col gap-3 max-h-[75vh] animate-fade-in-up">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-cyan-500 dark:text-cyan-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Background Tasks ({bgJobs.length})
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {(readyCount > 0 || failedCount > 0) && (
                <button
                  onClick={onClearCompleted}
                  className="text-[11px] font-medium text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white transition-colors cursor-pointer mr-1"
                >
                  Clear Completed
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:text-white transition-colors cursor-pointer"
                title="Collapse Drawer"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Job List Container */}
          <div className="overflow-y-auto pr-1 space-y-2.5 max-h-[55vh] custom-scrollbar">
            {bgJobs.map((job) => {
              const tool = TOOLS.find(t => t.id === job.toolId) || {};
              const ToolIcon = tool.icon || FileText;

              return (
                <div
                  key={job.id}
                  className="bg-white/[0.03] hover:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex flex-col gap-2.5 transition-all"
                >
                  {/* Row 1: Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: job.toolColor ? `${job.toolColor}20` : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${job.toolColor || '#ffffff'}40`,
                        }}
                      >
                        <ToolIcon size={16} style={{ color: job.toolColor || '#ffffff' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs text-slate-900 dark:text-white truncate max-w-[170px] sm:max-w-[210px]">
                          {job.fileName}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-neutral-400 truncate">
                          {job.toolTitle}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {job.status === 'uploading' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" />
                          Uploading {job.uploadMetrics?.percent || 0}%
                        </span>
                      )}
                      {job.status === 'processing' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" />
                          Processing
                        </span>
                      )}
                      {job.status === 'done' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          Ready
                        </span>
                      )}
                      {job.status === 'error' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle size={11} />
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Progress & Details */}
                  <div className="space-y-1">
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden">
                      {job.status === 'uploading' && (
                        <div
                          className="h-full bg-blue-500 transition-all duration-200"
                          style={{ width: `${job.uploadMetrics?.percent || 0}%` }}
                        />
                      )}
                      {job.status === 'processing' && (
                        <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 animate-pulse w-full" />
                      )}
                      {job.status === 'done' && (
                        <div className="h-full bg-emerald-500 w-full" />
                      )}
                      {job.status === 'error' && (
                        <div className="h-full bg-rose-500 w-full" />
                      )}
                    </div>

                    {/* Progress Metrics & Info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-neutral-400 font-mono pt-0.5">
                      {job.status === 'uploading' && (
                        <>
                          <span>
                            {formatSize(job.uploadMetrics?.loaded)} / {formatSize(job.uploadMetrics?.total)}
                          </span>
                          <span>
                            {formatSpeed(job.uploadMetrics?.speed)} • {job.uploadMetrics?.eta || 0}s left
                          </span>
                        </>
                      )}
                      {job.status === 'processing' && (
                        <>
                          <span>{job.progressMsg || 'Converting...'}</span>
                          <span>Elapsed: {job.elapsedTime}s</span>
                        </>
                      )}
                      {job.status === 'done' && (
                        <>
                          <span className="text-emerald-400 font-semibold truncate max-w-[200px]">
                            {job.resultInfo || job.resultFilename || 'Conversion finished'}
                          </span>
                          <span>Completed in {job.elapsedTime}s</span>
                        </>
                      )}
                      {job.status === 'error' && (
                        <span className="text-rose-400 truncate max-w-[280px]">
                          {job.error || 'Conversion failed'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Action Buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    {job.status === 'done' && (
                      <button
                        onClick={() => onDownloadJob(job)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Download size={13} />
                        Download
                      </button>
                    )}

                    <button
                      onClick={() => onOpenJobTask(job)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200/60 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-white/15 border border-white/15 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye size={13} />
                      Open Task
                    </button>

                    <button
                      onClick={() => onCancelOrDismissJob(job.id)}
                      className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer ml-auto flex items-center gap-1"
                      title={job.status === 'uploading' || job.status === 'processing' ? 'Cancel Task' : 'Dismiss Task'}
                    >
                      <X size={13} />
                      {job.status === 'uploading' || job.status === 'processing' ? 'Cancel' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


//  Main Converter View 
const ConverterView = forwardRef(function ConverterView(_props, ref) {
  //  State 
  const [selectedTool, setSelectedTool] = useState(null);
  const [focusedFeature, setFocusedFeature] = useState(null);
  const [files, setFiles] = useState([]);
  const [extraParams, setExtraParams] = useState({});
  const [pdfPageCount, setPdfPageCount] = useState(null);

  // Global Background Jobs Registry
  const [bgJobs, setBgJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const jobControllersRef = useRef(new Map());

  // Imperative handle so App.jsx can call converterRef.current.selectTool(toolId)
  useImperativeHandle(ref, () => ({
    selectTool: (toolId) => {
      const found = TOOLS.find(t => t.id === toolId);
      if (found) {
        setSelectedTool(found);
        setFiles([]);
        setActiveJobId(null);
      }
    }
  }));

  const updateJob = useCallback((id, patch) => {
    setBgJobs(prevJobs => prevJobs.map(job => {
      if (job.id !== id) return job;
      const updated = typeof patch === 'function' ? patch(job) : { ...job, ...patch };
      return updated;
    }));
  }, []);

  const handleToolSelect = useCallback((tool) => {
    if (tool && tool.id === 'add-page-numbers') {
      const organizeTool = TOOLS.find(t => t.id === 'organize-pdf');
      setSelectedTool(organizeTool || tool);
      setExtraParams(prev => ({ ...prev, add_page_numbers: true }));
      setFocusedFeature('page-numbers');
    } else {
      setFocusedFeature(null);
      setSelectedTool(tool);
    }
    setFiles([]);
    setActiveJobId(null);
  }, []);

  useEffect(() => {
    if (files.length > 0 && files[0]?.name?.toLowerCase().endsWith('.pdf')) {
      let isMounted = true;
      getPdfPageCount(files[0]).then(count => {
        if (isMounted) setPdfPageCount(count);
      });
      return () => { isMounted = false; };
    } else {
      setPdfPageCount(null);
    }
  }, [files]);

  const activeJob = bgJobs.find(j => j.id === activeJobId);

  const status = activeJob ? activeJob.status : 'idle';
  const error = activeJob ? activeJob.error : null;
  const resultBlob = activeJob ? activeJob.resultBlob : null;
  const resultInfo = activeJob ? activeJob.resultInfo : null;
  const elapsedTime = activeJob ? activeJob.elapsedTime : 0;
  const progressMsg = activeJob ? activeJob.progressMsg : '';
  const uploadMetrics = activeJob
    ? activeJob.uploadMetrics
    : { percent: 0, loaded: 0, total: 0, speed: 0, eta: 0, isUploading: false };

  const handleBack = useCallback(() => {
    setSelectedTool(null);
    setFocusedFeature(null);
    setFiles([]);
    setActiveJobId(null);
    setExtraParams({});
  }, []);

  const handleCancelOrDismissJob = useCallback((jobId) => {
    const controller = jobControllersRef.current.get(jobId);
    if (controller) {
      if (controller.xhr) {
        try { controller.xhr.abort(); } catch (_) {}
      }
      if (controller.pollInterval) clearInterval(controller.pollInterval);
      if (controller.elapsedInterval) clearInterval(controller.elapsedInterval);
      if (controller.backendJobId) {
        fetch(`${API_BASE}/api/jobs/${controller.backendJobId}/cancel`, { method: 'POST' }).catch(() => {});
      }
      jobControllersRef.current.delete(jobId);
    }

    setBgJobs(prev => prev.filter(j => j.id !== jobId));
    if (activeJobId === jobId) {
      setActiveJobId(null);
    }
  }, [activeJobId]);

  const handleCancelUpload = useCallback(() => {
    if (activeJobId) {
      handleCancelOrDismissJob(activeJobId);
    }
  }, [activeJobId, handleCancelOrDismissJob]);

  const handleAdjustSettings = useCallback(() => {
    setActiveJobId(null);
  }, []);

  const handleReturnToResult = useCallback(() => {
    // Return to result view if needed
  }, []);

  const handleConvertAnotherDocument = useCallback(() => {
    setFiles([]);
    setActiveJobId(null);
  }, []);

  const handleDownloadJob = useCallback((job) => {
    if (!job || !job.resultBlob) return;
    const url = URL.createObjectURL(job.resultBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = job.resultFilename || job.resultBlob.filename || 'downloaded_file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleOpenJobTask = useCallback((job) => {
    const tool = TOOLS.find(t => t.id === job.toolId);
    if (tool) {
      setSelectedTool(tool);
      setFiles(job.files || []);
      setExtraParams(job.params || {});
      setActiveJobId(job.id);
    }
  }, []);

  const handleClearCompleted = useCallback(() => {
    setBgJobs(prev => prev.filter(j => j.status === 'uploading' || j.status === 'processing'));
  }, []);

  const handleConvert = useCallback(async (customFiles, customParams) => {
    const targetFiles = (Array.isArray(customFiles) && customFiles.length > 0) ? customFiles : files;
    const targetParams = (customParams && typeof customParams === 'object') ? { ...extraParams, ...customParams } : extraParams;
    if (!selectedTool || targetFiles.length === 0) return;

    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    let fileName = 'Document';
    if (selectedTool.id === 'merge-pdf') {
      fileName = `${targetFiles.length} PDF files`;
    } else if (targetFiles.length === 1 && targetFiles[0]?.name) {
      fileName = targetFiles[0].name;
    } else if (targetFiles.length > 1) {
      fileName = `${targetFiles.length} files (${selectedTool.title})`;
    }

    const initialJob = {
      id: jobId,
      toolId: selectedTool.id,
      toolTitle: selectedTool.title,
      toolColor: selectedTool.color,
      fileName: fileName,
      status: 'uploading',
      uploadMetrics: { percent: 0, loaded: 0, total: 0, speed: 0, eta: 0, isUploading: true },
      elapsedTime: 0,
      progressMsg: 'Uploading file...',
      resultBlob: null,
      resultFilename: null,
      resultInfo: null,
      error: null,
      createdAt: Date.now(),
      files: [...targetFiles],
      params: { ...targetParams },
    };

    setBgJobs(prev => [initialJob, ...prev]);
    setActiveJobId(jobId);

    const controller = { xhr: null, pollInterval: null, elapsedInterval: null, backendJobId: null };
    jobControllersRef.current.set(jobId, controller);

    try {
      const formData = new FormData();
      if (selectedTool.multiple || selectedTool.id === 'organize-pdf') {
        targetFiles.forEach(f => formData.append('files', f));
      } else {
        formData.append('file', targetFiles[0]);
      }
      if (selectedTool.params) {
        selectedTool.params.forEach(param => {
          const val = targetParams[param.key] ?? param.default ?? '';
          if (val instanceof File || val instanceof Blob) {
            formData.append(param.key, val);
          } else {
            formData.append(param.key, val.toString());
          }
        });
      }
      Object.keys(targetParams).forEach(key => {
        const paramExists = selectedTool.params?.some(p => p.key === key);
        if (!paramExists && targetParams[key] !== undefined && targetParams[key] !== null) {
          const val = targetParams[key];
          if (val instanceof File || val instanceof Blob) {
            formData.append(key, val);
          } else {
            formData.append(key, val.toString());
          }
        }
      });

      const xhrPromise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        controller.xhr = xhr;
        xhr.responseType = 'blob';

        let lastTime = Date.now();
        let lastLoaded = 0;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            const now = Date.now();
            const timeDiff = (now - lastTime) / 1000;

            let speed = 0;
            if (timeDiff > 0.2) {
              speed = (e.loaded - lastLoaded) / timeDiff;
              lastLoaded = e.loaded;
              lastTime = now;
            }

            const remainingBytes = e.total - e.loaded;
            const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

            updateJob(jobId, (j) => ({
              ...j,
              uploadMetrics: {
                percent,
                loaded: e.loaded,
                total: e.total,
                speed,
                eta,
                isUploading: percent < 100,
              },
            }));
          }
        };

        xhr.onload = () => {
          updateJob(jobId, (j) => ({
            ...j,
            uploadMetrics: { ...j.uploadMetrics, percent: 100, isUploading: false },
          }));
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr);
          } else {
            const reader = new FileReader();
            reader.onload = () => {
              let detail = `Server error (${xhr.status})`;
              try {
                const errObj = JSON.parse(reader.result);
                if (errObj && errObj.detail) {
                  if (Array.isArray(errObj.detail)) {
                    detail = errObj.detail.map(d => (typeof d === 'object' ? (d.msg || JSON.stringify(d)) : String(d))).join(', ');
                  } else if (typeof errObj.detail === 'object') {
                    detail = JSON.stringify(errObj.detail);
                  } else {
                    detail = String(errObj.detail);
                  }
                }
              } catch (_) {}
              reject(new Error(detail));
            };
            reader.onerror = () => reject(new Error(`Upload failed (${xhr.status})`));
            if (xhr.response instanceof Blob) {
              reader.readAsText(xhr.response);
            } else {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload. Please check connection.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));

        xhr.open('POST', `${API_BASE}${selectedTool.endpoint}`, true);
        xhr.send(formData);
      });

      const xhr = await xhrPromise;
      const resText = await xhr.response.text();
      const { job_id } = JSON.parse(resText);
      controller.backendJobId = job_id;

      updateJob(jobId, {
        status: 'processing',
        progressMsg: 'Converting  this may take a while for large files...',
      });

      controller.elapsedInterval = setInterval(() => {
        updateJob(jobId, (j) => ({ ...j, elapsedTime: j.elapsedTime + 1 }));
      }, 1000);

      await new Promise((resolve, reject) => {
        controller.pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API_BASE}/api/jobs/${job_id}/status`);
            const statusData = await statusRes.json();
            if (statusData.status === 'done') {
              if (controller.pollInterval) clearInterval(controller.pollInterval);
              if (controller.elapsedInterval) clearInterval(controller.elapsedInterval);
              resolve(statusData);
            } else if (statusData.status === 'error') {
              if (controller.pollInterval) clearInterval(controller.pollInterval);
              if (controller.elapsedInterval) clearInterval(controller.elapsedInterval);
              reject(new Error(statusData.error || 'Conversion failed.'));
            }
          } catch (pollErr) {
            if (controller.pollInterval) clearInterval(controller.pollInterval);
            if (controller.elapsedInterval) clearInterval(controller.elapsedInterval);
            reject(pollErr);
          }
        }, 2000);
      });

      updateJob(jobId, { progressMsg: 'Downloading result...' });

      const dlRes = await fetch(`${API_BASE}/api/jobs/${job_id}/download`);
      if (!dlRes.ok) {
        const errData = await dlRes.json().catch(() => null);
        throw new Error(errData?.detail || 'Download failed.');
      }

      const blob = await dlRes.blob();
      const contentDisposition = dlRes.headers.get('Content-Disposition');
      let fallbackExt = selectedTool.outputExt || '.bin';
      if (selectedTool.id === 'compress-image' && files.length > 1) {
        fallbackExt = '.zip';
      }

      let filename;
      if (selectedTool.id === 'merge-pdf') {
        filename = 'merged_document.pdf';
      } else if (files.length === 1 && files[0]?.name) {
        filename = `${files[0].name.replace(/\.[^/.]+$/, '')}${fallbackExt}`;
      } else {
        filename = `converted${fallbackExt}`;
      }

      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].trim().replace(/^"/, '').replace(/"$/, ''));
        }
      }

      let info = null;
      if (selectedTool.id === 'compress-pdf' || selectedTool.id === 'compress-image') {
        const origSize = dlRes.headers.get('X-Original-Size');
        const compSize = dlRes.headers.get('X-Compressed-Size');
        const ratio = dlRes.headers.get('X-Compression-Ratio');
        if (origSize && compSize) {
          const fmt = (b) => {
            b = parseInt(b);
            if (b < 1024) return b + ' B';
            if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
            return (b / (1024 * 1024)).toFixed(1) + ' MB';
          };
          info = `${fmt(origSize)}  ${fmt(compSize)} (${ratio} reduced)`;
        }
      }

      updateJob(jobId, {
        status: 'done',
        resultBlob: { blob, filename },
        resultFilename: filename,
        resultInfo: info,
        progressMsg: '',
      });
    } catch (err) {
      if (controller.pollInterval) clearInterval(controller.pollInterval);
      if (controller.elapsedInterval) clearInterval(controller.elapsedInterval);

      updateJob(jobId, (j) => {
        if (j.status === 'cancelled') return j;
        return {
          ...j,
          status: 'error',
          error: err.message || 'Task failed.',
          progressMsg: '',
        };
      });
    }
  }, [selectedTool, files, extraParams, updateJob]);

  //  Tool Selection Grid 
  if (!selectedTool) {
    return (
      <div className="space-y-6 overflow-y-auto flex-1 min-h-0 pr-1 pt-6 md:pt-8 relative">
        {/* Header (Frameless) */}
        <div className="pb-3 border-b border-slate-200 dark:border-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              PDF/File Conversion Tools
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {TOOLS.length} Tools
              </span>
            </h2>
            <p className="text-xs md:text-sm text-slate-600 dark:text-neutral-400 mt-1">
              High-performance document processing tools organized by workflow category.
            </p>
          </div>
        </div>

        {/* Section 1: Conversion Tool (Frameless, 2 Columns: To PDF & From PDF) */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-900">
            <ArrowLeftRight size={18} className="text-cyan-500 dark:text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-300">
              Conversion Tool
            </h3>
          </div>

          {/* Paired rows: each row has a TO PDF card on the left and its FROM PDF counterpart on the right */}
          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="pb-2 border-b border-slate-200 dark:border-neutral-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">To PDF</h4>
                </div>
                <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono">5 tools</span>
              </div>
              <div className="pb-2 border-b border-slate-200 dark:border-neutral-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">From PDF</h4>
                </div>
                <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono">5 tools</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 md:gap-8 text-xs text-slate-600 dark:text-neutral-400 pb-1">
              <p>Convert Office documents, images, spreadsheets, or text into PDF.</p>
              <p>Extract editable text, Office docs, spreadsheets, or images from PDF.</p>
            </div>

            {/* Paired rows - identical categories side by side */}
            {[
              { toId: 'word-to-pdf',  fromId: 'pdf-to-word'   },
              { toId: 'pptx-to-pdf', fromId: 'pdf-to-pptx'   },
              { toId: 'excel-to-pdf', fromId: 'pdf-to-excel'  },
              { toId: 'image-to-pdf', fromId: 'pdf-to-images' },
              { toId: 'text-to-pdf',  fromId: 'pdf-to-text'   },
            ].map(({ toId, fromId }, idx) => {
              const toTool = toId ? TOOLS.find(t => t.id === toId) : null;
              const fromTool = fromId ? TOOLS.find(t => t.id === fromId) : null;
              return (
                <div key={idx} className="grid grid-cols-2 gap-6 md:gap-8 items-start">
                  <div>
                    {toTool ? (
                      <ToolCard tool={toTool} onClick={() => handleToolSelect(toTool)} />
                    ) : (
                      <div className="h-full min-h-[180px]" />
                    )}
                  </div>
                  <div>
                    {fromTool ? (
                      <ToolCard tool={fromTool} onClick={() => handleToolSelect(fromTool)} />
                    ) : (
                      <div className="h-full min-h-[180px]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Direct Office Converters */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-900">
            <FileText size={18} className="text-purple-500 dark:text-purple-400" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-300">
              Direct Office Converters
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-neutral-400 pb-1">
            Convert directly between Word, PowerPoint presentations, and Excel spreadsheets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['word-to-pptx', 'pptx-to-word', 'word-to-excel', 'excel-to-word'].map(id => {
              const tool = TOOLS.find(t => t.id === id);
              return tool ? (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onClick={() => handleToolSelect(tool)}
                />
              ) : null;
            })}
          </div>
        </div>

        {/* Section 3: PDF Management, Security & Styling (Frameless, 4 Columns) */}
        <div className="space-y-4 pt-6 pb-8">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-neutral-900">
            <Layers size={18} className="text-emerald-500 dark:text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-300">
              PDF Management, Security & Styling
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 items-start">
            {[
              {
                id: 'structure',
                title: 'Structure & Ordering',
                description: 'Merge, split, reorder, remove, or compare PDF pages.',
                badgeColor: '#06B6D4',
                toolIds: ['merge-pdf', 'split-pdf', 'remove-pages', 'extract-pages', 'organize-pdf', 'compare-pdf'],
              },
              {
                id: 'optimization',
                title: 'Optimization & Security',
                description: 'Compress size, repair corrupt PDFs, or flatten form fields.',
                badgeColor: '#10B981',
                toolIds: ['compress-pdf', 'compress-image', 'repair-pdf', 'flatten-pdf', 'lock-pdf', 'unlock-pdf', 'redact-pdf'],
              },
              {
                id: 'styling',
                title: 'Page Layout & Styling',
                description: 'Rotate, number, watermark, or archive to PDF/A.',
                badgeColor: '#F59E0B',
                toolIds: ['rotate-pdf', 'add-page-numbers', 'add-watermark', 'pdf-to-pdfa'],
              },
              {
                id: 'extraction',
                title: 'Smart Extraction & Web',
                description: 'Convert web pages, OCR scanned text, or Markdown code.',
                badgeColor: '#E056FD',
                toolIds: ['html-to-pdf', 'ocr-to-word', 'pdf-to-markdown'],
              },
            ].map(category => {
              const categoryTools = category.toolIds
                .map(id => TOOLS.find(t => t.id === id))
                .filter(Boolean);

              return (
                <div key={category.id} className="space-y-3">
                  <div className="pb-2 border-b border-slate-200 dark:border-neutral-900/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: category.badgeColor, boxShadow: `0 0 10px ${category.badgeColor}80` }}
                      />
                      <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                        {category.title}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-neutral-500 font-mono">{categoryTools.length} tools</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-neutral-400 pb-1">{category.description}</p>
                  <div className="flex flex-col gap-3">
                    {categoryTools.map(tool => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        onClick={() => handleToolSelect(tool)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Tasks Drawer */}
        <BackgroundTasksDrawer
          bgJobs={bgJobs}
          onDownloadJob={handleDownloadJob}
          onOpenJobTask={handleOpenJobTask}
          onCancelOrDismissJob={handleCancelOrDismissJob}
          onClearCompleted={handleClearCompleted}
        />
      </div>
    );
  }

  //  Individual Tool Interface 
  const Icon = selectedTool.icon;
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto pt-6 md:pt-8 relative">
      {/* Toolbar */}
      <div className="glass-card-static p-5 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-200/60 dark:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft size={18} className="text-slate-700 dark:text-neutral-300" />
        </button>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: selectedTool.colorLight, border: `1px solid ${selectedTool.color}30` }}
        >
          <Icon size={24} style={{ color: selectedTool.color }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedTool.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-500">{selectedTool.description}</p>
        </div>

        {/* Actions when done */}
        {status === 'done' && (
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={handleAdjustSettings}
              className="py-2 px-4 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 hover:scale-105 flex items-center gap-1.5 cursor-pointer shadow-md"
              style={{ background: selectedTool.colorLight, color: selectedTool.color, border: `1px solid ${selectedTool.color}30` }}
            >
              <SlidersHorizontal size={15} />
              {selectedTool.id === 'split-pdf'
                ? 'Split Another Range'
                : selectedTool.params && selectedTool.params.length > 0
                ? 'Adjust Options'
                : 'Adjust Document / Options'}
            </button>
            <button
              onClick={handleConvertAnotherDocument}
              className="py-2 px-4 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 hover:scale-105 bg-slate-100 dark:bg-white/5 hover:bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-neutral-300 border border-slate-200 dark:border-white/10 cursor-pointer"
            >
              Convert Another Document
            </button>
          </div>
        )}
      </div>

      {/* Conversion Area */}
      <FileDropZone
        tool={selectedTool}
        files={files}
        setFiles={setFiles}
        pdfPageCount={pdfPageCount}
        onConvert={handleConvert}
        onCancelUpload={handleCancelUpload}
        onAdjustSettings={handleAdjustSettings}
        onReturnToResult={handleReturnToResult}
        status={status}
        error={error}
        resultBlob={resultBlob}
        resultInfo={resultInfo}
        elapsedTime={elapsedTime}
        progressMsg={progressMsg}
        uploadMetrics={uploadMetrics}
        extraParams={extraParams}
        setExtraParams={setExtraParams}
        focusedFeature={focusedFeature}
        onDismissError={() => {
          if (activeJobId) {
            updateJob(activeJobId, { error: null });
          }
        }}
      />

      <BackgroundTasksDrawer
        bgJobs={bgJobs}
        onDownloadJob={handleDownloadJob}
        onOpenJobTask={handleOpenJobTask}
        onCancelOrDismissJob={handleCancelOrDismissJob}
        onClearCompleted={handleClearCompleted}
      />
    </div>
  );
});

export default ConverterView;


