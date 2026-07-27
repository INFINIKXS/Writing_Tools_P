"""
Style Analyser & Transformer — Gemini prompt templates.

Covers all 10 style domains:
  1. Sentence Architecture
  2. Punctuation Logic
  3. Vocabulary and Lexical Choice
  4. Connective and Transitional Logic
  5. Paragraph Architecture
  6. Rhetorical Moves and Evidence Handling
  7. Voice and Perspective
  8. Rhythm and Prosody
  9. Macro Argument Structure
  10. Idiosyncratic Habits
"""

# ─── Phase 1 · Call 1: Metric Extraction ──────────────────────────────────────

METRIC_SYSTEM_INSTRUCTION = """You are a precise writing style analyst. Your job is to analyse writing samples and extract objective, measurable style metrics across all layers of an author's writing. You must return only a valid JSON object with no preamble, no markdown, no explanation. Every metric must be derived directly from the text — do not estimate or generalise. Count carefully and return exact values where possible."""

METRIC_USER_PROMPT_TEMPLATE = """Analyse the following writing sample and return a JSON object with exactly these keys and the values derived from the text:

{{
  "sentence_metrics": {{
    "total_sentences": <integer — total sentence count>,
    "total_words": <integer — total word count>,
    "avg_length_words": <float — average words per sentence>,
    "median_length_words": <float — median words per sentence>,
    "std_dev_length": <float — standard deviation of sentence lengths>,
    "min_length_words": <integer — shortest sentence in words>,
    "max_length_words": <integer — longest sentence in words>,
    "short_sentence_pct": <float 0-1 — percentage of sentences under 15 words>,
    "medium_sentence_pct": <float 0-1 — percentage of sentences 15-35 words>,
    "long_sentence_pct": <float 0-1 — percentage of sentences over 35 words>,
    "very_long_sentence_pct": <float 0-1 — percentage of sentences over 50 words>
  }},
  "punctuation_metrics": {{
    "avg_commas_per_sentence": <float>,
    "avg_semicolons_per_sentence": <float>,
    "avg_colons_per_sentence": <float>,
    "avg_parentheticals_per_sentence": <float — count of (...) per sentence>,
    "em_dash_per_1000_words": <float>,
    "exclamation_per_1000_words": <float>,
    "comma_splice_count": <integer — sentences where two independent clauses are joined only by a comma>
  }},
  "clause_structure_metrics": {{
    "avg_subordinate_clauses_per_sentence": <float — count subordinating conjunctions: which, that, although, because, given that, in that, such that, whereas, whilst, since, unless, until, when, where, if>,
    "avg_coordinate_clauses_per_sentence": <float — count coordinating conjunctions per sentence: and, but, or, nor, yet, so, for>,
    "subordination_to_coordination_ratio": <float — avg_subordinate_clauses / (avg_coordinate_clauses + 0.001)>,
    "avg_embedding_depth": <float — estimated average depth of clause nesting per sentence, where depth 1 = one subordinate clause inside the main clause, depth 2 = a subordinate clause inside a subordinate clause, etc. Estimate from text patterns.>
  }},
  "vocabulary_metrics": {{
    "avg_word_length_chars": <float>,
    "type_token_ratio": <float — unique word count / total word count>,
    "avg_syllables_per_word": <float — estimate syllable count per word>,
    "latinate_word_ratio": <float 0-1 — estimate proportion of words that are Latinate or Romance in origin vs Anglo-Saxon, based on word endings like -tion, -ity, -ance, -ment, -ous, -al, -ive, -ise/-ize, -fy, -ate>,
    "nominalisation_density": <float — count of nominalised forms per 100 words: words ending in -tion, -ity, -ance, -ment, -ness, -ism, -ence divided by total words × 100>,
    "passive_voice_ratio": <float 0-1 — estimated ratio of sentences containing passive voice constructions>,
    "first_person_per_1000_words": <float — count of I, me, my, we, our, us per 1000 words>,
    "hedging_word_count": <integer — count of: likely, suggests, may, might, could, appears, seems, arguably, potentially, possibly, perhaps, presumably, tentatively, ostensibly>,
    "intensifier_word_count": <integer — count of: clearly, significantly, crucially, markedly, considerably, notably, strikingly, importantly, evidently, demonstrably, unquestionably>
  }},
  "connective_phrases": [
    <return the top 20 most frequent connective and transitional phrases found in the text as an array of objects, each with keys "phrase", "count", and "per_1000_words". Search for both single-word and multi-word connectives across all categories: additive (furthermore, additionally, moreover, also, in addition), adversative (however, nevertheless, notwithstanding, by contrast, yet, although, whilst, whereas, on the other hand, in contrast), causal (consequently, therefore, as a result, hence, this in turn, which in turn, on this basis, given that, in that, such that), reformulative (that is, in other words, to be precise, specifically, namely), conclusive (on balance, in sum, taken together, overall, in conclusion, thus). Only include phrases that actually appear in the text.>
  ],
  "paragraph_metrics": {{
    "total_paragraphs": <integer>,
    "avg_length_sentences": <float — average sentences per paragraph>,
    "avg_length_words": <float — average words per paragraph>,
    "median_length_sentences": <float>,
    "std_dev_length_sentences": <float>,
    "short_paragraph_pct": <float 0-1 — paragraphs with 1-2 sentences>,
    "long_paragraph_pct": <float 0-1 — paragraphs with 6+ sentences>
  }},
  "sentence_openers": [
    <return the top 12 most frequent sentence-opening words or two-word phrases as an array of objects with keys "opener" and "pct" (proportion of all sentences using this opener as a float 0-1)>
  ],
  "citation_metrics": {{
    "total_citations": <integer — count all in-text citations matching patterns like (Author, Year), (Author et al., Year), or numbered references like [1], [2,3]>,
    "avg_citations_per_paragraph": <float>,
    "citation_dense_paragraphs": <integer — paragraphs containing 3 or more citations>
  }},
  "rhetorical_metrics": {{
    "questions_per_1000_words": <float — count of sentences ending in ?>,
    "signpost_phrase_count": <integer — count of explicit signposting phrases: this essay will, this paper argues, as demonstrated above, as shown above, as discussed, the following section, building on this, as established, in the previous section, this suggests that, it is argued that, it can be argued>,
    "stance_marker_count": <integer — count of: it is worth noting, importantly, crucially, notably, significantly, it is significant that, this is important because>
  }}
}}

Writing sample:
{text}"""


# ─── Phase 1 · Call 2: Semantic Analysis ──────────────────────────────────────

SEMANTIC_SYSTEM_INSTRUCTION = """You are a writing style analyst specialising in rhetorical, structural, and cognitive patterns. Your job is to identify the deep semantic habits of a writer from a sample of their work across all dimensions of style. You must return only a valid JSON object with no preamble, no markdown, and no explanation. Be specific and concrete in every description — avoid vague generalisations. Where possible, extract short illustrative examples directly from the text to support your descriptions."""

SEMANTIC_USER_PROMPT_TEMPLATE = """Analyse the following writing sample and return a JSON object with exactly these keys. For every field, be concrete and specific — name the actual patterns you observe and quote short examples from the text where indicated.

{{
  "sentence_architecture": {{
    "dominant_clause_type": "<identify whether this writer predominantly uses: simple sentences, compound sentences, complex sentences, or compound-complex sentences. Name the dominant type and describe what it looks like in this writer's hands. Include a short example from the text.>",
    "clause_ordering_preference": "<does the writer typically place the main claim first and qualifications after (front-weighted), or build conditions and context before landing the claim (end-weighted)? Describe the pattern with an example.>",
    "embedding_style": "<how deeply does this writer nest subordinate clauses? Describe the typical embedding depth and give an example of their most embedded construction.>",
    "coordination_vs_subordination": "<does this writer prefer to join ideas as equals (coordination: and, but, or) or rank them hierarchically (subordination: which, although, because)? Describe the dominant tendency and its rhetorical effect.>"
  }},
  "punctuation_logic": {{
    "comma_philosophy": "<describe how this writer uses commas — minimally (grammar only), moderately (clause stacking), or liberally (rhythmic signalling). What effect does this create?>" ,
    "parenthetical_style": "<how does this writer handle supplementary information — parentheses, embedded commas, or em dashes? Describe their preference with an example.>",
    "em_dash_usage": "<describe when and how this writer uses em dashes, or notes their absence. Include an example if present.>",
    "semicolon_usage": "<does this writer use semicolons? If so, describe the pattern — balanced pairs, lists, linked reasoning? If not, what do they use instead?>"
  }},
  "vocabulary_and_register": {{
    "register_consistency": "<is the register consistently formal, consistently conversational, or does it shift deliberately? Describe where and how it shifts if applicable.>",
    "concrete_vs_abstract": "<does this writer favour concrete, specific language or abstract, conceptual language? Describe the tendency with examples from both ends of the spectrum if present.>",
    "latinate_vs_anglosaxon": "<does this writer lean toward Latinate vocabulary (demonstrate, subsequently, utilise, administration, modification) or Anglo-Saxon (show, then, use, give, change)? Describe the dominant tendency.>",
    "technical_density": "<how dense is the technical terminology relative to plain language? Is technical language defined when introduced or assumed known? Give examples.>",
    "nominalisation_habit": "<does this writer convert verbs/adjectives into nouns (the administration of, an improvement in, a reduction of) rather than using active verb forms? Describe the tendency with examples.>",
    "hedging_style": "<describe how this writer qualifies claims — what specific language do they use to express degrees of certainty? Include characteristic hedging phrases quoted from the text.>",
    "intensifier_style": "<describe the specific words this writer uses to strengthen claims. Include characteristic intensifier phrases quoted from the text.>"
  }},
  "connective_logic": {{
    "dominant_connective_type": "<which category of connective dominates — additive, adversative, causal, reformulative, or conclusive? Describe the pattern.>",
    "connective_density": "<does this writer use explicit connectives frequently (high signposting density) or let logical relationships remain implied (compressed, elliptical style)? Describe the effect.>",
    "characteristic_connective_phrases": "<list the 5-8 most characteristic connective phrases this writer reaches for, with a note on when each is used.>"
  }},
  "paragraph_architecture": {{
    "opening_sentence_function": "<what does the first sentence of a paragraph typically do — state the main claim (topic sentence), set context, transition from the previous paragraph, or ask a question? Describe with an example.>",
    "internal_development_pattern": "<describe the typical sequence of moves within a paragraph. For example: claim → evidence → critique → application. Identify the writer's default pattern.>",
    "closing_sentence_function": "<what does the last sentence of a paragraph typically do — summarise, imply a forward consequence, return to the opening claim, or transition? Describe with an example.>",
    "cross_paragraph_cohesion": "<does this writer explicitly link paragraphs back-referencing the previous one, or do paragraphs stand more independently? Describe with examples of any linking language used.>"
  }},
  "rhetorical_moves": {{
    "evidence_introduction": "<describe precisely how this writer introduces a source before citing it — by naming the author, stating the claim first, framing the study method first? Include a short example.>",
    "evidence_affirmation": "<how does this writer acknowledge the strength or importance of evidence before critiquing it? What language signals affirmation?>" ,
    "evidence_critique": "<describe the specific moves this writer makes to identify limitations in evidence — sample size, generalisability, methodology, conflicting findings. What language signals critique? Include an example.>",
    "evidence_application": "<how does this writer connect external evidence back to their specific case or argument? What language marks this move?>" ,
    "counterargument_handling": "<does this writer raise opposing views before or after their own position? How is the tension resolved?>"
  }},
  "voice_and_perspective": {{
    "person_and_pronoun": "<does this writer use first person (I argue, we suggest), third person (the evidence suggests, studies show), or impersonal constructions (it can be argued, it is worth noting)? Describe the dominant choice.>",
    "authorial_presence": "<how visible is the writer in their own text? Do they foreground themselves, or efface themselves behind evidence and passive constructions?>" ,
    "epistemic_stance": "<how does this writer position themselves in relation to knowledge — as a confident authority, a cautious interpreter, a synthesiser of others' views, or an active sceptic? Describe with examples.>",
    "stance_markers": "<what language does this writer use to signal their own position on a claim and direct the reader's attention? List characteristic phrases.>"
  }},
  "rhythm_and_prosody": {{
    "length_variation_pattern": "<does sentence length vary randomly, deliberately, or follow a recognisable rhythm (e.g. long-long-short, building to a climax)? Describe the dominant pattern.>",
    "stress_and_emphasis": "<where does the most important word or phrase tend to land in sentences — at the start (front stress), in the middle, or at the end (end stress, the most powerful position)? Describe with examples.>",
    "parallelism_and_repetition": "<does this writer use deliberate structural repetition for emphasis (not only... but also, both... and, the more... the more)? Describe the frequency and effect.>",
    "pacing": "<describe the overall pacing of the writing. Does the writer build momentum, maintain a steady rhythm, or alternate between dense and light passages? Where do shorter sentences appear and what effect do they create?>"
  }},
  "macro_argument_structure": {{
    "organisational_logic": "<is the writing organised deductively (claim first, evidence after), inductively (evidence first, conclusion after), or dialectically (thesis, antithesis, synthesis)? Describe the dominant logic.>",
    "signposting_density": "<how much does this writer explicitly tell the reader what is coming or what has just been established? Describe the level and give examples of signposting language used.>",
    "thesis_placement": "<does this writer state their central argument at the opening, build to it gradually, or withhold it until the end? Describe the typical pattern.>",
    "proportionality": "<how does this writer distribute space — how much goes to setup, evidence, critique, application, conclusion? What does this reveal about what the writer considers most important?>"
  }},
  "idiosyncratic_habits": {{
    "characteristic_openers": "<what moves does this writer make at the very start of a piece or section that are recognisably theirs? Describe with examples.>",
    "pet_phrases": "<list the specific words or phrases this writer returns to repeatedly, often unconsciously. Include the actual phrases from the text.>",
    "preferred_qualifiers": "<what specific words does this writer reach for when softening a claim? List them with examples.>",
    "structural_quirks": "<any recurring structural patterns, punctuation preferences, or constructions that would distinguish this writer from others writing on the same topic.>",
    "unique_fingerprint": "<describe the single most distinctive feature of this writer's style — the one pattern that, if replicated, would make a piece feel most authentically like theirs.>"
  }}
}}

Writing sample:
{text}"""


# ─── Phase 2: Dynamic Transformation Prompt Builder ───────────────────────────

TRANSFORM_SYSTEM_INSTRUCTION = """You are a writing style transformer. Your sole job is to rewrite text to precisely match a target writer's style across all dimensions: sentence structure, punctuation logic, vocabulary register, connective phrases, clause embedding, paragraph architecture, rhetorical moves, voice, rhythm, and idiosyncratic habits. You must preserve all factual content, all citations, all clinical or technical claims exactly as they are. You transform only the style. Never invent new facts, new citations, or new content of any kind. If the input text has citations, preserve every citation exactly as written."""


def build_transform_prompt(profile: dict, target_text: str) -> str:
    """
    Dynamically constructs the transformation prompt from a stored Style Profile.
    Uses all 10 style domains captured in the profile.
    """
    m = profile.get("metrics", {})
    s = profile.get("semantic", {})

    # ── Sentence metrics ──────────────────────────────────────────────────────
    sm = m.get("sentence_metrics", {})
    pm = m.get("punctuation_metrics", {})
    cm = m.get("clause_structure_metrics", {})
    vm = m.get("vocabulary_metrics", {})
    para = m.get("paragraph_metrics", {})

    # ── Semantic domains ──────────────────────────────────────────────────────
    sa = s.get("sentence_architecture", {})
    pl = s.get("punctuation_logic", {})
    vr = s.get("vocabulary_and_register", {})
    cl = s.get("connective_logic", {})
    pa = s.get("paragraph_architecture", {})
    rm = s.get("rhetorical_moves", {})
    vp = s.get("voice_and_perspective", {})
    rp = s.get("rhythm_and_prosody", {})
    mac = s.get("macro_argument_structure", {})
    ih = s.get("idiosyncratic_habits", {})

    # ── Build connective phrases list ─────────────────────────────────────────
    connective_phrases = m.get("connective_phrases", [])
    top_connectives = connective_phrases[:10]
    connective_lines = "\n".join(
        f"  - \"{cp.get('phrase', '')}\" — target rate: {cp.get('per_1000_words', 0):.1f} per 1000 words"
        for cp in top_connectives
    )

    # ── Build sentence openers list ───────────────────────────────────────────
    openers = m.get("sentence_openers", [])
    opener_lines = "\n".join(
        f"  - \"{op.get('opener', '')}\" ({op.get('pct', 0)*100:.0f}% of sentences)"
        for op in openers[:8]
    )

    avg_len = sm.get("avg_length_words", 20)
    avg_commas = pm.get("avg_commas_per_sentence", 1.5)
    avg_parens = pm.get("avg_parentheticals_per_sentence", 0.1)
    em_dash_rate = pm.get("em_dash_per_1000_words", 0)
    avg_sub = cm.get("avg_subordinate_clauses_per_sentence", 1.0)
    sub_to_coord = cm.get("subordination_to_coordination_ratio", 1.0)
    passive_ratio = vm.get("passive_voice_ratio", 0.2)
    nominalisation = vm.get("nominalisation_density", 5.0)
    latinate_ratio = vm.get("latinate_word_ratio", 0.5)

    em_dash_instruction = (
        "Use em dashes sparingly for dramatic parenthetical asides"
        if em_dash_rate >= 1
        else "Avoid em dashes entirely — use commas or parentheses instead"
    )

    passive_instruction = (
        "Use passive voice constructions frequently to efface authorial presence"
        if passive_ratio > 0.4
        else f"Use passive voice in approximately {passive_ratio*100:.0f}% of sentences"
    )

    latinate_instruction = (
        "Favour Latinate vocabulary (demonstrate, subsequently, utilise, administration, modification, implementation)"
        if latinate_ratio > 0.55
        else "Favour Anglo-Saxon vocabulary (show, then, use, give, change, help, make)"
    )

    sub_instruction = (
        "Heavily favour subordination — rank ideas hierarchically using which, although, because, given that, whilst, whereas"
        if sub_to_coord > 2
        else "Balance subordination and coordination — mix hierarchical clauses with coordinated pairs"
    )

    prompt = f"""Rewrite the following text to match this writer's style exactly. Follow every instruction below precisely. Preserve all facts, citations, technical terms, and clinical content unchanged.

═══════════════════════════════════════════════════════════════
DOMAIN 1 — SENTENCE ARCHITECTURE
═══════════════════════════════════════════════════════════════
- Target an average sentence length of {avg_len:.1f} words (range: {sm.get('min_length_words', 8)}–{sm.get('max_length_words', 60)} words)
- Short sentences (under 15 words): {sm.get('short_sentence_pct', 0.15)*100:.0f}% of all sentences
- Long sentences (over 35 words): {sm.get('long_sentence_pct', 0.3)*100:.0f}% of all sentences
- Dominant clause type: {sa.get('dominant_clause_type', 'complex sentences with embedded subordinate clauses')}
- Clause ordering: {sa.get('clause_ordering_preference', 'front-weighted — main claim first, qualifications after')}
- Embedding style: {sa.get('embedding_style', 'moderate nesting')}
- {sub_instruction}
- Subordination preference: {sa.get('coordination_vs_subordination', 'prefers subordination')}

═══════════════════════════════════════════════════════════════
DOMAIN 2 — PUNCTUATION LOGIC
═══════════════════════════════════════════════════════════════
- Use an average of {avg_commas:.1f} commas per sentence
- Semicolons per sentence: {pm.get('avg_semicolons_per_sentence', 0):.2f} — {pl.get('semicolon_usage', 'use semicolons to join closely related independent clauses')}
- Parenthetical insertions: {avg_parens:.2f} per sentence — {pl.get('parenthetical_style', 'use parentheses for supplementary technical detail')}
- Em dash: {em_dash_instruction} ({em_dash_rate:.1f} per 1000 words)
- Colons: {pm.get('avg_colons_per_sentence', 0):.2f} per sentence
- Comma philosophy: {pl.get('comma_philosophy', 'moderate comma usage for clause stacking')}

═══════════════════════════════════════════════════════════════
DOMAIN 3 — VOCABULARY AND LEXICAL CHOICE
═══════════════════════════════════════════════════════════════
- {latinate_instruction}
- Register: {vr.get('register_consistency', 'consistently formal academic register')}
- Concrete vs abstract: {vr.get('concrete_vs_abstract', 'blend of concrete specifics and abstract reasoning')}
- Technical density: {vr.get('technical_density', 'high — domain-specific terminology used without definition')}
- Nominalisation: {vr.get('nominalisation_habit', 'moderate nominalisation')} (target {nominalisation:.1f} nominalisations per 100 words)
- {passive_instruction}
- Hedging: {vr.get('hedging_style', 'moderate hedging with may, suggests, appears')}
- Intensifiers: {vr.get('intensifier_style', 'moderate use of significantly, notably, crucially')}

═══════════════════════════════════════════════════════════════
DOMAIN 4 — CONNECTIVE AND TRANSITIONAL LOGIC
═══════════════════════════════════════════════════════════════
- Dominant connective type: {cl.get('dominant_connective_type', 'causal and adversative')}
- Connective density: {cl.get('connective_density', 'high — explicit signposting throughout')}
- Characteristic phrases: {cl.get('characteristic_connective_phrases', 'however, consequently, on this basis, furthermore, in turn')}
- Top connective phrases to use (maintain these rates):
{connective_lines if connective_lines else '  - however, furthermore, consequently, on this basis, therefore'}

═══════════════════════════════════════════════════════════════
DOMAIN 5 — PARAGRAPH ARCHITECTURE
═══════════════════════════════════════════════════════════════
- Average paragraph length: {para.get('avg_length_sentences', 4):.1f} sentences ({para.get('avg_length_words', 80):.0f} words)
- Opening sentence function: {pa.get('opening_sentence_function', 'topic sentence stating the paragraph main claim')}
- Internal development pattern: {pa.get('internal_development_pattern', 'claim → evidence → critique → application')}
- Closing sentence function: {pa.get('closing_sentence_function', 'forward-looking implication or transition')}
- Cross-paragraph cohesion: {pa.get('cross_paragraph_cohesion', 'explicit back-references to previous paragraphs')}

═══════════════════════════════════════════════════════════════
DOMAIN 6 — RHETORICAL MOVES AND EVIDENCE HANDLING
═══════════════════════════════════════════════════════════════
- Evidence introduction: {rm.get('evidence_introduction', 'name the author or study before citing')}
- Evidence affirmation: {rm.get('evidence_affirmation', 'acknowledge strength before critiquing')}
- Evidence critique: {rm.get('evidence_critique', 'identify sample size, generalisability, or methodological limitations')}
- Evidence application: {rm.get('evidence_application', 'explicitly link evidence back to the case at hand')}
- Counterargument: {rm.get('counterargument_handling', 'raise opposing views then resolve tension')}

═══════════════════════════════════════════════════════════════
DOMAIN 7 — VOICE AND PERSPECTIVE
═══════════════════════════════════════════════════════════════
- Person and pronoun: {vp.get('person_and_pronoun', 'third person — the evidence suggests, studies show')}
- Authorial presence: {vp.get('authorial_presence', 'moderate — present but not dominant')}
- Epistemic stance: {vp.get('epistemic_stance', 'cautious interpreter — calibrated certainty')}
- Stance markers: {vp.get('stance_markers', 'it is worth noting, importantly, this suggests')}

═══════════════════════════════════════════════════════════════
DOMAIN 8 — RHYTHM AND PROSODY
═══════════════════════════════════════════════════════════════
- Length variation: {rp.get('length_variation_pattern', 'deliberate variation — longer analytical sentences alternating with shorter declarative ones')}
- Stress and emphasis: {rp.get('stress_and_emphasis', 'end stress — key terms placed at sentence end')}
- Parallelism: {rp.get('parallelism_and_repetition', 'occasional parallel structures for emphasis')}
- Pacing: {rp.get('pacing', 'steady analytical pace with occasional short sentences for emphasis')}

═══════════════════════════════════════════════════════════════
DOMAIN 9 — MACRO ARGUMENT STRUCTURE
═══════════════════════════════════════════════════════════════
- Organisational logic: {mac.get('organisational_logic', 'deductive — claim first, evidence and qualification after')}
- Signposting: {mac.get('signposting_density', 'moderate explicit signposting')}
- Thesis placement: {mac.get('thesis_placement', 'stated early and returned to')}

═══════════════════════════════════════════════════════════════
DOMAIN 10 — IDIOSYNCRATIC HABITS
═══════════════════════════════════════════════════════════════
- Characteristic openers: {ih.get('characteristic_openers', 'no strong pattern identified')}
- Pet phrases to weave in: {ih.get('pet_phrases', 'none identified')}
- Preferred qualifiers: {ih.get('preferred_qualifiers', 'none identified')}
- Structural quirks: {ih.get('structural_quirks', 'none identified')}
- The most distinctive feature to replicate: {ih.get('unique_fingerprint', 'none identified')}

═══════════════════════════════════════════════════════════════
SENTENCE OPENERS TO MODEL
═══════════════════════════════════════════════════════════════
Vary sentence openers but model these frequencies:
{opener_lines if opener_lines else '  - no strong opener pattern identified'}

═══════════════════════════════════════════════════════════════
TEXT TO TRANSFORM
═══════════════════════════════════════════════════════════════
{target_text}"""

    return prompt
