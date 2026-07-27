# Original User Request

## Initial Request — 2026-06-08T21:01:03+01:00

A new feature that allows users to upload a file (PDF, TXT, DOCX) containing their writing, or paste it, and objectively measure its analytical depth and contextual breadth using a dedicated scoring model based on the guidelines in `Writing depth and breadth.md`.

Working directory: `c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools`
Integrity mode: development

## Requirements

### R1. Backend Analysis API
Implement an endpoint `/api/analyze-depth-breadth` in FastAPI that accepts direct text input or file uploads (PDF, DOCX, TXT) and:
1. Parses/extracts text from the inputs using existing backend text-extraction utilities.
2. Uses the core Gemini client to perform a multi-dimensional assessment of depth and breadth based on the principles in `Writing depth and breadth.md`.
3. Returns structured JSON containing:
   - **Overall Scores**: `depth_score` (0-100) and `breadth_score` (0-100).
   - **Sub-dimension Scores**: Individual scores (0-100) for *Thesis Strength*, *Close Reading/Evidence*, *Lexical Depth*, *Counter-Argumentation*, *Historical Contextualization*, *T-Shaped Integration*, and *Demographic/Lens Diversity*.
   - **Actionable Suggestions**: Specific, categorized recommendations on how to improve each sub-dimension.

### R2. Frontend "Depth & Breadth" Analyzer View
Create a dedicated component `DepthBreadthView.jsx` and integrate it into the main navigation flow of the application. It must:
1. Support text pasting and file selection/drag-and-drop for PDF, DOCX, and TXT files.
2. Display a loading spinner/skeleton state during analysis.
3. Show overall depth and breadth scores using beautiful visual gauges (e.g. radial gauges or a 2D matrix map).
4. Display a detailed score breakdown for the 7 sub-dimensions using a premium visual display (like a radar chart, custom progress indicators, or grid cards).
5. List the actionable suggestions categorized by sub-dimension with smooth hover transitions.

## Acceptance Criteria

### API Verification
- [ ] Endpoint `/api/analyze-depth-breadth` accepts POST requests with text or file payloads.
- [ ] The API successfully returns structured JSON matching the overall scores, sub-dimension scores, and suggestions schema.
- [ ] An automated test script (e.g., using `pytest` in `backend/`) verifies endpoint functionality and validates responses against sample texts.

### Frontend Verification
- [ ] User can paste writing or drag-and-drop a file (PDF, DOCX, TXT) for analysis.
- [ ] Visual indicators display scores (0-100) for overall depth/breadth and each of the sub-dimensions.
- [ ] Improvement suggestions are correctly rendered and categorized by their corresponding sub-dimension.
- [ ] The view is accessible from the main navigation of the app.

## Follow-up — 2026-07-05T00:08:52+01:00

Fix and improve the PDF metadata extraction and strict verification pipeline in the Reference Generator feature of the Writing Tools app to handle files with missing or malformed metadata (e.g. empty author fields, HTML entities in titles) and accent normalization differences.

Working directory: c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools
Integrity mode: benchmark

## Requirements

### R1. Robust Accent and Punctuation Normalization
Implement robust normalization using Python standard libraries (e.g. `unicodedata`, `re`) to strip accents/diacritics and convert to ASCII characters in both extracted PDF text and metadata fields before checking matching constraints.

### R2. HTML/XML Entity Decoding
Ensure all parsed metadata fields and text snippets are decoded of HTML, XML, or hexadecimal entity sequences (such as `&#x02026;`) prior to comparison using python standard libraries (e.g. `html.unescape`).

### R3. Smarter Surname Matching
Enhance author surname verification logic to correctly parse and extract surnames regardless of whether authors are formatted in "Last, First" or "First Last" order (e.g., getting the last word if no comma).

## Acceptance Criteria

### Verification Success
- [ ] Running `python test_all_verifier.py` and `python test_batch_direct.py` completes successfully with zero failures.
- [ ] Successfully extract and verify metadata for the target file `C:\Users\Paradox-Labs\Documents\MY RESEARCH\my writiing\Miracle\Complex care\Complex case\Endstage renal disease\new files\MILQ-103-205.pdf` (or its original uncleaned copy) without any "AI failed identity verification" errors.

## Follow-up — 2026-07-07T18:05:48+01:00

Context-Aware Classification, Recommendation & Batch Retrieval Engine for the ASL (Architectural Sentence Logic) Workflow.

Working directory: c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools
Integrity mode: benchmark

## Requirements

### R1. Context-Aware Clause Classification & Mold Recommendation
- Update `/api/asl/classify-clause` and `/api/asl/recommend-molds` to accept and utilize parent context (skeleton, function, frame), overall stance, and paragraph goal.
- Restructure the prompt in `recommend_molds` to rewrite/restructure clause content grammatically into template slots rather than verbatim slot insertion.

### R2. Batch Mould Discovery Endpoint
- Implement `POST /api/asl/batch-find-moulds` that runs queries and recommendations in parallel for all sentences in a question chain using `asyncio.to_thread` for the synchronous database query.

### R3. Automated Test Verification
- Create tests in `backend/test_asl.py` verifying the new batch endpoint and updated keyword classification/recommendation logic with parent context.

## Acceptance Criteria

### Performance & Compilation
- [ ] Backend unittest suite runs and passes successfully: `python -m unittest backend/test_asl.py`
- [ ] Frontend Vite build compiles with zero errors: `npm run build` inside `frontend/`

