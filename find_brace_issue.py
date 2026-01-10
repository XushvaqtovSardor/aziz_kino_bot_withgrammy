#!/usr/bin/env python3
"""Find brace mismatch in TypeScript file"""

with open('src/modules/admin/admin.handler.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

opens = 0
closes = 0
for i, line in enumerate(lines, 1):
    opens_in_line = line.count('{')
    closes_in_line = line.count('}')
    opens += opens_in_line
    closes += closes_in_line
    balance = opens - closes
    
    # Print when balance changes significantly or around problem areas
    if i >= 4965 and i <= 4980:
        print(f"Line {i}: +{opens_in_line} -{closes_in_line} = balance:{balance} | {line.rstrip()[:80]}")
    
    # Print the first few where things go negative or very unbalanced
    if balance < 0:
        print(f"ERROR Line {i}: NEGATIVE BALANCE {balance}")
        print(f"  {line.rstrip()}")
        break

print(f"\nFinal: {opens} opens, {closes} closes, balance: {opens - closes}")
