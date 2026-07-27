"""
FastAPI router for depth and breadth evaluation.
"""
import json
import re
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from core.gemini import get_client, gemini_request_with_retry
from utils.text_extraction import extract_pdf_text, extract_docx_text, extract_doc_text

router = APIRouter()

ANALYSIS_SYSTEM_PROMPT = """You are an elite academic writing evaluator and reviewer. Your job is to analyze the provided writing draft and objectively measure its analytical depth and contextual breadth using a 0-100 scoring system based on specific scholarly guidelines.

You MUST score the writing on these 7 sub-dimensions:
1. **thesis_strength**: Is the thesis statement a specific, debatable, theory-driven, and contextually anchored claim rather than a simple factual statement?
2. **close_reading_evidence**: Does the writing perform close reading of specific evidence, appraising methodologies and theoretical assumptions rather than just summarizing?
3. **lexical_depth**: Is vocabulary precise, discipline-appropriate, and contextually defined, avoiding artificial obfuscation and empty buzzwords?
4. **counter_argumentation**: Does the text preemptively address counterarguments using a structured "Turn Against" and "Turn Back" flow (refutation, acknowledgment, or concession)?
5. **historical_contextualization**: Does the writer trace the chronological evolution of theories, frameworks, or phenomena?
6. **t_shaped_integration**: Does the analysis combine a deep, specialized domain study (vertical) with interdisciplinary contexts and adjacent fields (horizontal)?
7. **demographic_lens_diversity**: Does the text analyze multiple sampling cases, demographies, or apply multiple theoretical lenses to avoid generic universal claims?

Your response MUST be a JSON object matching this schema EXACTLY. Do not add any conversational text or formatting prefix except the raw JSON itself:
{
  "depth_score": 75,
  "breadth_score": 60,
  "sub_dimensions": {
    "thesis_strength": 80,
    "close_reading_evidence": 70,
    "lexical_depth": 85,
    "counter_argumentation": 65,
    "historical_contextualization": 55,
    "t_shaped_integration": 65,
    "demographic_lens_diversity": 60
  },
  "suggestions": {
    "thesis_strength": ["suggestion 1", "suggestion 2"],
    "close_reading_evidence": ["suggestion 1"],
    "lexical_depth": ["suggestion 1"],
    "counter_argumentation": ["suggestion 1"],
    "historical_contextualization": ["suggestion 1"],
    "t_shaped_integration": ["suggestion 1"],
    "demographic_lens_diversity": ["suggestion 1"]
  }
}

Be critical and objective. If a sub-dimension is not present or is very weak, score it low (e.g. 0-40) and provide clear, actionable suggestions.
If the writing is brief, evaluate what is present.

WRITING DRAFT TO ANALYZE:
---
"""

@router.post("/api/analyze-depth-breadth")
async def analyze_depth_breadth(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Analyze text or document files to measure academic depth and breadth.
    """
    extracted_text = ""
    
    if file:
        filename = file.filename.lower()
        file_bytes = await file.read()
        
        try:
            if filename.endswith(".pdf"):
                extracted_text = extract_pdf_text(file_bytes)
            elif filename.endswith(".docx"):
                extracted_text = extract_docx_text(file_bytes)
            elif filename.endswith(".doc"):
                extracted_text = extract_doc_text(file_bytes)
            elif filename.endswith(".txt"):
                extracted_text = file_bytes.decode("utf-8", errors="ignore")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file format: {file.filename}. Supported formats are PDF, DOCX, DOC, and TXT."
                )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract text from file: {str(e)}"
            )
    elif text:
        extracted_text = text.strip()
        
    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide a writing draft, either by pasting text or uploading a file."
        )
        
    # Cap the text to prevent token overflow (~8000 words max)
    words = extracted_text.split()
    if len(words) > 8000:
        extracted_text = " ".join(words[:8000]) + "\n...[Text Truncated for Length]..."

    # Create prompt
    prompt = ANALYSIS_SYSTEM_PROMPT + extracted_text
    
    try:
        model_name = "gemini-3.1-flash-lite"
        client = get_client(model=model_name)
        
        # Request content from Gemini
        response = await gemini_request_with_retry(client, prompt, model=model_name)
        raw_output = response.text.strip()
        
        # Clean json outputs if formatted inside code blocks
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:].strip()
        if raw_output.startswith("```"):
            raw_output = raw_output[3:].strip()
        if raw_output.endswith("```"):
            raw_output = raw_output[:-3].strip()
            
        result_json = json.loads(raw_output)
        
        # Validate that the structured response contains required fields
        required_keys = ["depth_score", "breadth_score", "sub_dimensions", "suggestions"]
        for key in required_keys:
            if key not in result_json:
                raise ValueError(f"Missing key in LLM response: {key}")
                
        return result_json
        
    except Exception as e:
        # Graceful fallback: return a parsing error message or dummy response
        raise HTTPException(
            status_code=500,
            detail=f"Error evaluating text depth and breadth: {str(e)}"
        )
