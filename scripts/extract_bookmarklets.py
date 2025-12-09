import re
import urllib.parse
import os

def extract_bookmarklets():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find bookmarklets: href="javascript:..."
    # We look for the title/text associated with it to name the file
    
    # Pattern: <a ... href="javascript:(...)" ...>(.*?)</a>
    # This is a bit loose, but should work for this file.
    
    matches = re.finditer(r'<a\s+[^>]*href=["\']javascript:(.*?)["\'][^>]*>(.*?)</a>', content, re.DOTALL)
    
    os.makedirs('bookmarklets', exist_ok=True)
    
    count = 0
    for m in matches:
        encoded_code = m.group(1)
        label = m.group(2).strip()
        
        # Clean up label to make a filename
        filename = label.lower().replace(' ', '_').replace('/', '_').replace(':', '')
        filename = re.sub(r'[^a-z0-9_]', '', filename) + '.js'
        
        # Decode the code
        decoded_code = urllib.parse.unquote(encoded_code)
        
        # Basic formatting (optional, but nice)
        # We can just save it as is for now.
        
        path = os.path.join('bookmarklets', filename)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(decoded_code)
            
        print(f"Extracted: {filename}")
        count += 1

    print(f"Total extracted: {count}")

if __name__ == "__main__":
    extract_bookmarklets()
