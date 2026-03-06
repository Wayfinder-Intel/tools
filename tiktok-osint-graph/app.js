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
        this.cy = null;
        this.isDarkMode = true; // Always dark mode now

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
                    'border-color': '#94a3b8',
                    'label': function (ele) {
                        const id = ele.data('id');
                        const label = ele.data('label');
                        const isSeed = ele.data('type') === 'seed';
                        const prefix = isSeed ? '🌱 ' : '';

                        // Do not collapse identical labels so the user always sees both
                        if (!label) return prefix + '@' + id;
                        return prefix + '@' + id + '\n' + label;
                    },
                    'text-wrap': 'wrap',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 8,
                    'color': rootStyles.getPropertyValue('--text').trim() || '#e6e9f2',
                    'font-size': 12,
                    'font-family': 'Inter, system-ui, sans-serif',
                    'text-background-color': rootStyles.getPropertyValue('--bg').trim() || '#0f1115',
                    'text-background-opacity': 0.8,
                    'text-background-padding': 2,
                    'text-background-shape': 'roundrectangle'
                }
            },
            {
                selector: 'node.dot-mode',
                style: {
                    'width': 15,
                    'height': 15,
                    'background-image': 'none'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-color': rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff',
                    'border-width': 4,
                    'border-opacity': 1,
                    'box-shadow': '0px 0px 10px #2ea8ff' // Optional glow in some renderers
                }
            },
            {
                // If either followers OR following is loaded, give it a thin green border
                selector: 'node[?hasFollowers], node[?hasFollowing]',
                style: {
                    'border-width': 2,
                    'border-style': 'solid',
                    'border-color': '#22c55e'
                }
            },
            {
                // When a seed (has followers/following data) is ALSO selected, override green -> teal
                selector: 'node[?hasFollowers]:selected, node[?hasFollowing]:selected',
                style: {
                    'border-color': '#00d4c8',
                    'border-width': 4,
                    'border-opacity': 1
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#475569',
                    'target-arrow-color': '#475569',
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
                    'line-color': rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff',
                    'target-arrow-color': rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff',
                    'opacity': 1,
                    'z-index': 10
                }
            },
            {
                selector: 'node.faded',
                style: {
                    'opacity': 0.15,
                    'text-opacity': 0.15
                }
            },
            {
                selector: 'edge.faded',
                style: {
                    'opacity': 0.05
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
            wheelSensitivity: 0.2,
            selectionType: 'additive' // Cytoscape handles shift-click naturally if we let it, or we handle it manually. 'additive' means standard click behavior.
        });

        // FFP State
        this.ffpMode = 'off'; // 'off', 'both', 'followers', 'following'
        this.ffpDepth = 10;
        this.ffpGhostMode = false;
    }

    initEventListeners() {
        // UI Navigation handlers
        const topNavBtns = document.querySelectorAll('.nav-btn');
        const sidePanel = document.getElementById('side-panel');
        const panelSections = document.querySelectorAll('.panel-section');
        let activeCategory = null;

        const togglePanel = (category) => {
            if (activeCategory === category) {
                // Clicked same category, close it
                activeCategory = null;
                topNavBtns.forEach(b => b.classList.remove('active'));
                panelSections.forEach(sec => sec.classList.add('hidden'));
            } else {
                // Open new category
                activeCategory = category;

                // Update nav buttons
                topNavBtns.forEach(b => {
                    b.classList.toggle('active', b.dataset.category === category);
                });

                // Update panel sections
                panelSections.forEach(sec => {
                    if (sec.dataset.panel === category) {
                        sec.classList.remove('hidden');
                    } else {
                        sec.classList.add('hidden');
                    }
                });
            }
        };

        topNavBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePanel(btn.dataset.category);
            });
        });

        // Close panel with ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activeCategory !== null) {
                activeCategory = null;
                topNavBtns.forEach(b => b.classList.remove('active'));
                panelSections.forEach(sec => sec.classList.add('hidden'));
            }
        });

        // Placeholder subtools
        const placeholderBtns = document.querySelectorAll('.subtool-btn.placeholder-btn');
        placeholderBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.showToast(`Placeholder triggered: ${action}`);
            });
        });

        // --- Appearance Toggles Logic ---
        const avatarDotBtn = document.getElementById('avatar-dot-toggle-btn');
        this.isDotMode = false;
        if (avatarDotBtn) {
            avatarDotBtn.addEventListener('click', () => {
                this.isDotMode = !this.isDotMode;
                avatarDotBtn.classList.toggle('active', this.isDotMode);
                if (this.isDotMode) {
                    this.cy.nodes().addClass('dot-mode');
                } else {
                    this.cy.nodes().removeClass('dot-mode');
                }
                this.showToast(this.isDotMode ? 'Dot view enabled' : 'Avatar view enabled');
            });
        }

        // Tracking for simulated double-click
        let lastTapTime = 0;
        let lastTappedNode = null;

        // Close panel and clear node selections when clicking empty graph space
        this.cy.on('tap', (e) => {
            if (e.target === this.cy) {
                // Background clicked
                this.cy.nodes().unselect();

                if (activeCategory !== null) {
                    activeCategory = null;
                    topNavBtns.forEach(b => b.classList.remove('active'));
                    panelSections.forEach(sec => sec.classList.add('hidden'));
                }
            } else if (e.target.isNode()) {
                // Node clicked
                const node = e.target;
                const originalEvent = e.originalEvent;
                const now = Date.now();

                // Detect double click (300ms window) on the same node
                if (lastTappedNode === node.id() && (now - lastTapTime) < 300) {
                    // Double click: Select the node and everything it is connected to
                    // Use setTimeout to ensure our explicit select() overrides Cytoscape's native toggle unselect
                    setTimeout(() => {
                        node.select();
                        // Select edges attached to this node
                        node.connectedEdges().select();
                        // Select nodes attached to those edges
                        node.connectedEdges().connectedNodes().select();
                    }, 10);
                } else {
                    // Single click: If not holding shift/ctrl, clear others
                    if (!originalEvent.shiftKey && !originalEvent.ctrlKey && !originalEvent.metaKey) {
                        this.cy.nodes().difference(node).unselect();
                    }
                }

                lastTapTime = now;
                lastTappedNode = node.id();
            }
        });

        // --- Ingest Modal Logic ---
        const ingestModalBackdrop = document.getElementById('ingest-modal-backdrop');
        const btnCloseModal = document.getElementById('close-modal-btn');
        const btnCancelIngest = document.getElementById('cancel-ingest-btn');
        const btnSubmitIngest = document.getElementById('submit-ingest-btn');
        const radioTypes = document.querySelectorAll('input[name="ingest-type"]');
        const seedSelectGroup = document.getElementById('seed-select-group');
        let activeSubtoolBtn = null;

        const openIngestModal = (triggerBtn) => {
            activeSubtoolBtn = triggerBtn;
            triggerBtn.classList.add('active');
            ingestModalBackdrop.classList.remove('hidden');
        };

        const closeIngestModal = () => {
            if (activeSubtoolBtn) {
                activeSubtoolBtn.classList.remove('active');
                activeSubtoolBtn = null;
            }
            ingestModalBackdrop.classList.add('hidden');
        };

        // Wire Ingest Button
        const ingestBtn = document.querySelector('[data-action="Ingest"]');
        if (ingestBtn) {
            ingestBtn.addEventListener('click', () => {
                this.updateDropown(); // ensure seeds are populated
                openIngestModal(ingestBtn);
            });
        }

        btnCloseModal.addEventListener('click', closeIngestModal);
        btnCancelIngest.addEventListener('click', closeIngestModal);

        // Hide/Show seed dropdown based on type selection
        radioTypes.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'seed') {
                    seedSelectGroup.style.display = 'none';
                } else {
                    seedSelectGroup.style.display = 'flex';
                }
            });
        });

        btnSubmitIngest.addEventListener('click', () => {
            this.handleImport();
            closeIngestModal();
        });

        // Debug Paste Modal Logic
        const btnDebugPaste = document.getElementById('debug-paste-btn');
        const debugModalBackdrop = document.getElementById('debug-modal-backdrop');
        const btnCloseDebug = document.getElementById('close-debug-modal-btn');
        const btnCancelDebug = document.getElementById('cancel-debug-btn');
        const btnDownloadDebug = document.getElementById('download-debug-btn');
        let activeDebugBtn = null;

        const openDebugModal = (triggerBtn) => {
            activeDebugBtn = triggerBtn;
            triggerBtn.classList.add('active');
            debugModalBackdrop.classList.remove('hidden');
        };

        const closeDebugModal = () => {
            if (activeDebugBtn) {
                activeDebugBtn.classList.remove('active');
                activeDebugBtn = null;
            }
            debugModalBackdrop.classList.add('hidden');
        };

        if (btnDebugPaste) {
            btnDebugPaste.addEventListener('click', () => {
                openDebugModal(btnDebugPaste);
            });
        }
        btnCloseDebug.addEventListener('click', closeDebugModal);
        btnCancelDebug.addEventListener('click', closeDebugModal);

        btnDownloadDebug.addEventListener('click', () => {
            const pasteArea = document.getElementById('debug-paste-area');
            if (pasteArea && pasteArea.innerHTML.trim() !== '') {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    rawText: pasteArea.innerText || pasteArea.textContent,
                    html: pasteArea.innerHTML
                }, null, 2));
                const dlAnchorElem = document.createElement('a');
                dlAnchorElem.setAttribute("href", dataStr);
                dlAnchorElem.setAttribute("download", `tiktok_paste_debug_${new Date().getTime()}.json`);
                dlAnchorElem.click();
                this.showToast('Paste data saved to downloaded JSON file.');
                closeDebugModal();
                pasteArea.innerHTML = '';
            } else {
                this.showToast('Please paste something into the box first!');
            }
        });

        // JSON Export/Import Events
        const exportBtn = document.getElementById('export-json-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportToJSON();
            });
        }

        const importBtn = document.getElementById('import-json-btn');
        const importHidden = document.getElementById('import-json-hidden');
        if (importBtn && importHidden) {
            importBtn.addEventListener('click', () => {
                importHidden.click(); // Trigger native file dialog
            });
            importHidden.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importFromJSON(file);
                }
                // Reset input in case they want to upload the same file again later
                importHidden.value = '';
            });
        }

        // --- FFP Controls Logic ---
        const ffpToggleBtn = document.getElementById('ffp-toggle-btn');
        const ffpFollowersBtn = document.getElementById('ffp-followers-btn');
        const ffpFollowingBtn = document.getElementById('ffp-following-btn');
        const ffpDepthUp = document.getElementById('ffp-depth-up');
        const ffpDepthDown = document.getElementById('ffp-depth-down');
        const ffpDepthToast = document.getElementById('ffp-depth-toast');
        let ffpToastTimeout;

        const showDepthToast = () => {
            ffpDepthToast.textContent = this.ffpDepth;
            ffpDepthToast.classList.remove('hidden');

            if (ffpToastTimeout) clearTimeout(ffpToastTimeout);
            ffpToastTimeout = setTimeout(() => {
                ffpDepthToast.classList.add('hidden');
            }, 1500);
        };

        const ffpSubToggles = document.getElementById('ffp-sub-toggles');
        const ffpGhostBtn = document.getElementById('ffp-ghost-btn');
        let ffpHoverTimeout = null;

        const updateFFPUI = () => {
            // Reset active classes
            ffpToggleBtn.className = 'subtool-btn';
            ffpFollowersBtn.className = 'subtool-btn micro-btn';
            ffpFollowingBtn.className = 'subtool-btn micro-btn';

            if (this.ffpMode !== 'off') {
                if (this.ffpMode === 'both') {
                    // Full highlight for both
                    ffpToggleBtn.classList.add('btn-ffp-active');
                    ffpFollowersBtn.classList.add('btn-ffp-sub-active');
                    ffpFollowingBtn.classList.add('btn-ffp-sub-active');
                } else if (this.ffpMode === 'followers') {
                    // Partial highlight heart 
                    ffpToggleBtn.classList.add('btn-ffp-partial');
                    ffpFollowersBtn.classList.add('btn-ffp-sub-active');
                } else if (this.ffpMode === 'following') {
                    // Partial highlight heart
                    ffpToggleBtn.classList.add('btn-ffp-partial');
                    ffpFollowingBtn.classList.add('btn-ffp-sub-active');
                }
            }

            // Sub-toggles visibility is managed by hover now, except it always shows if ghost mode is active to give user feedback
            if (this.ffpGhostMode) {
                ffpGhostBtn.classList.add('btn-ffp-sub-active');
                ffpSubToggles.classList.remove('hidden');
            } else {
                ffpGhostBtn.classList.remove('btn-ffp-sub-active');
                if (this.ffpMode === 'off') {
                    ffpSubToggles.classList.add('hidden');
                }
            }
            // Trigger redrawing the graph edges based on new state
            this.applyFFPStyles();
        };

        // 400ms hover delay logic for FFP toggle button
        ffpToggleBtn.addEventListener('mouseenter', () => {
            if (ffpHoverTimeout) clearTimeout(ffpHoverTimeout);
            ffpHoverTimeout = setTimeout(() => {
                ffpSubToggles.classList.remove('hidden');
            }, 400);
        });

        // Hide sub-toggles when mouse leaves the whole row (unless mode is active/ghost)
        const ffpMainRow = document.querySelector('.ffp-main-row');
        ffpMainRow.addEventListener('mouseleave', () => {
            if (ffpHoverTimeout) clearTimeout(ffpHoverTimeout);
            if (this.ffpMode === 'off' && !this.ffpGhostMode) {
                ffpSubToggles.classList.add('hidden');
            }
        });

        ffpToggleBtn.addEventListener('click', () => {
            this.ffpMode = this.ffpMode === 'both' ? 'off' : 'both';
            updateFFPUI();
        });

        ffpFollowersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ffpMode = this.ffpMode === 'followers' ? 'off' : 'followers';
            updateFFPUI();
        });

        ffpFollowingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ffpMode = this.ffpMode === 'following' ? 'off' : 'following';
            updateFFPUI();
        });

        ffpDepthUp.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ffpDepth += 1;
            showDepthToast();
            if (this.ffpMode !== 'off') updateFFPUI();
        });

        ffpDepthDown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.ffpDepth > 1) {
                this.ffpDepth -= 1;
                showDepthToast();
                if (this.ffpMode !== 'off') updateFFPUI();
            }
        });

        ffpGhostBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ffpGhostMode = !this.ffpGhostMode;
            updateFFPUI();
        });

        // --- Hover Panel Logic ---
        const hoverPanel = document.getElementById('node-hover-panel');
        const hoverDisplayName = document.getElementById('hover-display-name');
        const hoverUsername = document.getElementById('hover-username');
        const hoverBio = document.getElementById('hover-bio');
        const hoverFollowing = document.getElementById('hover-following-count');
        const hoverFollowers = document.getElementById('hover-followers-count');
        const hoverIngestTime = document.getElementById('hover-ingest-time');
        const hoverCopyBtn = document.getElementById('hover-copy-btn');
        let hoverTimeout = null;
        let hoverShowTimeout = null;
        let isHoveringPanel = false;
        let activeHoverNodeData = null;

        const edgeTooltip = document.getElementById('edge-hover-tooltip');
        const edgeRankLabel = document.getElementById('edge-rank-label');
        const edgeIngestTime = document.getElementById('edge-ingest-time');

        // Keep panel open if mouse moves over the panel itself
        hoverPanel.addEventListener('mouseenter', () => {
            isHoveringPanel = true;
            if (hoverTimeout) clearTimeout(hoverTimeout);
        });

        hoverPanel.addEventListener('mouseleave', () => {
            isHoveringPanel = false;
            hoverPanel.classList.add('hidden');
        });

        this.cy.on('mouseover', 'node', (e) => {
            const node = e.target;
            if (node.data('type') !== 'seed') return; // Only show for seeds

            if (hoverTimeout) clearTimeout(hoverTimeout);
            if (hoverShowTimeout) clearTimeout(hoverShowTimeout);

            // Wait 400ms of continuous hover before showing
            hoverShowTimeout = setTimeout(() => {
                const data = node.data();
                activeHoverNodeData = data;

                // Populate Info
                hoverDisplayName.textContent = data.label || data.id;
                hoverUsername.textContent = `@${data.id}`;
                hoverBio.textContent = data.bio || "No bio available.";
                hoverFollowing.textContent = data.following || "Unknown";
                hoverFollowers.textContent = data.followers || "Unknown";

                if (data.ingestTime) {
                    try {
                        const date = new Date(data.ingestTime);
                        hoverIngestTime.textContent = date.toLocaleString();
                    } catch (e) {
                        hoverIngestTime.textContent = data.ingestTime;
                    }
                } else {
                    hoverIngestTime.textContent = "N/A";
                }

                if (data.hasFollowing) {
                    hoverFollowing.style.color = '#22c55e';
                    hoverFollowing.style.fontWeight = 'bold';
                } else {
                    hoverFollowing.style.color = '';
                    hoverFollowing.style.fontWeight = 'normal';
                }

                if (data.hasFollowers) {
                    hoverFollowers.style.color = '#22c55e';
                    hoverFollowers.style.fontWeight = 'bold';
                } else {
                    hoverFollowers.style.color = '';
                    hoverFollowers.style.fontWeight = 'normal';
                }

                // Calculate position (offset from node)
                const pos = node.renderedPosition();
                const bb = node.renderedBoundingBox();

                // Prefer placing panel to the right of the node
                let left = bb.x2 + 10;
                let top = pos.y - 50;

                // Simple viewport bounds check
                if (left + 280 > window.innerWidth) { // 280 roughly panel width
                    left = bb.x1 - 290; // flip to left side
                }
                if (top < 10) top = 10;

                hoverPanel.style.left = `${left}px`;
                hoverPanel.style.top = `${top}px`;

                hoverPanel.classList.remove('hidden');
            }, 400);
        });

        this.cy.on('mouseout', 'node', (e) => {
            const node = e.target;
            if (node.data('type') !== 'seed') return;

            if (hoverShowTimeout) clearTimeout(hoverShowTimeout); // Cancel if they leave too soon
            hoverTimeout = setTimeout(() => {
                if (!isHoveringPanel) {
                    hoverPanel.classList.add('hidden');
                    activeHoverNodeData = null;
                }
            }, 250); // slight delay to allow moving mouse to the panel
        });

        // Copy Buffer action
        hoverCopyBtn.addEventListener('click', () => {
            if (!activeHoverNodeData) return;
            let timeStr = "N/A";
            if (activeHoverNodeData.ingestTime) timeStr = new Date(activeHoverNodeData.ingestTime).toLocaleString();

            const txt = `Username: @${activeHoverNodeData.id}\nDisplay Name: ${activeHoverNodeData.label}\nFollowing: ${activeHoverNodeData.following || 'Unknown'}\nFollowers: ${activeHoverNodeData.followers || 'Unknown'}\nIngested: ${timeStr}\nBio:\n${activeHoverNodeData.bio || ''}`;

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(txt).then(() => {
                    this.showToast('Profile info copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy', err);
                    this.showToast('Failed to copy text.');
                });
            } else {
                // Fallback for non-https local files sometimes
                const textArea = document.createElement("textarea");
                textArea.value = txt;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    this.showToast('Profile info copied to clipboard!');
                } catch (err) {
                    this.showToast('Failed to copy text.');
                }
                document.body.removeChild(textArea);
            }
        });

        // --- Edge Tooltips Removed per Feedback ---
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        console.log(message);
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 300ms ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    updateStylesheetForMode() {
        const rootStyles = getComputedStyle(document.documentElement);

        this.cy.style()
            .selector('node')
            .style('border-color', rootStyles.getPropertyValue('--muted').trim() || '#94a3b8')
            .style('color', rootStyles.getPropertyValue('--text').trim() || '#e6e9f2')
            .style('text-background-color', rootStyles.getPropertyValue('--bg').trim() || '#0f1115')
            .selector('edge')
            .style('line-color', '#475569')
            .style('target-arrow-color', '#475569')
            .selector('edge[mutual="true"]')
            .style('line-color', rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff')
            .style('target-arrow-color', rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff')
            .style('source-arrow-color', rootStyles.getPropertyValue('--brand').trim() || '#2ea8ff')
            .update();
    }

    updateStats() {
        const nodeStat = document.getElementById('stat-nodes');
        const edgeStat = document.getElementById('stat-edges');
        if (nodeStat) nodeStat.textContent = this.cy.nodes().length;
        if (edgeStat) edgeStat.textContent = this.cy.edges().length;
    }

    updateDropown() {
        const select = document.getElementById('active-seed');
        if (!select) return;
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

        if (seeds.length > 0) {
            select.value = seeds.last().id();
        }
    }

    handleImport() {
        const typeSelect = document.querySelector('input[name="ingest-type"]:checked').value;
        const targetId = document.getElementById('active-seed').value;
        const pasteArea = document.getElementById('html-paste-area');
        const overlay = document.getElementById('loading-overlay');

        const html = pasteArea.innerHTML;
        const rawText = pasteArea.innerText || pasteArea.textContent;

        if (!rawText.trim() && !html.trim()) {
            this.showToast('Please paste some content first.');
            return;
        }

        if ((typeSelect === 'following' || typeSelect === 'followers') && !targetId) {
            this.showToast('Please select a target seed node.');
            return;
        }

        // Show loading
        overlay.classList.remove('hidden');

        // Let the UI render before locking the thread with parsing
        setTimeout(() => {
            const profiles = this.parseTikTokProfiles(html, rawText, typeSelect);
            console.log(`Parsed ${profiles.length} profiles from paste.`);

            // Always clear the paste area after attempting to parse, so it doesn't get stuck on failed ingests
            if (pasteArea) {
                pasteArea.innerHTML = '';
            }

            if (profiles.length === 0) {
                overlay.classList.add('hidden');
                this.showToast('No TikTok profiles could be parsed. Ensure you copied the elements directly.');
                return;
            }

            let newlyAddedElements = this.cy.collection();
            const existingNodeCount = this.cy.nodes().length;

            this.cy.batch(() => {
                // If it's a seed ingest, just add the seed node
                if (typeSelect === 'seed') {
                    profiles.forEach(p => {
                        this.addNodeToGraph(p, true);
                        newlyAddedElements.merge(this.cy.getElementById(p.id));
                    });
                } else {
                    // It's a follower/following ingest mapped to an existing seed
                    const seedNode = this.cy.getElementById(targetId);
                    if (typeSelect === 'following') seedNode.data('hasFollowing', true);
                    if (typeSelect === 'followers') seedNode.data('hasFollowers', true);

                    const totalNewProfiles = profiles.length;

                    profiles.forEach((p, index) => {
                        this.addNodeToGraph(p, false);

                        const newNode = this.cy.getElementById(p.id);
                        newlyAddedElements.merge(newNode);

                        // FFP Chronological Rank: index 0 is newest, index L-1 is oldest (Rank 1)
                        const rank = totalNewProfiles - index;
                        const rankDirection = typeSelect; // 'following' or 'followers'

                        if (typeSelect === 'following') {
                            this.addEdgeToGraph(targetId, p.id, rank, rankDirection);
                        } else {
                            this.addEdgeToGraph(p.id, targetId, rank, rankDirection);
                        }
                    });
                }
                this.updateDropown();

                // Select all newly added nodes automatically
                this.cy.nodes().unselect();
                newlyAddedElements.select();
            });

            overlay.classList.add('hidden');
            this.updateStats();

            // Only layout if this is the first ingest, otherwise leave user's manual dragging intact
            if (existingNodeCount === 0) {
                this.cy.layout({ name: 'cose', padding: 50, idealEdgeLength: 60 }).run();
            } else {
                let center = { x: 0, y: 0 };
                // If appending to a target seed, scatter around that seed
                if (typeSelect !== 'seed' && targetId) {
                    const targetSeed = this.cy.getElementById(targetId);
                    if (targetSeed && !targetSeed.empty()) {
                        center = targetSeed.position();
                    }
                } else {
                    // If adding independent seeds to an existing graph, scatter them around the center of the viewport
                    center = { x: this.cy.width() / 2, y: this.cy.height() / 2 };
                }

                newlyAddedElements.nodes().forEach(n => {
                    n.position({
                        x: center.x + (Math.random() * 300 - 150),
                        y: center.y + (Math.random() * 300 - 150)
                    });
                });
            }
            this.showToast('Ingest complete!');

            // Close the primary ingest modal backdrop as well
            const ingestModalBackdrop = document.getElementById('ingest-modal-backdrop');
            if (ingestModalBackdrop) {
                ingestModalBackdrop.classList.add('hidden');
            }

            // Remove active state from the ingest button if it's still there
            const ingestBtn = document.querySelector('[data-action="Ingest"]');
            if (ingestBtn) {
                ingestBtn.classList.remove('active');
            }

            // Re-apply FFP styles if active
            if (this.ffpMode !== 'off') {
                this.applyFFPStyles();
            }

        }, 100);
    }

    exportToJSON() {
        if (this.cy.nodes().length === 0) {
            this.showToast("No data to export!");
            return;
        }

        const graphData = this.cy.json().elements;
        const dataStr = JSON.stringify(graphData, null, 2);

        // Find seed node to name the file
        const seeds = this.cy.nodes('[type="seed"]');
        let prefix = "export";
        if (seeds.length > 0) {
            prefix = seeds.first().id();
        }

        // Generate safe timestamp string
        const date = new Date();
        const timeString = date.toISOString().replace(/[:.]/g, '-');
        const filename = `${prefix}_${timeString}.json`;

        // Create virtual download anchor
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            this.showToast(`Exported to ${filename}`);
        }, 0);
    }

    importFromJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const elements = JSON.parse(e.target.result);

                // Clear the current graph before importing to prevent ghost-data compound bugs
                this.cy.elements().remove();

                this.cy.batch(() => {
                    this.cy.add(elements);
                });

                this.updateStats();
                this.updateDropown();
                this.cy.layout({ name: 'cose', padding: 50, idealEdgeLength: 60 }).run();
                this.showToast(`Successfully imported ${file.name}`);

                // Re-apply FFP styles if active
                if (this.ffpMode !== 'off') {
                    this.applyFFPStyles();
                }

            } catch (err) {
                console.error(err);
                this.showToast("Error parsing JSON file. Is it corrupt?");
            }
        };

        reader.onerror = () => {
            this.showToast("Failed to read the file.");
        };

        reader.readAsText(file);
    }

    // --- HTML Scrape Parsing ---
    parseTikTokProfiles(htmlString, rawText, mode) {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const profiles = [];
        const seenIds = new Set();
        const ingestDateTime = new Date().toISOString();

        if (mode === 'seed') {
            // Seed parsing relies heavily on the provided text string format
            console.log("Attempting string-based Seed extraction");

            // Look for patterns like:
            // "11\nFollowing\n2206\nFollowers\n363.4K\nLikes"
            let followingCount = "Unknown";
            let followerCount = "Unknown";
            let likesCount = "Unknown";
            let bioText = "";
            let displayName = "";
            let id = "";

            const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length > 0) {
                // Usually the first line is the ID and second is the display name
                id = lines[0].replace(/[@]/g, '');

                let possibleDisplayName = id;
                if (lines.length > 1) {
                    const line2 = lines[1];
                    // If the second line is a known stats keyword or a number, the display name was omitted
                    if (!/^(?:\d+[KMBkmb]?|\d{1,3}(?:,\d{3})*|Following|Followers|Likes)$/i.test(line2)) {
                        possibleDisplayName = line2;
                    }
                }
                displayName = possibleDisplayName;

                // Hunt for stats and Bio
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase() === 'following' && i > 0) followingCount = lines[i - 1];
                    if (lines[i].toLowerCase() === 'followers' && i > 0) followerCount = lines[i - 1];
                    if (lines[i].toLowerCase() === 'likes' && i > 0) {
                        likesCount = lines[i - 1];
                        // Bio is usually whatever follows "Likes"
                        if (i + 1 < lines.length) {
                            // Reconstruct bio from the remaining lines (might include links)
                            bioText = lines.slice(i + 1).join('\n');
                        }
                    }
                }

                if (id && !seenIds.has(id)) {
                    seenIds.add(id);

                    // Try to find the avatar image from HTML if available
                    const img = doc.querySelector('img[src*="tiktokcdn"]');
                    const imgUrl = img ? img.getAttribute('src') : null;

                    profiles.push({
                        id: id,
                        label: displayName,
                        image: imgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`,
                        bio: bioText,
                        following: followingCount,
                        followers: followerCount,
                        likes: likesCount,
                        ingestTime: ingestDateTime
                    });
                }
            }
        } else {
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
                    image: imgUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
                    bio: "",
                    following: "Unknown",
                    followers: "Unknown",
                    likes: "Unknown",
                    ingestTime: ingestDateTime
                });
            });

            // Regex Fallback if DOM routing fails
            if (profiles.length === 0) {
                console.log("No anchor tags found, trying regex fallback");
                const regex = /(?:tiktok\.com)?\/@([^?/"\s>]+)/g;
                let match;
                while ((match = regex.exec(htmlString)) !== null) {
                    const id = match[1];
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        profiles.push({
                            id: id,
                            label: id,
                            image: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
                            bio: "",
                            following: "Unknown",
                            followers: "Unknown",
                            likes: "Unknown",
                            ingestTime: ingestDateTime
                        });
                    }
                }
            }
        }

        return profiles;
    }

    addNodeToGraph(profile, isSeed) {
        let node;
        this.nodes.set(profile.id, profile);

        const existingNode = this.cy.getElementById(profile.id);
        if (!existingNode.empty()) {
            node = existingNode;
            // Node already exists, potentially update it if it's now a seed
            if (isSeed) {
                node.data('type', 'seed');
            }
            // Update node fields if the new scrape had more data
            if (profile.bio) node.data('bio', profile.bio);
            if (profile.following !== 'Unknown') node.data('following', profile.following);
            if (profile.followers !== 'Unknown') node.data('followers', profile.followers);

            // Override avatar if the new profile has a real image, unconditionally overwriting whatever was there
            const newImg = profile.image || '';
            if (newImg && !newImg.includes('dicebear.com')) {
                node.data('image', newImg);
            }
        } else {
            node = this.cy.add({
                group: 'nodes',
                data: {
                    id: profile.id,
                    label: profile.label,
                    type: isSeed ? 'seed' : 'normal',
                    image: profile.image,
                    bio: profile.bio || "",
                    following: profile.following || "Unknown",
                    followers: profile.followers || "Unknown",
                    likes: profile.likes || "Unknown",
                    ingestTime: profile.ingestTime || new Date().toISOString()
                }
            });
        }

        if (this.isDotMode) {
            node.addClass('dot-mode');
        }

    }

    addEdgeToGraph(source, target, rank = null, rankDirection = null) {
        if (source === target) return;

        const edgeId = `${source}_${target}`;
        const reverseStr = `${target}->${source}`;
        const forwardStr = `${source}->${target}`;

        if (this.edgeSet.has(forwardStr)) return; // Logic check
        if (!this.cy.getElementById(edgeId).empty()) return; // Cytoscape strict element check

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
                mutual: isMutual ? 'true' : 'false',
                ffpRank: rank,
                ffpDirection: rankDirection,
                ingestedAt: new Date().toISOString()
            }
        });
    }

    applyFFPStyles() {
        // Reset old inline styles
        this.cy.edges().removeStyle('line-color');
        this.cy.edges().removeStyle('target-arrow-color');
        this.cy.edges().removeClass('faded');
        this.cy.nodes().removeClass('faded');

        if (this.ffpMode === 'off') {
            return; // Back to default
        }

        const maxRank = this.ffpDepth;

        // Gradient generator: Rank 1 (Hot Pink) -> Rank N (Deep Blue) passing through Red/Orange/Green
        const getGradientColor = (rank) => {
            if (maxRank <= 1) return '#ec4899'; // Hot pink

            const rawRatio = (rank - 1) / (maxRank - 1);

            // Map 0 ratio -> Hue 340 (Pink/Red)
            // Map 1 ratio -> Hue 200 (Deep Blue)
            // This sweeps completely across the high-contrast visible spectrum
            const hue = Math.round(340 - (rawRatio * 140));

            // HSL: Hue (calculated), Saturation (90% to keep it vivid), Lightness (60% to pop on dark mode)
            return `hsl(${hue}, 90%, 60%)`;
        };

        this.cy.batch(() => {
            const allEdges = this.cy.edges();
            allEdges.addClass('faded'); // Fade everything first

            // Collection to track which nodes are part of currently active FFP edges
            const activeNodes = this.cy.collection();

            allEdges.forEach(edge => {
                const rank = edge.data('ffpRank');
                const dir = edge.data('ffpDirection');

                // Filter by mode
                if (this.ffpMode === 'followers' && dir !== 'followers') return;
                if (this.ffpMode === 'following' && dir !== 'following') return;

                // Check depth threshold
                if (rank != null && rank <= maxRank) {
                    edge.removeClass('faded');
                    const color = getGradientColor(rank);
                    edge.style('line-color', color);
                    edge.style('target-arrow-color', color);

                    // Track nodes attached to visible FFP edges
                    activeNodes.merge(edge.source());
                    activeNodes.merge(edge.target());
                }
            });

            // If ghost mode is active, fade nodes that aren't part of active FFP edges
            if (this.ffpGhostMode) {
                this.cy.nodes().addClass('faded'); // Fade all initially
                activeNodes.removeClass('faded'); // Unfade active ones
            } else {
                this.cy.nodes().removeClass('faded'); // Unfade all
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
