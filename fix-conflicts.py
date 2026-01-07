#!/usr/bin/env python3
"""
Resolve all Git merge conflicts by keeping HEAD version
"""
import os
import re
from pathlib import Path

def fix_conflicts_in_file(filepath):
    """Remove merge conflict markers and keep HEAD version"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match conflict blocks
        pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> [a-f0-9]+\n'
        
        # Replace with HEAD version only
        fixed_content = re.sub(pattern, r'\1\n', content, flags=re.DOTALL)
        
        # Check if any conflicts remain
        if '<<<<<<< HEAD' in fixed_content or '=======' in fixed_content or '>>>>>>>' in fixed_content:
            print(f"❌ {filepath}: Some conflicts couldn't be automatically resolved")
            return False
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print(f"✅ {filepath}: Fixed")
        return True
    
    except Exception as e:
        print(f"❌ {filepath}: Error - {e}")
        return False

def main():
    # Find all TypeScript files with conflicts
    src_dir = Path('src')
    files_to_fix = []
    
    for ts_file in src_dir.rglob('*.ts'):
        try:
            with open(ts_file, 'r', encoding='utf-8') as f:
                content = f.read()
                if '<<<<<<< HEAD' in content:
                    files_to_fix.append(ts_file)
        except:
            continue
    
    if not files_to_fix:
        print("✅ No conflicts found!")
        return
    
    print(f"Found {len(files_to_fix)} files with conflicts:\n")
    
    fixed_count = 0
    for filepath in files_to_fix:
        if fix_conflicts_in_file(filepath):
            fixed_count += 1
    
    print(f"\n📊 Summary: Fixed {fixed_count}/{len(files_to_fix)} files")
    
    if fixed_count == len(files_to_fix):
        print("\n🎉 All conflicts resolved! Run: pnpm build")
    else:
        print("\n⚠️  Some files need manual review")

if __name__ == '__main__':
    main()
