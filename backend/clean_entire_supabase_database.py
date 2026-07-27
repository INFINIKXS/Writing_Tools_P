import os
import sys
import re

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from db.supabase_client import supabase, SUPABASE_OFFLINE
import grammarbank_store

def clean_entire_db():
    if SUPABASE_OFFLINE:
        print("[Error] Supabase is offline. Cannot run online database cleanup.")
        return
        
    print("[Clean DB] Fetching all items from Supabase...")
    all_items = []
    limit = 1000
    offset = 0
    while True:
        result = supabase.table("grammar_bank").select("*").range(offset, offset + limit - 1).execute()
        if not result.data:
            break
        all_items.extend(result.data)
        print(f"  - Loaded {len(all_items)} items...")
        if len(result.data) < limit:
            break
        offset += limit
        
    print(f"[Clean DB] Total loaded from database: {len(all_items)}")
    
    cleaned_count = 0
    supabase_updates = []
    
    for item in all_items:
        original_pattern = item.get("pattern", "")
        original_slots = item.get("slot_labels") or []
        original_connector = item.get("connector_text", "")
        
        # 1. Normalize pattern and slots (standardize brackets, slot numbering)
        normalized_pat, normalized_slots = grammarbank_store._normalize_pattern_and_slots(original_pattern, original_slots)
        
        # Create a temp copy to extract new connector text
        temp_item = dict(item)
        temp_item["pattern"] = normalized_pat
        temp_item["slot_labels"] = normalized_slots
        
        # 2. Extract connector text if it was the full sentence or empty
        new_connector = original_connector
        has_slots = bool(re.search(r'\[SLOT_\d+\]', normalized_pat))
        
        # If the connector text is empty, or is the full sentence, we extract the verbatim phrase
        if has_slots and (not original_connector or original_connector.strip() == item.get("example", "").strip()):
            new_connector = grammarbank_store._extract_connector_text(temp_item)
            
        # Check if anything changed
        changed = (
            original_pattern != normalized_pat or
            original_slots != normalized_slots or
            original_connector != new_connector
        )
        
        if changed:
            item["pattern"] = normalized_pat
            item["slot_labels"] = normalized_slots
            item["connector_text"] = new_connector
            cleaned_count += 1
            supabase_updates.append(item)
            
    print(f"[Clean DB] Cleaned {cleaned_count} items locally. Syncing updates to Supabase...")
    
    # Update Supabase rows
    updated_in_db = 0
    for item in supabase_updates:
        try:
            payload = {
                "pattern": item["pattern"],
                "slot_labels": item["slot_labels"],
                "connector_text": item["connector_text"]
            }
            supabase.table("grammar_bank").update(payload).eq("id", item["id"]).execute()
            updated_in_db += 1
        except Exception as e:
            print(f"  - Failed to update row ID {item['id']}: {e}")
            
    print(f"[Clean DB] Successfully synced {updated_in_db} updates to Supabase.")
    
    # Save the complete cleaned state to the local fallback JSON file
    # This ensures local fallback has ALL 2,132 cleaned rows!
    grammarbank_store._save_local_data(all_items)
    print(f"[Clean DB] Wrote all {len(all_items)} cleaned items to {grammarbank_store.FALLBACK_FILE}")

if __name__ == "__main__":
    clean_entire_db()
