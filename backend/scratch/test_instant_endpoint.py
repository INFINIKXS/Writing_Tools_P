import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import grammarbank_store
from vocabularybank_store import get_words_by_pos

def test_db_queries():
    print("FALLBACK_FILE exists?", os.path.exists(grammarbank_store.FALLBACK_FILE))
    
    # Query Grammar Bank for default category
    items_phrases = grammarbank_store.get_items_by_category("phrases")
    items_clauses = grammarbank_store.get_items_by_category("clauses")
    print(f"Grammar Bank - Phrases count: {len(items_phrases)}")
    print(f"Grammar Bank - Clauses count: {len(items_clauses)}")
    if items_phrases:
        print(f"Sample phrase: {items_phrases[0]}")
        
    # Query Vocabulary Bank
    vocab_all = get_words_by_pos(pos=None, limit=5)
    print(f"Vocabulary Bank - All count: {len(vocab_all)}")
    if vocab_all:
        print(f"Sample vocab: {vocab_all[0]}")

if __name__ == "__main__":
    test_db_queries()
