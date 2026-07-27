"""
Vocabulary Bank API routes.

Exposes:
- GET  /api/vocabularybank/words   — filter by pos, domain, limit
- GET  /api/vocabularybank/search  — search word/definition/example
- POST /api/vocabularybank/words   — add a word
- DELETE /api/vocabularybank/words/{word_id} — delete a word
"""
import logging
import io
import json
import asyncio
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
from pypdf import PdfReader
from core.gemini import get_client, gemini_request_with_retry

from vocabularybank_store import (
    get_words_by_pos,
    search_vocabulary,
    insert_word,
    delete_word,
    get_all_words,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Request models ────────────────────────────────────────────────────

class WordRequest(BaseModel):
    word: str
    pos: str                       # noun | verb | adjective | adverb | phrase
    word_register: Optional[str] = "academic"
    definition: str
    example_sentence: Optional[str] = ""
    domain: Optional[str] = "general"


# ── Routes ───────────────────────────────────────────────────────────

@router.get("/api/vocabularybank/words")
async def api_vocabularybank_words(
    pos: Optional[str] = Query(None, description="Part of speech filter (noun, verb, adjective, adverb, phrase)"),
    domain: Optional[str] = Query(None, description="Domain filter (e.g. general, social sciences)"),
    limit: int = Query(100, ge=1, le=500),
):
    """Retrieve vocabulary words with optional POS and domain filters."""
    words = get_words_by_pos(pos=pos, domain=domain, limit=limit)
    return {"words": words, "count": len(words)}


@router.get("/api/vocabularybank/search")
async def api_vocabularybank_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search vocabulary by word, definition, or example sentence."""
    words = search_vocabulary(q, limit=limit)
    return {"words": words, "count": len(words)}


@router.post("/api/vocabularybank/words")
async def api_vocabularybank_add_word(req: WordRequest):
    """Add a new vocabulary word to the bank."""
    if not req.word.strip():
        raise HTTPException(status_code=400, detail="word is required")
    if not req.pos.strip():
        raise HTTPException(status_code=400, detail="pos (part of speech) is required")
    if not req.definition.strip():
        raise HTTPException(status_code=400, detail="definition is required")

    word_data = {
        "word": req.word.strip(),
        "pos": req.pos.strip().lower(),
        "register": req.word_register or "academic",
        "definition": req.definition.strip(),
        "example_sentence": req.example_sentence or "",
        "domain": req.domain or "general",
    }
    result = insert_word(word_data)
    return {"word": result}


@router.delete("/api/vocabularybank/words/{word_id}")
async def api_vocabularybank_delete_word(word_id: int):
    """Delete a vocabulary word by ID."""
    deleted = delete_word(word_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Word not found")
    return {"deleted": word_id}


# ── spaCy lazy loader ────────────────────────────────────────────────
_nlp = None
def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            from spacy.cli import download as spacy_download
            spacy_download("en_core_web_sm")
            _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _extract_spacy_corpus(full_text: str) -> str:
    """Use spaCy to extract clean sentences, noun chunks, verbs, adjectives, and adverbs.
    Returns a rich, structured text corpus for Gemini to mine from."""
    nlp = _get_nlp()

    # Process in 50k-char chunks to avoid spaCy memory limits
    CHUNK = 50_000
    all_sentences = []
    noun_chunks = set()
    academic_tokens = set()

    for start in range(0, min(len(full_text), 800_000), CHUNK):
        segment = full_text[start:start + CHUNK]
        doc = nlp(segment)

        for sent in doc.sents:
            text = sent.text.strip()
            if 8 <= len(text.split()) <= 60:  # reasonable sentence length
                all_sentences.append(text)

        for chunk in doc.noun_chunks:
            phrase = chunk.text.strip().lower()
            if 2 <= len(phrase.split()) <= 5 and len(phrase) > 4:
                noun_chunks.add(chunk.text.strip())

        for token in doc:
            if token.pos_ in ("VERB", "ADJ", "ADV") and not token.is_stop and len(token.lemma_) > 4:
                academic_tokens.add(token.lemma_)

    # Build corpus: sentences first (these contain example context), then candidate terms
    sentences_text = "\n".join(all_sentences[:3000])  # cap at 3000 sentences
    noun_chunk_list = ", ".join(sorted(list(noun_chunks))[:500])
    token_list = ", ".join(sorted(list(academic_tokens))[:500])

    corpus = f"""=== SENTENCES (primary source for verbatim examples) ===
{sentences_text}

=== CANDIDATE NOUN PHRASES (multi-word expressions) ===
{noun_chunk_list}

=== CANDIDATE VERBS / ADJECTIVES / ADVERBS ===
{token_list}"""

    return corpus


def _get_existing_words() -> set:
    """Return set of words already in the vocabulary bank (to skip on dedup)."""
    from vocabularybank_store import get_all_words
    try:
        existing = get_all_words()
        return {w.get("word", "").lower().strip() for w in existing}
    except Exception:
        return set()


# Gemini 3.1 Flash Lite limits: 1,048,576 input tokens / 64,000 output tokens.
# At ~4 chars/token, 1M tokens ≈ 4M chars. We use 1.5M chars as a safe batch cap
# to leave headroom for the prompt (~10k chars) and output tokens (~64k).
_BATCH_CHAR_LIMIT = 1_500_000
# Tokens per char estimate (conservative)
_CHARS_PER_TOKEN = 4


def _build_extraction_prompt(corpus_chunk: str, existing_words: set) -> str:
    existing_sample = ", ".join(sorted(list(existing_words))[:60]) if existing_words else "none yet"
    return f"""You are a world-class academic lexicographer and NLP linguist.
Your task: exhaustively mine the following corpus extracted from academic papers and extract EVERY advanced, formal, or discipline-specific vocabulary item useful for academic writing.

CORPUS:
---
{corpus_chunk}
---

EXTRACTION RULES:
1. Extract 80 to 150 vocabulary items per response (aim for the maximum).
2. Include ALL of the following types:
   - Advanced single verbs (e.g. "corroborate", "substantiate", "elucidate", "attenuate", "posit")
   - Formal nouns (e.g. "nexus", "paradigm", "efficacy", "trajectory", "ramification")
   - Precise adjectives (e.g. "salient", "contentious", "putative", "prevalent", "nuanced")
   - Academic adverbs (e.g. "arguably", "empirically", "ostensibly", "ostensibly", "conversely")
   - Multi-word academic phrases (e.g. "in light of", "by extension", "with respect to", "as evidenced by")
   - Discipline-specific technical terms (e.g. "heterogeneous", "confounding variable", "regression coefficient")
3. Do NOT extract:
   - Common everyday words (e.g. "use", "show", "make", "said")
   - Author names, journal names, or place names
   - Words already in the known bank: [{existing_sample}]
4. For "example_sentence": ALWAYS use the EXACT verbatim sentence from the SENTENCES section above that contains the word/phrase. If no sentence is available, write one using the word in an academic context.
5. For "pos": must be exactly one of: noun | verb | adjective | adverb | phrase
6. For "domain": select from: computer science | biology | medicine | economics | social sciences | general

Return ONLY a valid JSON object:
{{
  "words": [
    {{
      "word": "substantiate",
      "pos": "verb",
      "definition": "To provide evidence that confirms or supports a statement or theory.",
      "example_sentence": "These findings substantiate the hypothesis that early intervention reduces mortality.",
      "domain": "general"
    }}
  ]
}}

Do NOT include markdown fences, backticks, or any text outside the JSON.
"""


@router.post("/api/vocabularybank/upload")
async def api_vocabularybank_upload(
    files: List[UploadFile] = File(...),
    domain: Optional[str] = Form(None)
):
    """
    Upload one or more PDFs, merge their text, use spaCy to build a rich sentence
    corpus, then batch the corpus to Gemini (1M token context) to mine 80-150
    academic vocabulary items per batch. Existing words are SKIPPED (not updated).
    """
    # ── 1. Extract text from ALL uploaded PDFs ─────────────────────────
    file_registry = {}   # filename → True (for result reporting)
    combined_text_parts = []
    errors = []

    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            errors.append({"filename": file.filename, "error": "Only PDF files are supported"})
            continue
        try:
            file_bytes = await file.read()
            if file_bytes[:4] != b'%PDF':
                errors.append({"filename": file.filename, "error": "Not a valid PDF file"})
                continue
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = [page.extract_text() or '' for page in reader.pages]
            if not any(t.strip() for t in pages_text):
                errors.append({"filename": file.filename, "error": "No text could be extracted from PDF"})
                continue
            full_text = "\n".join(pages_text)
            combined_text_parts.append(f"\n\n===== SOURCE: {file.filename} =====\n{full_text}")
            file_registry[file.filename] = True
        except Exception as e:
            logger.error("Failed to read PDF %s: %s", file.filename, e)
            errors.append({"filename": file.filename, "error": str(e)})

    if not combined_text_parts:
        return {"indexed": [], "errors": errors}

    if not file_registry:
        return {"indexed": [], "errors": errors}

    # ── 2. Build spaCy corpus from merged text ─────────────────────────
    merged_text = "\n".join(combined_text_parts)
    logger.info("Mining corpus: %d chars from %d PDFs", len(merged_text), len(file_registry))

    try:
        corpus = _extract_spacy_corpus(merged_text)
    except Exception as e:
        logger.warning("spaCy extraction failed, falling back to raw text: %s", e)
        corpus = merged_text[:_BATCH_CHAR_LIMIT]

    # ── 3. Fetch existing words to skip on dedup ───────────────────────
    existing_words = _get_existing_words()
    logger.info("Existing bank size: %d words (will skip duplicates)", len(existing_words))

    # ── 4. Batch the corpus into Gemini-sized chunks ───────────────────
    batches = []
    for start in range(0, len(corpus), _BATCH_CHAR_LIMIT):
        batches.append(corpus[start:start + _BATCH_CHAR_LIMIT])

    logger.info("Sending %d batch(es) to Gemini", len(batches))

    model_name = 'gemini-3.1-flash-lite-preview'
    from google.genai import types as genai_types
    config = genai_types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.25,
    )

    all_mined_words = []  # aggregated across all batches

    for batch_idx, batch_text in enumerate(batches):
        prompt = _build_extraction_prompt(batch_text, existing_words)
        try:
            client = get_client(model=model_name)
            response = await gemini_request_with_retry(client, prompt, model=model_name, config=config)
            raw = response.text.strip()

            # Strip markdown fences if any
            for fence in ('```json', '```'):
                if raw.startswith(fence):
                    raw = raw[len(fence):].strip()
            if raw.endswith('```'):
                raw = raw[:-3].strip()

            data = json.loads(raw)
            batch_words = data.get("words", [])
            logger.info("Batch %d/%d: Gemini returned %d words", batch_idx + 1, len(batches), len(batch_words))
            all_mined_words.extend(batch_words)
        except Exception as e:
            logger.error("Batch %d Gemini call failed: %s", batch_idx + 1, e)

    # ── 5. Validate, deduplicate, and insert ──────────────────────────
    inserted_words = []
    skipped = 0

    for w in all_mined_words:
        word_str = w.get("word", "").strip()
        pos_str = w.get("pos", "").strip().lower()
        def_str = w.get("definition", "").strip()

        if not word_str or not pos_str or not def_str:
            continue
        if pos_str not in {"noun", "verb", "adjective", "adverb", "phrase"}:
            pos_str = "phrase"

        word_lower = word_str.lower()

        # Skip if already in bank (in DB or already inserted this session)
        if word_lower in existing_words:
            skipped += 1
            continue

        word_payload = {
            "word": word_str,
            "pos": pos_str,
            "register": "academic",
            "definition": def_str,
            "example_sentence": w.get("example_sentence", "").strip(),
            "domain": w.get("domain") or domain or "general"
        }

        insert_word(word_payload)
        inserted_words.append(word_str)
        existing_words.add(word_lower)  # prevent duplicates within this session

    logger.info(
        "Mining complete: %d inserted, %d skipped (duplicates), %d files processed",
        len(inserted_words), skipped, len(file_registry)
    )

    # ── 6. Return a single consolidated result for the whole batch ─────
    filenames = list(file_registry.keys())
    return {
        "indexed": [{
            "filename": ", ".join(filenames),
            "vocab_count": len(inserted_words),
            "words": inserted_words,
            "skipped_duplicates": skipped,
            "files_processed": len(filenames)
        }],
        "errors": errors
    }



@router.post("/api/vocabularybank/batch-extract-metadata")
async def api_vocabularybank_batch_extract_metadata(
    files: List[UploadFile] = File(...),
):
    """
    Extract metadata for a batch of PDFs using the deterministic Python cascade
    (pypdf XMP → Info Dict → pikepdf → font-size heuristic → CrossRef/PubMed).
    Zero AI cost — no Gemini call needed.
    """
    from references.metadata import extract_pdf_metadata

    async def _process_one(file: UploadFile):
        try:
            file_bytes = await file.read()
            if not file.filename.lower().endswith('.pdf') or file_bytes[:4] != b'%PDF':
                return None, {"filename": file.filename, "error": "Not a valid PDF file"}

            meta = await extract_pdf_metadata(file_bytes)

            # Normalise authors list → comma-separated string for the frontend
            authors = meta.get("authors") or []
            if isinstance(authors, list):
                author_str = ", ".join(authors)
            else:
                author_str = str(authors)

            # Year — cascade returns int already; fall back to current year
            year = meta.get("year")
            try:
                year = int(year) if year else 2026
            except (TypeError, ValueError):
                year = 2026

            return {
                "filename": file.filename,
                "source_title": meta.get("title") or file.filename,
                "source_author": author_str,
                "publication_year": year,
                "domain": "general",           # domain is classified per-word at mine time
                "peer_reviewed": True,
                "source_doi": meta.get("doi"),
                "source_url": meta.get("url"),
            }, None
        except Exception as exc:
            logger.error("Metadata extraction failed for %s: %s", file.filename, exc)
            return None, {"filename": file.filename, "error": str(exc)}

    # Process all files concurrently
    tasks = [_process_one(f) for f in files]
    outcomes = await asyncio.gather(*tasks)

    results = []
    errors = []
    for result, error in outcomes:
        if result:
            results.append(result)
        if error:
            errors.append(error)

    return {"documents": results, "errors": errors}



