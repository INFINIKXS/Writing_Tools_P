---
archived: 2026-07-25T18:37:56.417326
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\4242e03c-7e59-47d1-98c5-966d576cfff4\walkthrough.md
---

# Walkthrough — Contrast & Readability Overhaul (Policy Pages + Cookie Modal)

## What Was Fixed

### Root Cause
All policy pages had two systemic contrast failures:
1. **`text-neutral-400` with no `dark:` prefix** — body text was always rendered as muted gray regardless of light/dark mode.
2. **Hardcoded dark-only styled boxes** (`bg-neutral-900/50`, `bg-neutral-900/40`) — these policy callout boxes looked broken in light mode with near-invisible text.

---

### Files Changed

#### `PrivacyView.jsx`
- All section body paragraph wrappers: `text-slate-600 dark:text-neutral-400` → `text-slate-800 dark:text-neutral-200`
- All `<ul>` list items: `text-neutral-400` → `text-slate-800 dark:text-neutral-200`
- **AI Model Training Policy box**: `bg-neutral-900/50 border-neutral-800 text-neutral-300` → `bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 text-slate-800 dark:text-amber-100` (now visible in both light and dark modes)
- Main content card: `bg-white/90 dark:bg-neutral-950/40` → `bg-white dark:bg-neutral-950` (solid, no blur degradation)

#### `TermsView.jsx`
- All section body paragraph wrappers: upgraded to `text-slate-800 dark:text-neutral-200`
- All `<ul>` and `<ol>` lists: `text-neutral-400` → `text-slate-800 dark:text-neutral-200`
- Company tagline paragraph: `text-neutral-400` → `text-slate-600 dark:text-neutral-400`

#### `CopyrightPolicyView.jsx`
- All body paragraph wrappers and list items: same upgrades as above
- `<strong>5 business days</strong>`: `text-neutral-400` → `text-slate-800 dark:text-neutral-200`
- Company pending registration line: upgraded

#### `CommunityGuidelinesView.jsx`
- All body paragraph wrappers and lists: upgraded to `text-slate-800 dark:text-neutral-200`
- Two reporting/policy callout boxes: `bg-neutral-900/40 border-neutral-800 text-neutral-400` → `bg-amber-50 dark:bg-amber-900/10` with proper light/dark contrast

#### `CookiePreferenceModal.jsx`
- Intro text: `text-slate-600` → `text-slate-800 dark:text-neutral-200`
- Category row background: `bg-slate-50/50` → `bg-white dark:bg-neutral-900/30` (crisp white cards)
- "Manage Consent Preferences" label: `text-slate-400` → `text-slate-600`
- Info note: Blue-tinted (`bg-blue-50`, `text-blue-500` icon) instead of generic gray
- Reject All / Accept All buttons: `border-slate-200 text-slate-700` → `border-slate-300 text-slate-900` (stronger contrast)

---

## Verification
- `npm run build` — ✅ 0 errors, built in ~1m 53s
