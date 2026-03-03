/**
 * TikTok OSINT Graph Logic handler
 */

class GraphApp {
    constructor() {
        this.nodes = new Map(); // id -> node data
        this.edges = new Map(); // id -> edge data {source, target, mutual}

        // Use a Set to track direct edge strings for quick mutual lookups: "source->target"
        this.edgeSet = new Set();

        this.cy = null;
        this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        this.initCy();
        this.initEventListeners();
    }

    initCy() {
        const rootStyles = getComputedStyle(document.documentElement);

        // Define stylesheet for Cytoscape
        const stylesheet = [
            {
                selector: 'node',
                style: {
                    'width': 60,
                    'height': 60,
                    'background-color': '#333',
                    'background-image': 'data(image)', // We will inject image URLs here
                    'background-fit': 'cover',
                    'border-width': 2,
                    'border-color': rootStyles.getPropertyValue('--node-border').trim(),
                    'label': function (ele) {
                        const id = ele.data('id');
                        const label = ele.data('label');
                        if (!label || id === label) return '@' + id;
                        return '@' + id + '\n' + label;
                    },
                    'text-wrap': 'wrap',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 8,
                    'color': rootStyles.getPropertyValue('--text-primary').trim(),
                    'font-size': 12,
                    'font-family': 'Inter, system-ui, sans-serif',
                    'text-background-color': rootStyles.getPropertyValue('--bg-primary').trim(),
                    'text-background-opacity': 0.8,
                    'text-background-padding': 2,
                    'text-background-shape': 'roundrectangle'
                }
            },
            {
                selector: 'node[type="seed"]',
                style: {
                    'border-width': 4,
                    'border-color': 'var(--accent-blue, #3b82f6)' // Fallback if css var broken
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': rootStyles.getPropertyValue('--edge-color').trim(),
                    'target-arrow-color': rootStyles.getPropertyValue('--edge-color').trim(),
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'arrow-scale': 1.2,
                    'opacity': 0.7
                }
            },
            {
                selector: 'edge[mutual = "true"]',
                style: {
                    'width': 4,
                    'line-color': rootStyles.getPropertyValue('--accent-blue').trim(),
                    'target-arrow-color': rootStyles.getPropertyValue('--accent-blue').trim(),
                    'source-arrow-color': rootStyles.getPropertyValue('--accent-blue').trim(),
                    'source-arrow-shape': 'triangle',
                    'opacity': 1,
                    'z-index': 10
                }
            }
        ];

        this.cy = cytoscape({
            container: document.getElementById('cy'),
            elements: [],
            style: stylesheet,
            layout: {
                name: 'cose',
                padding: 50,
                nodeRepulsion: 400000,
                idealEdgeLength: 100
            },
            wheelSensitivity: 0.2
        });
    }

    initEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        const icon = themeToggle.querySelector('i');

        themeToggle.addEventListener('click', () => {
            this.isDarkMode = !this.isDarkMode;
            document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');

            // Adjust icon
            icon.setAttribute('data-lucide', this.isDarkMode ? 'sun' : 'moon');
            lucide.createIcons();

            this.updateStylesheetForMode();
        });

        const importModeSelect = document.getElementById('import-mode');
        const targetSelectGroup = document.querySelector('.target-select-group');

        importModeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'seed') {
                targetSelectGroup.style.display = 'none';
            } else {
                targetSelectGroup.style.display = 'block';
            }
        });

        document.getElementById('import-btn').addEventListener('click', () => {
            this.handleImport();
        });

        const exportBtn = document.getElementById('dev-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const html = document.getElementById('html-paste-area').innerHTML;
                if (!html.trim()) {
                    alert("Nothing to export! Paste something first.");
                    return;
                }
                navigator.clipboard.writeText(html).then(() => {
                    alert("Raw HTML payload copied to your clipboard! Paste it to your developer to help them fix the parser.");
                });
            });
        }

        const slider = document.getElementById('k-truss-slider');
        const valDisplay = document.getElementById('k-value-display');

        slider.addEventListener('input', (e) => {
            valDisplay.textContent = e.target.value;
            // Immediate partial response could go here, for now limit to re-analysis click
        });

        document.getElementById('analyze-communities-btn').addEventListener('click', () => {
            const k = parseInt(slider.value, 10);
            this.computeKTrussAndColor(k);
        });

        document.getElementById('clear-graph-btn').addEventListener('click', () => {
            if (confirm("Are you sure you want to clear the graph?")) {
                this.cy.elements().remove();
                this.nodes.clear();
                this.edges.clear();
                this.updateStats();
                this.updateDropown();
            }
        });
    }

    updateStylesheetForMode() {
        const rootStyles = getComputedStyle(document.documentElement);

        this.cy.style()
            .selector('node')
            .style('border-color', rootStyles.getPropertyValue('--node-border').trim())
            .style('color', rootStyles.getPropertyValue('--text-primary').trim())
            .style('text-background-color', rootStyles.getPropertyValue('--bg-primary').trim())
            .selector('edge')
            .style('line-color', rootStyles.getPropertyValue('--edge-color').trim())
            .style('target-arrow-color', rootStyles.getPropertyValue('--edge-color').trim())
            .selector('edge[mutual="true"]')
            .style('line-color', rootStyles.getPropertyValue('--accent-blue').trim())
            .style('target-arrow-color', rootStyles.getPropertyValue('--accent-blue').trim())
            .style('source-arrow-color', rootStyles.getPropertyValue('--accent-blue').trim())
            .update();
    }

    updateStats() {
        document.getElementById('stat-nodes').textContent = this.cy.nodes().length;
        document.getElementById('stat-edges').textContent = this.cy.edges().length;
    }

    updateDropown() {
        const select = document.getElementById('active-seed');
        // Clear options except first
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Populate with seed nodes, or maybe all nodes
        const seeds = this.cy.nodes('[type="seed"]');
        seeds.forEach(n => {
            const data = n.data();
            const option = document.createElement('option');
            option.value = data.id;
            option.textContent = data.label + ` (@${data.id})`;
            select.appendChild(option);
        });
    }

    handleImport() {
        const mode = document.getElementById('import-mode').value;
        const targetId = document.getElementById('active-seed').value;
        const pasteArea = document.getElementById('html-paste-area');

        const html = pasteArea.innerHTML;
        if (!html) {
            alert('Please paste some HTML content first.');
            return;
        }

        if ((mode === 'following' || mode === 'followers') && !targetId) {
            alert('Please select a target node to attach these accounts to.');
            return;
        }

        const profiles = this.parseTikTokProfiles(html, mode);
        console.log(`Parsed ${profiles.length} profiles from paste.`);

        if (profiles.length === 0) {
            alert('No TikTok profiles could be parsed. Ensure you copied the elements directly from the browser.');
            return;
        }

        this.cy.batch(() => {
            profiles.forEach(p => {
                this.addNodeToGraph(p, mode === 'seed');

                if (mode === 'following') {
                    this.addEdgeToGraph(targetId, p.id);
                } else if (mode === 'followers') {
                    this.addEdgeToGraph(p.id, targetId);
                }
            });
        });

        this.cy.layout({ name: 'cose' }).run();
        this.updateStats();
        if (mode === 'seed') this.updateDropown();

        // Clear area
        pasteArea.innerHTML = '';
    }

    parseTikTokProfiles(htmlString, mode) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const profiles = [];
        const seenIds = new Set();

        // METHOD 1: TikTok E2E Data Attributes (Perfect for Seed Profile Headers)
        // TikTok explicitly labels the username and display name in the profile header
        const userTitle = doc.querySelector('[data-e2e="user-title"]');
        if (userTitle) {
            const id = userTitle.textContent.trim().replace(/^@/, '');
            const subtitle = doc.querySelector('[data-e2e="user-subtitle"]');
            const displayName = subtitle ? subtitle.textContent.trim() : id;

            // Try to find the avatar image
            const img = doc.querySelector('[data-e2e="user-avatar"] img') || doc.querySelector('img[src*="tiktokcdn"]');
            const imgUrl = img ? img.getAttribute('src') : null;

            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                profiles.push({
                    id: id,
                    label: displayName,
                    image: imgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`
                });
            }
        }

        // METHOD 2: Anchor Links (Perfect for Follower/Following Lists)
        const anchors = Array.from(doc.querySelectorAll('a'));
        anchors.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;

            // Match /@username or https://www.tiktok.com/@username
            const match = href.match(/(?:tiktok\.com)?\/@([^?/#]+)/);
            if (!match) return;

            const id = match[1];
            if (seenIds.has(id)) return;
            seenIds.add(id);

            // Try to find context for this username
            let container = a.closest('li') || a.parentElement;

            const img = container.querySelector('img');
            const imgUrl = img ? img.getAttribute('src') : null;

            const texts = Array.from(container.querySelectorAll('span, h3, h4, p'))
                .map(el => el.textContent.trim())
                .filter(t => t && t !== id);

            const displayName = texts.length > 0 ? texts[0] : id;

            profiles.push({
                id: id,
                label: displayName,
                image: imgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`
            });
        });

        // METHOD 3: Regex Fallback (Blind hunting for URLs in raw text if DOM failed)
        if (profiles.length === 0) {
            console.log("No e2e or anchor tags found, trying regex fallback");
            const regex = /(?:tiktok\.com)?\/@([^?/"\s>]+)/g;
            let match;
            while ((match = regex.exec(htmlString)) !== null) {
                const id = match[1];
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    profiles.push({
                        id: id,
                        label: id,
                        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`
                    });
                }
            }
        }

        // METHOD 4: Final Raw Text Heuristic (If user pasted pure text from terminal or similar)
        if (profiles.length === 0 && mode === 'seed') {
            console.log("Attempting raw text extraction for Seed.");
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlString;

            // Force block elements to insert newlines so they don't mash together
            const blockElements = tempDiv.querySelectorAll('h1, h2, h3, p, div, li, br');
            blockElements.forEach(el => {
                if (el.tagName === 'BR') el.replaceWith('\n');
                else el.append('\n');
            });

            const rawText = tempDiv.textContent.trim();
            if (rawText) {
                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
                if (lines.length > 0) {
                    const firstLine = lines[0];
                    const parts = firstLine.split(/\s+/);
                    const id = parts[0].replace(/[@]/g, '');

                    const displayName = parts.slice(1).join(' ') || id;

                    profiles.push({
                        id: id,
                        label: displayName,
                        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`
                    });
                }
            }
        }

        return profiles;
    }

    addNodeToGraph(profile, isSeed) {
        const existingNode = this.cy.getElementById(profile.id);
        if (!existingNode.empty()) {
            // Node already exists, potentially update it if it's now a seed
            if (isSeed) {
                existingNode.data('type', 'seed');
            }
            return;
        }

        this.cy.add({
            group: 'nodes',
            data: {
                id: profile.id,
                label: profile.label,
                type: isSeed ? 'seed' : 'normal',
                image: profile.image
            }
        });

        this.nodes.set(profile.id, profile);
    }

    addEdgeToGraph(source, target) {
        if (source === target) return;

        const edgeId = `${source}_${target}`;
        const reverseStr = `${target}->${source}`;
        const forwardStr = `${source}->${target}`;

        if (this.edgeSet.has(forwardStr)) return; // Edge already exists

        this.edgeSet.add(forwardStr);
        let isMutual = false;

        if (this.edgeSet.has(reverseStr)) {
            // Mutual relationship detected!
            isMutual = true;

            // Update the existing reverse edge to be mutual
            const reverseEdgeId = `${target}_${source}`;
            const existingReverse = this.cy.getElementById(reverseEdgeId);
            if (!existingReverse.empty()) {
                existingReverse.data('mutual', 'true');
            }
        }

        this.cy.add({
            group: 'edges',
            data: {
                id: edgeId,
                source: source,
                target: target,
                mutual: isMutual ? 'true' : 'false'
            }
        });
    }

    computeKTrussAndColor(k) {
        // Reset all nodes to base colors and unhide all edges
        this.cy.nodes().removeClass('faded');
        this.cy.edges().removeClass('faded');

        // Remove old community styles
        for (let i = 1; i <= 6; i++) {
            this.cy.nodes().removeClass(`comm-${i}`);
        }

        if (this.cy.nodes().length < 3) {
            alert('Not enough nodes for meaningful structural analysis.');
            return;
        }

        // We operate on an undirected version of the graph for classic k-truss
        const adj = new Map();

        // Ensure every node is in adj
        this.cy.nodes().forEach(n => adj.set(n.id(), new Set()));

        // Build adjacency from visible edges
        this.cy.edges().forEach(e => {
            const u = e.source().id();
            const v = e.target().id();
            if (u !== v) {
                adj.get(u).add(v);
                adj.get(v).add(u);
            }
        });

        let changed = true;

        // Iteratively remove edges that are part of < (k-2) triangles
        while (changed) {
            changed = false;

            // Collect all current undirected edges
            const currentEdges = [];
            const seenUndirected = new Set();
            for (const [u, neighbors] of adj.entries()) {
                for (const v of neighbors) {
                    const edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
                    if (!seenUndirected.has(edgeKey)) {
                        seenUndirected.add(edgeKey);
                        currentEdges.push({ u, v, key: edgeKey });
                    }
                }
            }

            const edgesToRemove = [];

            // Count triangles for each edge
            for (const edge of currentEdges) {
                const { u, v } = edge;
                let triangles = 0;

                // Intersection of neighbors of u and v
                for (const w of adj.get(u)) {
                    if (adj.get(v).has(w)) {
                        triangles++;
                    }
                }

                if (triangles < (k - 2)) {
                    edgesToRemove.push(edge);
                }
            }

            if (edgesToRemove.length > 0) {
                for (const edge of edgesToRemove) {
                    adj.get(edge.u).delete(edge.v);
                    adj.get(edge.v).delete(edge.u);
                }
                changed = true;
            }
        }

        // Now find connected components among remaining edges to define communities
        const visited = new Set();
        const components = [];

        for (const [node, neighbors] of adj.entries()) {
            if (!visited.has(node) && neighbors.size > 0) {
                const comp = [];
                const q = [node];
                visited.add(node);

                while (q.length > 0) {
                    const curr = q.shift();
                    comp.push(curr);
                    for (const nbor of adj.get(curr)) {
                        if (!visited.has(nbor)) {
                            visited.add(nbor);
                            q.push(nbor);
                        }
                    }
                }
                // Only consider substantial components
                if (comp.length >= k) {
                    components.push(comp);
                }
            }
        }

        // Sort by size descending
        components.sort((a, b) => b.length - a.length);

        console.log(`Found ${components.length} k-truss communities for k=${k}`);

        if (components.length === 0) {
            alert(`No communities found at k-truss level ${k}. Try a lower level or add more highly interconnected nodes.`);
            return;
        }

        // Color the communities (max 6 unique colors, then loop or random)
        let colorIdx = 1;

        // Dim everything first
        this.cy.nodes().addClass('faded');
        this.cy.edges().addClass('faded');

        this.cy.batch(() => {
            components.forEach(comp => {
                const cssClass = `comm-${((colorIdx - 1) % 6) + 1}`;

                // Ensure dynamic styles exist for these classes
                this.ensureCommunityStyle(cssClass, colorIdx);

                for (const nodeId of comp) {
                    const node = this.cy.getElementById(nodeId);
                    node.removeClass('faded');
                    node.addClass(cssClass);

                    // Un-fade connecting edges WITHIN the same community
                    const connectedEdges = node.connectedEdges();
                    connectedEdges.forEach(e => {
                        if (comp.includes(e.source().id()) && comp.includes(e.target().id())) {
                            e.removeClass('faded');
                        }
                    });
                }
                colorIdx++;
            });
        });
    }

    ensureCommunityStyle(className, cssVarIdx) {
        // We dynamically inject an edge update via cytoscape style chaining if not already done
        const rootStyles = getComputedStyle(document.documentElement);
        const colorVarValue = rootStyles.getPropertyValue(`--comm-${cssVarIdx > 6 ? (cssVarIdx % 6) + 1 : cssVarIdx}`).trim();

        // Since we already have basic node styling, we just update the dynamic stylesheet rules
        this.cy.style()
            .selector(`node.${className}`)
            .style('border-color', colorVarValue)
            .style('border-width', 4)
            .update();

        this.cy.style()
            .selector('.faded')
            .style('opacity', 0.2)
            .update();
    }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new GraphApp();
});
