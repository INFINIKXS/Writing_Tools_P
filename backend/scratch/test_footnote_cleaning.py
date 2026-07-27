import re

text_sample = (
    "Offering women informed choice and improved access to safe, high quality maternity services is a key plank of government policy.1,2 "
    "An indicator on early assessment during pregnancy is included in the Department of Health’s Public Service Agreement (PSA) targets with the Treasury.3 "
    "However, women from disadvantaged backgrounds have a higher risk of adverse maternal outcomes,4 and a recent review of maternity services highlighted short- comings in the quality of care.5 "
    "A survey of 3000 women by the National Perinatal Epidemiology Unit (NPEU) in 2006 pro- vided a national picture of maternity services and women’s experiences of them.6 "
    "The characteristics of the respondents are given in Table 6.Almost one-fifth (18.7%) of women were of minority ethnic origin (i.e. not White British)."
)

def clean_footnotes_and_spacers(text: str) -> str:
    # 1. Clean footnote numbers after letters (e.g. policy.1,2 or Treasury.3 or outcomes,4)
    text = re.sub(r'(?<=[a-zA-Z])\.[0-9]+(?:[\s,–-]*\d+)*', '.', text)
    text = re.sub(r'(?<=[a-zA-Z]),[0-9]+(?:[\s,–-]*\d+)*', ',', text)
    
    # 2. Add missing spaces after periods followed by a capital letter (e.g. Table 6.Almost -> Table 6. Almost)
    text = re.sub(r'(?<=[a-z0-9])\.([A-Z])', r'. \1', text)
    
    return text

cleaned = clean_footnotes_and_spacers(text_sample)
print("--- Cleaned Text ---")
print(cleaned)

# Check if poppler/spaCy sentence splitting on this works
import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp(cleaned)
print("\n--- Split Sentences ---")
for idx, sent in enumerate(doc.sents):
    print(f"{idx+1}: {sent.text}")
