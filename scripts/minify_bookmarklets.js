const fs = require('fs');
const path = require('path');

function minifyFile(srcPath, destPath) {
    let code = fs.readFileSync(srcPath, 'utf8');
    
    // Remove block comments
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Process line by line
    const lines = code.split(/\r?\n/);
    const outputLines = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // Remove full-line comments
        if (line.startsWith('//')) {
            continue;
        }
        
        // Remove trailing inline comments
        let commentIdx = line.indexOf('//');
        while (commentIdx !== -1) {
            // Check if it is preceded by ':' (like http:// or https://)
            if (commentIdx > 0 && line.charAt(commentIdx - 1) === ':') {
                // Find next occurrence after this URL prefix
                commentIdx = line.indexOf('//', commentIdx + 2);
            } else {
                // Truncate comment
                line = line.substring(0, commentIdx).trim();
                break;
            }
        }
        
        if (line) {
            outputLines.push(line);
        }
    }
    
    // Join with spaces and collapse multiple spaces
    let minified = outputLines.join(' ');
    while (minified.includes('  ')) {
        minified = minified.replace(/  /g, ' ');
    }
    
    // Prepend javascript: if not present
    if (!minified.startsWith('javascript:')) {
        minified = 'javascript:' + minified;
    }
    
    fs.writeFileSync(destPath, minified, 'utf8');
    console.log(`Minified ${path.basename(srcPath)} -> ${path.basename(destPath)}`);
}

function main() {
    const bookmarkletsDir = path.join(__dirname, '..', 'social-graph', 'bookmarklets');
    const files = fs.readdirSync(bookmarkletsDir);
    
    for (const file of files) {
        if (file.endsWith('.js') && !file.endsWith('.min.js')) {
            const srcPath = path.join(bookmarkletsDir, file);
            const destPath = path.join(bookmarkletsDir, file.replace('.js', '.min.js'));
            minifyFile(srcPath, destPath);
        }
    }
}

main();
