"""
Store for the Academic Vocabulary Bank.
Supabase table 'vocabulary_bank' with local fallback.
Columns: id, word, pos (part of speech), register, definition, example_sentence, domain, created_at
"""
import os
import json
import logging
from typing import Optional, List, Dict, Any

from db.supabase_client import supabase, SUPABASE_OFFLINE

logger = logging.getLogger(__name__)

FALLBACK_FILE = os.path.join(os.path.dirname(__file__), "vocabularybank_local_fallback.json")

# ──────────────────────────────────────────────────────────────────────
# Local Fallback Helpers
# ──────────────────────────────────────────────────────────────────────

def _load_local_data() -> list:
    """Load vocabulary words from the local JSON fallback file."""
    if os.path.exists(FALLBACK_FILE):
        try:
            with open(FALLBACK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict) and "words" in data:
                    return data["words"]
        except Exception as e:
            logger.warning("Error loading vocabulary fallback file: %s", e)
    return []


def _save_local_data(words: list) -> None:
    """Save vocabulary words to the local JSON fallback file."""
    try:
        with open(FALLBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(words, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Error writing vocabulary fallback file: %s", e)


# ──────────────────────────────────────────────────────────────────────
# Seed Data — 60 Academic Vocabulary Items
# ──────────────────────────────────────────────────────────────────────

SEED_WORDS: List[Dict[str, Any]] = [
    # ── Nouns (15) ──────────────────────────────────────────────────
    {"word": "phenomenon", "pos": "noun", "register": "academic", "definition": "A fact or situation that is observed to exist or happen", "example_sentence": "This phenomenon has been widely documented in the literature.", "domain": "general"},
    {"word": "trajectory", "pos": "noun", "register": "academic", "definition": "The path followed by an object or the course of action or development over time", "example_sentence": "The trajectory of economic growth has been inconsistent across regions.", "domain": "general"},
    {"word": "implication", "pos": "noun", "register": "academic", "definition": "A conclusion that can be drawn from something although it is not explicitly stated", "example_sentence": "The implications of this finding for policy are far-reaching.", "domain": "general"},
    {"word": "mechanism", "pos": "noun", "register": "academic", "definition": "The processes by which something takes place or is brought about", "example_sentence": "The underlying mechanism through which stress affects cognition remains poorly understood.", "domain": "general"},
    {"word": "paradigm", "pos": "noun", "register": "academic", "definition": "A typical example or pattern of something; a framework or model", "example_sentence": "This study challenges the dominant paradigm in the field.", "domain": "general"},
    {"word": "discourse", "pos": "noun", "register": "academic", "definition": "Written or spoken communication or debate; a formal discussion of a topic", "example_sentence": "The public discourse surrounding climate change has intensified in recent years.", "domain": "general"},
    {"word": "inference", "pos": "noun", "register": "academic", "definition": "A conclusion reached on the basis of evidence and reasoning", "example_sentence": "Causal inference from observational data requires rigorous methodological controls.", "domain": "general"},
    {"word": "disparities", "pos": "noun", "register": "academic", "definition": "Great differences or inequalities between groups or situations", "example_sentence": "Persistent health disparities continue to affect marginalised communities disproportionately.", "domain": "social sciences"},
    {"word": "synthesis", "pos": "noun", "register": "academic", "definition": "The combination of ideas or elements to form a connected whole", "example_sentence": "A synthesis of the existing literature reveals several recurring themes.", "domain": "general"},
    {"word": "critique", "pos": "noun", "register": "academic", "definition": "A detailed analysis and assessment of something", "example_sentence": "A thorough critique of the methodology reveals significant limitations.", "domain": "general"},
    {"word": "conjecture", "pos": "noun", "register": "academic", "definition": "An opinion or conclusion formed on the basis of incomplete information", "example_sentence": "This remains conjecture until corroborated by empirical evidence.", "domain": "general"},
    {"word": "postulate", "pos": "noun", "register": "academic", "definition": "A thing suggested or assumed as true as the basis for reasoning or belief", "example_sentence": "The core postulate of this theory has not been empirically tested.", "domain": "general"},
    {"word": "nexus", "pos": "noun", "register": "academic", "definition": "A connection or series of connections linking two or more things", "example_sentence": "The nexus between poverty and educational attainment is well established.", "domain": "general"},
    {"word": "antecedent", "pos": "noun", "register": "academic", "definition": "A thing or event that existed before or logically precedes another", "example_sentence": "Identifying the antecedent conditions is essential for causal analysis.", "domain": "general"},
    {"word": "corollary", "pos": "noun", "register": "academic", "definition": "A direct or natural consequence or result", "example_sentence": "A corollary of this finding is that intervention must begin early.", "domain": "general"},

    # ── Verbs (15) ──────────────────────────────────────────────────
    {"word": "substantiate", "pos": "verb", "register": "academic", "definition": "To provide evidence to support or prove the truth of something", "example_sentence": "The findings substantiate the hypothesis that early intervention is effective.", "domain": "general"},
    {"word": "corroborate", "pos": "verb", "register": "academic", "definition": "To confirm or give support to a statement or theory", "example_sentence": "These results corroborate the findings reported by earlier studies.", "domain": "general"},
    {"word": "exacerbate", "pos": "verb", "register": "academic", "definition": "To make a problem, bad situation, or negative feeling worse", "example_sentence": "Austerity measures have served to exacerbate existing socioeconomic inequalities.", "domain": "general"},
    {"word": "illuminate", "pos": "verb", "register": "academic", "definition": "To help clarify or explain; to shed light on a topic", "example_sentence": "This qualitative approach serves to illuminate the lived experiences of participants.", "domain": "general"},
    {"word": "underpin", "pos": "verb", "register": "academic", "definition": "To support or form the basis of an argument, theory, or practice", "example_sentence": "The theoretical framework that underpins this study draws on critical realism.", "domain": "general"},
    {"word": "engender", "pos": "verb", "register": "academic", "definition": "To cause or give rise to a feeling, situation, or condition", "example_sentence": "These policies may engender unintended consequences for the most vulnerable populations.", "domain": "general"},
    {"word": "contend", "pos": "verb", "register": "academic", "definition": "To assert something as a position in an argument", "example_sentence": "The authors contend that current approaches are fundamentally flawed.", "domain": "general"},
    {"word": "posit", "pos": "verb", "register": "academic", "definition": "To put forward as a fact or as a basis for argument", "example_sentence": "The theory posits a direct relationship between social capital and health outcomes.", "domain": "general"},
    {"word": "delineate", "pos": "verb", "register": "academic", "definition": "To describe or portray something precisely; to indicate the exact limits of something", "example_sentence": "The study aims to delineate the boundaries between these overlapping concepts.", "domain": "general"},
    {"word": "interrogate", "pos": "verb", "register": "academic", "definition": "To examine or inquire into a topic rigorously and critically", "example_sentence": "This paper interrogates the assumptions embedded in dominant policy frameworks.", "domain": "general"},
    {"word": "triangulate", "pos": "verb", "register": "academic", "definition": "To use multiple methods or data sources to validate research findings", "example_sentence": "The researchers triangulated findings across interviews, surveys, and documentary evidence.", "domain": "general"},
    {"word": "nuance", "pos": "verb", "register": "academic", "definition": "To give nuance or a more complex quality to something", "example_sentence": "The author nuances this broad claim by attending to contextual variation.", "domain": "general"},
    {"word": "problematize", "pos": "verb", "register": "academic", "definition": "To make something an object of critical inquiry or to question its assumptions", "example_sentence": "The study seeks to problematize the taken-for-granted notion of student success.", "domain": "general"},
    {"word": "situate", "pos": "verb", "register": "academic", "definition": "To place or position within a broader context or framework", "example_sentence": "This analysis situates the findings within the broader sociohistorical context.", "domain": "general"},
    {"word": "foreground", "pos": "verb", "register": "academic", "definition": "To make something the most prominent or important element", "example_sentence": "The discussion foregrounds the role of institutional power in shaping outcomes.", "domain": "general"},

    # ── Adjectives (10) ─────────────────────────────────────────────
    {"word": "salient", "pos": "adjective", "register": "academic", "definition": "Most noticeable or important; prominent in a given context", "example_sentence": "The most salient finding of this study concerns the mediating role of trust.", "domain": "general"},
    {"word": "seminal", "pos": "adjective", "register": "academic", "definition": "Strongly influencing later developments; foundational", "example_sentence": "This seminal work laid the groundwork for subsequent research in the field.", "domain": "general"},
    {"word": "nascent", "pos": "adjective", "register": "academic", "definition": "Just coming into existence and beginning to develop", "example_sentence": "The nascent field of precision medicine holds considerable promise.", "domain": "general"},
    {"word": "putative", "pos": "adjective", "register": "academic", "definition": "Generally considered or reputed to be; supposed", "example_sentence": "The putative benefits of the intervention were not borne out by the data.", "domain": "general"},
    {"word": "extant", "pos": "adjective", "register": "academic", "definition": "Still in existence; surviving; current", "example_sentence": "A review of extant literature reveals a significant gap in knowledge.", "domain": "general"},
    {"word": "pervasive", "pos": "adjective", "register": "academic", "definition": "Spreading widely throughout an area or a group of people", "example_sentence": "Pervasive structural inequalities undermine the effectiveness of targeted interventions.", "domain": "general"},
    {"word": "multifaceted", "pos": "adjective", "register": "academic", "definition": "Having many different aspects or features; complex", "example_sentence": "Addressing this multifaceted problem requires an interdisciplinary approach.", "domain": "general"},
    {"word": "contentious", "pos": "adjective", "register": "academic", "definition": "Causing or likely to cause disagreement or controversy", "example_sentence": "The relationship between diet and cancer remains a contentious area of research.", "domain": "general"},
    {"word": "spurious", "pos": "adjective", "register": "academic", "definition": "False or fake; based on false reasoning or deceptive reasoning", "example_sentence": "This correlation is likely spurious, arising from a shared confounding variable.", "domain": "general"},
    {"word": "heuristic", "pos": "adjective", "register": "academic", "definition": "Enabling the discovery or learning of something; relating to exploratory problem-solving", "example_sentence": "The framework serves a heuristic function, guiding further empirical investigation.", "domain": "general"},

    # ── Adverbs (10) ────────────────────────────────────────────────
    {"word": "empirically", "pos": "adverb", "register": "academic", "definition": "Based on observation or experience rather than theory", "example_sentence": "This claim has been empirically validated across multiple research contexts.", "domain": "general"},
    {"word": "ostensibly", "pos": "adverb", "register": "academic", "definition": "Apparently or purportedly, but perhaps not actually", "example_sentence": "The policy is ostensibly designed to promote inclusion, yet evidence suggests otherwise.", "domain": "general"},
    {"word": "arguably", "pos": "adverb", "register": "academic", "definition": "It may be argued that; used to qualify a claim", "example_sentence": "This represents arguably the most significant contribution to the field in a decade.", "domain": "general"},
    {"word": "fundamentally", "pos": "adverb", "register": "academic", "definition": "In a central or primary way; at the most basic level", "example_sentence": "The approach is fundamentally flawed in its treatment of contextual factors.", "domain": "general"},
    {"word": "systematically", "pos": "adverb", "register": "academic", "definition": "In a methodical and thorough manner", "example_sentence": "The data were systematically collected and coded using established protocols.", "domain": "general"},
    {"word": "correspondingly", "pos": "adverb", "register": "academic", "definition": "In a way that corresponds; in a similar or parallel way", "example_sentence": "As exposure increased, health risks correspondingly intensified.", "domain": "general"},
    {"word": "purportedly", "pos": "adverb", "register": "academic", "definition": "As it is claimed or reputed to be; supposedly", "example_sentence": "The treatment was purportedly effective, though the evidence base remains thin.", "domain": "general"},
    {"word": "paradoxically", "pos": "adverb", "register": "academic", "definition": "In a way that seems contradictory but may nevertheless be true", "example_sentence": "Paradoxically, greater access to information does not always lead to better decisions.", "domain": "general"},
    {"word": "inherently", "pos": "adverb", "register": "academic", "definition": "In a permanent, essential, or characteristic way", "example_sentence": "Qualitative research is not inherently less rigorous than quantitative approaches.", "domain": "general"},
    {"word": "substantially", "pos": "adverb", "register": "academic", "definition": "To a great or significant extent", "example_sentence": "These findings substantially advance our understanding of the underlying process.", "domain": "general"},

    # ── Phrases (10) ────────────────────────────────────────────────
    {"word": "in light of", "pos": "phrase", "register": "academic", "definition": "Taking into account; considering the fact of something", "example_sentence": "In light of these findings, a revised framework is proposed.", "domain": "general"},
    {"word": "with respect to", "pos": "phrase", "register": "academic", "definition": "With reference to; regarding", "example_sentence": "With respect to methodology, the study adopts a mixed-methods approach.", "domain": "general"},
    {"word": "in conjunction with", "pos": "phrase", "register": "academic", "definition": "Together with; in combination with", "example_sentence": "This measure should be used in conjunction with other validated instruments.", "domain": "general"},
    {"word": "notwithstanding", "pos": "phrase", "register": "academic", "definition": "In spite of; nevertheless; despite this", "example_sentence": "Notwithstanding these limitations, the study makes a valuable contribution.", "domain": "general"},
    {"word": "in the context of", "pos": "phrase", "register": "academic", "definition": "Within the circumstances or setting of something", "example_sentence": "In the context of globalisation, local identities are subject to increasing pressure.", "domain": "general"},
    {"word": "by extension", "pos": "phrase", "register": "academic", "definition": "Used to indicate a further or analogous conclusion", "example_sentence": "By extension, these results have implications for related fields of inquiry.", "domain": "general"},
    {"word": "in so far as", "pos": "phrase", "register": "academic", "definition": "To the extent that; to the degree that", "example_sentence": "The model is useful in so far as it accounts for variation across settings.", "domain": "general"},
    {"word": "to a considerable extent", "pos": "phrase", "register": "academic", "definition": "To a large or significant degree", "example_sentence": "The outcomes were determined to a considerable extent by institutional factors.", "domain": "general"},
    {"word": "in this regard", "pos": "phrase", "register": "academic", "definition": "Concerning this matter; in relation to what has just been mentioned", "example_sentence": "In this regard, the findings align with those of earlier investigations.", "domain": "general"},
    {"word": "as evidenced by", "pos": "phrase", "register": "academic", "definition": "Demonstrated or supported by", "example_sentence": "The intervention was effective, as evidenced by significant reductions in recidivism.", "domain": "general"},
]


# ──────────────────────────────────────────────────────────────────────
# Seeding
# ──────────────────────────────────────────────────────────────────────

def seed_vocabulary() -> None:
    """Seed the SEED_WORDS list into Supabase or the local fallback file."""
    try:
        result = supabase.table("vocabulary_bank").insert(SEED_WORDS).execute()
        logger.info("Seeded %d vocabulary words to Supabase.", len(result.data or SEED_WORDS))
    except Exception as exc:
        logger.warning("Supabase seed failed, writing to local fallback. Error: %s", exc)
        _save_local_data(SEED_WORDS)
        logger.info("Seeded %d vocabulary words to local fallback file.", len(SEED_WORDS))


# ──────────────────────────────────────────────────────────────────────
# Store Retrieval Methods
# ──────────────────────────────────────────────────────────────────────

def _get_local_words(pos: Optional[str] = None, domain: Optional[str] = None, limit: int = 100) -> list:
    words = _load_local_data()
    filtered = []
    for w in words:
        if pos and w.get("pos", "").strip().lower() != pos.strip().lower():
            continue
        if domain and w.get("domain", "").strip().lower() != domain.strip().lower():
            continue
        filtered.append(w)
    return filtered[:limit]


def get_words_by_pos(pos: Optional[str] = None, domain: Optional[str] = None, limit: int = 100) -> list:
    """Filter vocabulary words by part of speech and/or domain."""
    if SUPABASE_OFFLINE:
        return _get_local_words(pos, domain, limit)

    try:
        query = supabase.table("vocabulary_bank").select("*")
        if pos:
            query = query.eq("pos", pos.strip().lower())
        if domain:
            query = query.eq("domain", domain.strip().lower())
        query = query.limit(limit)
        result = query.execute()

        # Handle postgrest-py error/missing table
        if getattr(result, "error", None) is not None or result.data is None:
            raise Exception(f"Database error: {getattr(result, 'error', 'No data returned')}")

        return result.data
    except Exception as exc:
        logger.warning("Supabase query failed in get_words_by_pos. Falling back to local. Error: %s", exc)
        return _get_local_words(pos, domain, limit)


def search_vocabulary(query: str, limit: int = 20) -> list:
    """Search vocabulary by word, definition, or example sentence."""
    terms = [t.lower() for t in query.strip().split() if t.strip()]
    if not terms:
        return []

    all_words = []
    if not SUPABASE_OFFLINE:
        try:
            result = supabase.table("vocabulary_bank").select("*").execute()
            if getattr(result, "error", None) is not None or result.data is None:
                raise Exception(f"Database error: {getattr(result, 'error', 'No data returned')}")
            all_words = result.data
        except Exception as exc:
            logger.warning("Supabase query failed in search_vocabulary. Falling back to local. Error: %s", exc)
            all_words = _load_local_data()
    else:
        all_words = _load_local_data()

    matches = []
    for word in all_words:
        text = f"{word.get('word', '')} {word.get('definition', '')} {word.get('example_sentence', '')}".lower()
        score = sum(1 for t in terms if t in text)
        if score > 0:
            matches.append((word, score))

    matches.sort(key=lambda x: x[1], reverse=True)
    return [m[0] for m in matches[:limit]]


def get_all_words(limit: int = 200) -> list:
    """Get all vocabulary words."""
    if SUPABASE_OFFLINE:
        return _load_local_data()[:limit]

    try:
        result = supabase.table("vocabulary_bank").select("*").limit(limit).execute()
        if getattr(result, "error", None) is not None or result.data is None:
            raise Exception(f"Database error: {getattr(result, 'error', 'No data returned')}")
        return result.data
    except Exception as exc:
        logger.warning("Supabase query failed in get_all_words. Falling back to local. Error: %s", exc)
        return _load_local_data()[:limit]


# ──────────────────────────────────────────────────────────────────────
# Store Mutation Methods
# ──────────────────────────────────────────────────────────────────────

def insert_word(word_data: dict) -> dict:
    """Insert a vocabulary word into Supabase or local fallback.
    
    If the word already exists (unique constraint on 'word' column), the existing
    record is returned unchanged — duplicates are SKIPPED, not overwritten.
    """
    payload = {
        "word": word_data.get("word", "").strip(),
        "pos": word_data.get("pos", "").strip().lower(),
        "register": word_data.get("register", "academic").strip(),
        "definition": word_data.get("definition", "").strip(),
        "example_sentence": word_data.get("example_sentence", "").strip(),
        "domain": word_data.get("domain", "general").strip().lower(),
    }

    if SUPABASE_OFFLINE:
        words = _load_local_data()
        # Skip if word already exists in local store
        existing = next((w for w in words if w.get("word", "").lower() == payload["word"].lower()), None)
        if existing:
            return existing
        existing_ids = [w.get("id") for w in words if isinstance(w.get("id"), int)]
        payload["id"] = max(existing_ids) + 1 if existing_ids else 1
        words.append(payload)
        _save_local_data(words)
        return payload

    try:
        result = supabase.table("vocabulary_bank").insert(payload).execute()
        if getattr(result, "error", None) is not None or not result.data:
            raise Exception(f"Database error: {getattr(result, 'error', 'No data inserted')}")
        return result.data[0]
    except Exception as exc:
        exc_str = str(exc)
        # If it's a unique constraint violation, look up and return the existing row
        if "23505" in exc_str or "duplicate key" in exc_str.lower() or "unique constraint" in exc_str.lower():
            try:
                lookup = supabase.table("vocabulary_bank").select("*").eq("word", payload["word"]).limit(1).execute()
                if lookup.data:
                    logger.debug("Skipping duplicate word '%s' (already exists in bank)", payload["word"])
                    return lookup.data[0]
            except Exception:
                pass
            # If lookup also fails, fall through to local fallback
        logger.warning("Supabase insert failed in insert_word. Saving to local fallback. Error: %s", exc)
        words = _load_local_data()
        existing = next((w for w in words if w.get("word", "").lower() == payload["word"].lower()), None)
        if existing:
            return existing
        existing_ids = [w.get("id") for w in words if isinstance(w.get("id"), int)]
        payload["id"] = max(existing_ids) + 1 if existing_ids else 1
        words.append(payload)
        _save_local_data(words)
        return payload


def delete_word(word_id: int) -> bool:
    """Delete a vocabulary word by ID."""
    if SUPABASE_OFFLINE:
        words = _load_local_data()
        original_len = len(words)
        words = [w for w in words if w.get("id") != word_id]
        if len(words) < original_len:
            _save_local_data(words)
            return True
        return False

    try:
        result = supabase.table("vocabulary_bank").delete().eq("id", word_id).execute()
        if getattr(result, "error", None) is not None:
            raise Exception(f"Database error: {result.error}")
        return bool(result.data)
    except Exception as exc:
        logger.warning("Supabase delete failed in delete_word. Trying local fallback. Error: %s", exc)
        words = _load_local_data()
        original_len = len(words)
        words = [w for w in words if w.get("id") != word_id]
        if len(words) < original_len:
            _save_local_data(words)
            return True
        return False


# ──────────────────────────────────────────────────────────────────────
# Auto-seed on module load if fallback file doesn't exist
# ──────────────────────────────────────────────────────────────────────

if not os.path.exists(FALLBACK_FILE):
    seed_vocabulary()
