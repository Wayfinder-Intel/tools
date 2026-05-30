const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function main() {
    const toolsDir = path.dirname(__dirname);
    const scriptsDir = __dirname;
    const socialGraphDir = path.join(toolsDir, 'social-graph');
    const bookmarkletsDir = path.join(socialGraphDir, 'bookmarklets');

    console.log("--- Bumping versions by 0.1 ---");

    // 1. Bump package.json (1.1.0 -> 1.2.0)
    const pkgPath = path.join(socialGraphDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const oldVer = pkg.version;
        pkg.version = "1.2.0";
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", 'utf8');
        console.log(`Bumped social-graph/package.json: ${oldVer} -> ${pkg.version}`);
    }

    // 2. Bump social-graph/index.html (Version 2.0 -> Version 2.1)
    const graphIndexPath = path.join(socialGraphDir, 'index.html');
    if (fs.existsSync(graphIndexPath)) {
        let indexHtml = fs.readFileSync(graphIndexPath, 'utf8');
        indexHtml = indexHtml.replace('Version 2.0', 'Version 2.1');
        fs.writeFileSync(graphIndexPath, indexHtml, 'utf8');
        console.log(`Bumped social-graph/index.html to Version 2.1`);
    }

    // 3. Process bookmarklets
    const bookmarkletFiles = [
        { name: 'facebook-friends', oldVer: '1.1', newVer: '1.2' },
        { name: 'facebook-profile', oldVer: '1.1', newVer: '1.2' },
        { name: 'instagram-friends', oldVer: '1.1', newVer: '1.2' },
        { name: 'instagram-profile', oldVer: '1.11', newVer: '1.12' },
        { name: 'tiktok-friends', oldVer: '1.1', newVer: '1.2' },
        { name: 'tiktok-profile', oldVer: '1.1', newVer: '1.2' }
    ];

    bookmarkletFiles.forEach(bm => {
        const oldFile = `${bm.name}-v${bm.oldVer}.js`;
        const newFile = `${bm.name}-v${bm.newVer}.js`;
        const oldPath = path.join(bookmarkletsDir, oldFile);
        const newPath = path.join(bookmarkletsDir, newFile);

        if (fs.existsSync(oldPath)) {
            let code = fs.readFileSync(oldPath, 'utf8');
            
            // Replace comments and internal UI strings globally
            const escapedOldVer = bm.oldVer.replace(/\./g, '\\.');
            code = code.replace(new RegExp(`Version:\\s*${escapedOldVer}`, 'g'), `Version: ${bm.newVer}`);
            code = code.replace(new RegExp(`v${escapedOldVer}`, 'g'), `v${bm.newVer}`);

            fs.writeFileSync(newPath, code, 'utf8');
            console.log(`Created new bookmarklet source: ${newFile}`);

            // Delete old files
            fs.unlinkSync(oldPath);
            const oldMinPath = oldPath.replace('.js', '.min.js');
            if (fs.existsSync(oldMinPath)) {
                fs.unlinkSync(oldMinPath);
            }
            console.log(`Deleted old files for: ${oldFile}`);
        } else {
            console.warn(`Warning: Could not find old bookmarklet file ${oldPath}`);
        }
    });

    // 4. Update tools/scripts/update_social_bookmarklets.js mappings
    const updateScriptPath = path.join(scriptsDir, 'update_social_bookmarklets.js');
    if (fs.existsSync(updateScriptPath)) {
        let updateScript = fs.readFileSync(updateScriptPath, 'utf8');
        bookmarkletFiles.forEach(bm => {
            const oldMap = `social-graph/bookmarklets/${bm.name}-v${bm.oldVer}.min.js`;
            const newMap = `social-graph/bookmarklets/${bm.name}-v${bm.newVer}.min.js`;
            updateScript = updateScript.replace(oldMap, newMap);
        });
        fs.writeFileSync(updateScriptPath, updateScript, 'utf8');
        console.log(`Updated mappings in update_social_bookmarklets.js`);
    }

    // 5. Run minify_bookmarklets.js
    console.log("Running minify_bookmarklets.js...");
    execSync('node minify_bookmarklets.js', { cwd: scriptsDir, stdio: 'inherit' });

    // 6. Run update_social_bookmarklets.js
    console.log("Running update_social_bookmarklets.js...");
    execSync('node update_social_bookmarklets.js', { cwd: scriptsDir, stdio: 'inherit' });

    console.log("--- Bumping complete! ---");
}

main();
