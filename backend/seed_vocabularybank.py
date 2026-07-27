"""
Seed script for the Vocabulary Bank in Supabase.
Requires the 'vocabulary_bank' table to be created first in your Supabase database.

Run this script to populate the Supabase table with initial curated academic words.
Usage:
    backend\\venv\\Scripts\\python.exe backend/seed_vocabularybank.py
"""
import os
import sys

# Add current directory to path to allow importing modules
sys.path.insert(0, os.path.dirname(__file__))

from db.supabase_client import supabase, SUPABASE_OFFLINE
from vocabularybank_store import SEED_WORDS

def seed():
    if SUPABASE_OFFLINE:
        print("[ERROR] Supabase is offline or unreachable. Cannot seed.")
        return

    print(f"[INFO] Loaded {len(SEED_WORDS)} vocabulary bank words.")
    print("Attempting to seed Supabase 'vocabulary_bank' table...")

    try:
        # Check if table exists
        res = supabase.table("vocabulary_bank").select("id").limit(1).execute()
        if getattr(res, "error", None) is not None:
            raise Exception(res.error)

        print("[OK] Supabase connection is healthy and 'vocabulary_bank' table exists.")
        
        # Insert words in batches
        BATCH_SIZE = 20
        inserted = 0
        
        for i in range(0, len(SEED_WORDS), BATCH_SIZE):
            batch = SEED_WORDS[i : i + BATCH_SIZE]
            # Format payload for DB insert
            payloads = []
            for w in batch:
                payloads.append({
                    "word": w["word"],
                    "pos": w["pos"],
                    "register": w["register"],
                    "definition": w["definition"],
                    "example_sentence": w["example_sentence"],
                    "domain": w["domain"]
                })
            
            # Use upsert on 'word' to prevent duplicate violations if run multiple times
            result = supabase.table("vocabulary_bank").upsert(payloads, on_conflict="word").execute()
            inserted += len(result.data or [])
            
        print(f"[SUCCESS] Successfully seeded {inserted} words into Supabase 'vocabulary_bank' table.")

    except Exception as e:
        print(f"[ERROR] Seeding failed. Ensure the 'vocabulary_bank' table exists. Error detail:\n{e}")

if __name__ == "__main__":
    seed()
