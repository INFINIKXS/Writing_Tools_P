import sys, json
sys.path.insert(0, '.')
from db.supabase_client import supabase

r = supabase.table("grammar_bank").select("id,category,pattern,connector_text,slot_labels").in_("id", ["1","4","7"]).execute()
for row in r.data:
    print(f"--- ID {row['id']} [{row['category']}] ---")
    print(f"  pattern:        {row['pattern']}")
    print(f"  connector_text: {row['connector_text']}")
    print(f"  slot_labels:    {json.dumps(row['slot_labels'], indent=4)}")
    print()
