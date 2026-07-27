import os
import sys
import re

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from db.supabase_client import supabase, SUPABASE_OFFLINE
import grammarbank_store

def clean_all_items():
    print("[Clean] Loading local fallback items...")
    local_items = grammarbank_store._load_local_data()
    print(f"[Clean] Loaded {len(local_items)} local fallback items.")
    
    cleaned_count = 0
    updated_local = []
    
    # Supabase batch updates
    supabase_updates = []
    
    for item in local_items:
        original_pattern = item.get("pattern", "")
        original_slots = item.get("slot_labels") or []
        original_connector = item.get("connector_text", "")
        
        # 1. Normalize pattern and slots
        normalized_pat, normalized_slots = grammarbank_store._normalize_pattern_and_slots(original_pattern, original_slots)
        
        # Create a temp copy to extract new connector text
        temp_item = dict(item)
        temp_item["pattern"] = normalized_pat
        temp_item["slot_labels"] = normalized_slots
        
        # 2. Extract connector text if it was the full sentence or empty
        new_connector = original_connector
        # If it was empty or matched the full sentence but the pattern has slots, let's try to extract
        has_slots = bool(re.search(r'\[SLOT_\d+\]', normalized_pat))
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
            
        updated_local.append(item)
        
    print(f"[Clean] Cleaned {cleaned_count} items locally.")
    
    # Save back locally
    if cleaned_count > 0:
        grammarbank_store._save_local_data(updated_local)
        print("[Clean] Saved updated local fallback file.")
        
    # Sync with Supabase
    if not SUPABASE_OFFLINE:
        print("[Clean] Syncing changes to Supabase...")
        try:
            for item in supabase_updates:
                payload = {
                    "pattern": item["pattern"],
                    "slot_labels": item["slot_labels"],
                    "connector_text": item["connector_text"]
                }
                supabase.table("grammar_bank").update(payload).eq("id", item["id"]).execute()
            print(f"[Clean] Successfully updated {len(supabase_updates)} rows in Supabase.")
        except Exception as e:
            print(f"[Clean Error] Failed to update Supabase: {e}")
    else:
        print("[Clean] Offline mode. Skipping Supabase sync.")

if __name__ == "__main__":
    clean_all_items()
