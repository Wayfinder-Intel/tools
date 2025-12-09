import os
import urllib.parse

def build_bookmarklets():
    bookmarklets_dir = 'bookmarklets'
    index_file = 'index.html'
    
    if not os.path.exists(bookmarklets_dir):
        print(f"Directory {bookmarklets_dir} not found.")
        return

    # Map filenames to their placeholders or IDs in index.html
    # For simplicity, this script just prints the encoded strings for now
    # In a real scenario, we'd parse index.html and replace the hrefs.
    
    print("--- Bookmarklet Codes ---")
    
    for filename in os.listdir(bookmarklets_dir):
        if not filename.endswith('.js'):
            continue
            
        path = os.path.join(bookmarklets_dir, filename)
        with open(path, 'r', encoding='utf-8') as f:
            code = f.read()
            
        # Minify simple: remove comments and newlines (basic)
        # This is very basic minification.
        minified = code
        # Remove single line comments // ...
        minified = "\n".join([line.split('//')[0] for line in minified.split('\n')])
        # Remove newlines and extra spaces
        minified = minified.replace('\n', ' ').replace('\r', '')
        while '  ' in minified:
            minified = minified.replace('  ', ' ')
            
        encoded = "javascript:" + urllib.parse.quote(minified)
        
        print(f"\n[{filename}]:\n{encoded}\n")

if __name__ == "__main__":
    build_bookmarklets()
