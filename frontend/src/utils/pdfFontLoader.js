/**
 * Loads embedded PDF fonts into the browser via @font-face.
 * 
 * These font-faces use the font's PostScript name (without subset tag),
 * so CSS `font-family: "MetaProLight-Regular"` resolves correctly.
 * 
 * Fonts are installed globally (into document.head). They remain available
 * for the session; unloadPDFFonts() cleans them up when a new PDF loads.
 */

const installedStyleElements = new Set();
const loadedFontNames = new Set();
const fontStemRatios = new Map();

const _STYLE_RE = /[-_](Bold|Italic|Oblique|Regular|Roman|Light|Medium|Thin|Black|Heavy|Bd|It|Cn|CnO|Cond(?:ensed)?|Ext(?:ended)?|Narrow)$/i;
const _SUBSET_RE = /^[A-Z]{6}\+/;
function rootFamily(name) {
  return (name || '').replace(_SUBSET_RE, '').replace(_STYLE_RE, '').toLowerCase().trim();
}

let vaultManifestPromise = null;
let vaultManifestData = null;

export async function getVaultManifest() {
  if (vaultManifestData) return vaultManifestData;
  if (!vaultManifestPromise) {
    vaultManifestPromise = fetch('/api/pdf/vault/manifest')
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        vaultManifestData = data;
        return data;
      })
      .catch(() => ({}));
  }
  return vaultManifestPromise;
}

// Automatically trigger manifest fetch
getVaultManifest();

/**
 * Retrieve stem_vw_ratio (StdVW / units_per_em) for a given font family name or font stack string.
 */
export function getFontStemVwRatio(fontFamilyName) {
  if (!fontFamilyName) return null;
  const names = fontFamilyName.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
  for (const name of names) {
    if (fontStemRatios.has(name)) return fontStemRatios.get(name);
    const stripped = name.replace(/^[A-Z]{6}\+/, '');
    if (fontStemRatios.has(stripped)) return fontStemRatios.get(stripped);
    const sanitized = name.replace(/\s*-\s*/g, '-');
    if (fontStemRatios.has(sanitized)) return fontStemRatios.get(sanitized);
    if (vaultManifestData) {
      const rf = rootFamily(name);
      if (vaultManifestData[rf]?.stem_vw_ratio) {
        return vaultManifestData[rf].stem_vw_ratio;
      }
    }
  }
  return null;
}

const canon = (n) => (n || '')
  .replace(/^[A-Z]{6}\+/, '')
  .replace(/\s+(Regular|Reg|Bold|Italic|Oblique)$/i, '')
  .replace(/\s*-\s*/g, '-');

export async function loadPDFFonts(fontsData) {
  // fontsData shape: { "NBUDXT+MetaProLight-Regular": { data, format, postscript_name, subset_tag, stem_vw_ratio } }
  
  for (const [basename, meta] of Object.entries(fontsData)) {
    const psName = meta.postscript_name || basename;
    
    // Track stem_vw_ratio if present
    if (meta.stem_vw_ratio != null && typeof meta.stem_vw_ratio === 'number') {
      fontStemRatios.set(psName, meta.stem_vw_ratio);
      fontStemRatios.set(basename, meta.stem_vw_ratio);
      fontStemRatios.set(canon(psName), meta.stem_vw_ratio);
      fontStemRatios.set(canon(basename), meta.stem_vw_ratio);
    }

    // Skip if already loaded (can happen with multi-page PDFs referencing same font)
    if (loadedFontNames.has(psName)) continue;
    loadedFontNames.add(psName);
    
    const mimeFormat = {
      'otf': 'opentype',
      'ttf': 'truetype',
      'woff': 'woff',
      'woff2': 'woff2',
    }[meta.format] || 'opentype';
    
    // Register with PostScript name, subset-prefixed name, and canonized name
    const familyNames = [psName];
    if (basename !== psName) familyNames.push(basename);
    const cPs = canon(psName);
    if (cPs && !familyNames.includes(cPs)) familyNames.push(cPs);
    const cBase = canon(basename);
    if (cBase && !familyNames.includes(cBase)) familyNames.push(cBase);
    
    for (const familyName of familyNames) {
      if (meta.stem_vw_ratio != null && typeof meta.stem_vw_ratio === 'number') {
        fontStemRatios.set(familyName, meta.stem_vw_ratio);
      }
    }

    // Use the FontFace API for reliable async loading & readiness detection.
    const src = `url(data:font/${meta.format};base64,${meta.data}) format('${mimeFormat}')`;
    
    try {
      for (const familyName of familyNames) {
        const fontFace = new FontFace(familyName, src);
        const loaded = await fontFace.load();
        document.fonts.add(loaded);
      }
      console.log(`[pdfFontLoader] Loaded font: ${psName} (stem_vw_ratio: ${meta.stem_vw_ratio ?? 'none'})`);
    } catch (e) {
      console.warn(`[pdfFontLoader] Failed to load ${psName}:`, e);
    }
  }
}

export function unloadPDFFonts() {
  // Remove all @font-face style elements we installed.
  for (const el of installedStyleElements) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  installedStyleElements.clear();
  loadedFontNames.clear();
  fontStemRatios.clear();
}
