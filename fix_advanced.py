import os
import re

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        
        # Pattern to match CP1252 mojibake for UTF-8 sequences.
        # ð = \xf0 (start of 4-byte UTF-8, e.g., emojis)
        # â = \xe2 (start of 3-byte UTF-8, e.g., symbols like quotes, arrows, euro)
        # Ã = \xc3 (start of 2-byte UTF-8, e.g., accented characters)
        pattern = re.compile(r'(?:ðŸ|â|Ã)[\x80-\xff]{1,3}')
        
        def replacer(match):
            s = match.group(0)
            try:
                # Reverse the double encoding
                return s.encode('cp1252').decode('utf-8')
            except:
                return s
                
        content = pattern.sub(replacer, content)
            
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed {filepath}')
    except Exception as e:
        print(f'Error on {filepath}: {e}')

for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.html') or file.endswith('.php') or file.endswith('.js') or file.endswith('.css'):
            fix_file(os.path.join(root, file))
