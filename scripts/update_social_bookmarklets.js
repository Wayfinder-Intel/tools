const fs = require('fs');
const path = require('path');

function main() {
    const toolsDir = path.dirname(__dirname);
    const indexPath = path.join(toolsDir, 'index.html');

    const mappings = {
        "social-graph/bookmarklets/facebook-profile-v1.3.min.js": "bm-facebook-profile",
        "social-graph/bookmarklets/facebook-friends-v1.2.min.js": "bm-facebook-friends",
        "social-graph/bookmarklets/instagram-profile-v1.12.min.js": "bm-instagram-profile",
        "social-graph/bookmarklets/instagram-friends-v1.2.min.js": "bm-instagram-friends",
        "social-graph/bookmarklets/tiktok-profile-v1.2.min.js": "bm-tiktok-profile",
        "social-graph/bookmarklets/tiktok-friends-v1.2.min.js": "bm-tiktok-friends",
    };

    if (!fs.existsSync(indexPath)) {
        console.error(`Error: index.html not found at ${indexPath}`);
        return;
    }

    let html = fs.readFileSync(indexPath, 'utf8');
    let updatedCount = 0;

    for (const [relPath, elementId] of Object.entries(mappings)) {
        const fullPath = path.join(toolsDir, relPath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`Warning: Bookmarklet file not found at ${fullPath}`);
            continue;
        }

        let rawContent = fs.readFileSync(fullPath, 'utf8').trim();

        if (rawContent.startsWith("javascript:")) {
            rawContent = rawContent.substring("javascript:".length);
        }

        // Decode the existing partial encoding if it is encoded; otherwise use raw content
        let decoded;
        try {
            decoded = decodeURIComponent(rawContent);
        } catch (e) {
            decoded = rawContent;
        }

        // Fully encode all characters (using encodeURIComponent)
        // Custom escape function to ensure RFC 3986 compliance, matching EscapeDataString
        // encodeURIComponent leaves !, ', (, ), * unescaped, so we escape them manually
        const rfc3986Encode = (str) => {
            return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
                return '%' + c.charCodeAt(0).toString(16).toUpperCase();
            });
        };
        const fullyEncoded = "javascript:" + rfc3986Encode(decoded);

        // Replace in HTML
        const pattern1 = new RegExp(`(id="${elementId}"\\s+href=")[^"]*(")`);
        const pattern2 = new RegExp(`(href=")[^"]*("\\s+id="${elementId}")`);

        if (pattern1.test(html)) {
            html = html.replace(pattern1, `$1${fullyEncoded}$2`);
            console.log(`Updated ${elementId} in index.html (pattern 1)`);
            updatedCount++;
        } else if (pattern2.test(html)) {
            html = html.replace(pattern2, `$1${fullyEncoded}$2`);
            console.log(`Updated ${elementId} in index.html (pattern 2)`);
            updatedCount++;
        } else {
            console.warn(`Warning: Placeholder with ID '${elementId}' not found in index.html`);
        }
    }

    if (updatedCount > 0) {
        fs.writeFileSync(indexPath, html, 'utf8');
        console.log(`Success: index.html updated with ${updatedCount} bookmarklets.`);
    } else {
        console.log("No updates were made to index.html.");
    }
}

main();
