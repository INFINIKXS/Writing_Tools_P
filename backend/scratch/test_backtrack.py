import re
import time

# Create a sample text that causes backtracking
table_text = "1.2 3.4 5.6 7.8 9.0 " * 2000
test_text = "policy.1,2 " + table_text

print(f"Test text length: {len(test_text)}")

# Non-backtracking pattern (requiring at least one separator in the repetition)
pattern_safe = r'(?<=[a-zA-Z])\.[0-9]+(?:[\s,–-]+\d+)*'

t0 = time.time()
cleaned_safe = re.sub(pattern_safe, '.', test_text)
t1 = time.time()
print(f"Safe pattern took: {t1 - t0:.6f} seconds")
print(f"Cleaned start: {cleaned_safe[:100]}")
