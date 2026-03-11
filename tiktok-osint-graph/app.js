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
    this.isDarkMode = true; // Still used by some logic, but moving toward tracking light mode
    this.isLightMode = false;

    this.initCy();
    this.initEventListeners();
  }

  initCy() {
    const rootStyles = getComputedStyle(document.documentElement);
    const brandColor =
      rootStyles.getPropertyValue("--brand").trim() || "#2ea8ff";

    // Define stylesheet for Cytoscape
    const stylesheet = [
      {
        selector: "node",
        style: {
          width: 60,
          height: 60,
          "background-color": "#333",
          "background-image": "data(image)", // We will inject image URLs here
          "background-fit": "cover",
          "border-width": 2,
          "border-color": "#94a3b8",
          label: function (ele) {
            const id = ele.data("id");
            const label = ele.data("label");
            const isSeed = ele.data("type") === "seed";
            const isLocked = ele.data("locked");
            let prefix = isSeed ? "🌱 " : "";

            let displayLabelStr = prefix + "@" + id;
            if (label) {
              displayLabelStr += "\n" + label;
            }
            if (isLocked) {
              displayLabelStr += " 🔒";
            }
            return displayLabelStr;
          },
          "text-wrap": "wrap",
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 8,
          color: rootStyles.getPropertyValue("--text").trim() || "#e6e9f2",
          "font-size": 12,
          "font-family": "Inter, system-ui, sans-serif",
          "text-background-color":
            rootStyles.getPropertyValue("--bg").trim() || "#0f1115",
          "text-background-opacity": 0.8,
          "text-background-padding": 2,
          "text-background-shape": "roundrectangle",
        },
      },
      {
        // All seed nodes get a thin green border
        selector: 'node[type="seed"]',
        style: {
          "border-width": 2,
          "border-style": "solid",
          "border-color": "#22c55e",
        },
      },
      {
        selector: "node:selected",
        style: {
          "border-color": brandColor,
          "border-width": 4,
          "background-color": brandColor,
          "border-opacity": 1,
        },
      },
      {
        selector: 'node[type="seed"]:selected',
        style: {
          "border-color": "#14b8a6",
          "background-color": "#14b8a6",
        },
      },
      {
        selector: "node.dot-mode",
        style: {
          width: 15,
          height: 15,
          "background-image": function (ele) {
            return ele.data("avatar") || "none";
          },
          "background-fit": "cover",
          "background-clip": "node",
          "border-width": 2,
        },
      },
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "#334155",
          "target-arrow-color": "#334155",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 1.2,
          opacity: 0.7,
        },
      },
      {
        selector: 'edge[mutual = "true"]',
        style: {
          width: 2,
          "line-color": "#475569",
          "target-arrow-color": "#475569",
          opacity: 0.8,
          "z-index": 5,
        },
      },
      {
        selector: "edge.connected-selected",
        style: {
          width: 3,
          "line-color": brandColor,
          "target-arrow-color": brandColor,
          "source-arrow-color": brandColor,
          opacity: 1,
          "z-index": 10,
        },
      },
      {
        selector: "node.faded",
        style: {
          opacity: 0.15,
          "text-opacity": 0.15,
        },
      },
      {
        selector: "edge.faded",
        style: {
          opacity: 0.05,
        },
      },
      {
        selector: "node.ktruss-highlight",
        style: {
          "z-index": 20,
        },
      },
      {
        selector: "edge.ktruss-highlight",
        style: {
          width: 2,
          "line-color": "#a855f7",
          "target-arrow-color": "#a855f7",
          opacity: 1,
          "z-index": 20,
        },
      },
      {
        selector: "node.ktruss-faded",
        style: {
          opacity: 0.1,
          "text-opacity": 0.1,
        },
      },
      {
        selector: "edge.ktruss-faded",
        style: {
          opacity: 0.05,
        },
      },
      {
        selector: "edge.manual-link",
        style: {
          "line-color": "#f59e0b",
          "target-arrow-color": "#f59e0b",
          "source-arrow-color": "#f59e0b",
          width: 2,
        },
      },
      {
        selector: "edge.line-solid",
        style: {
          "line-style": "solid",
        },
      },
      {
        selector: "edge.line-dotted",
        style: {
          "line-style": "dotted",
          "line-dash-pattern": [2, 12],
        },
      },
      {
        selector: "edge.line-dashed",
        style: {
          "line-style": "dashed",
          "line-dash-pattern": [8, 8],
        },
      },
      {
        selector: "edge.arrow-none",
        style: {
          "target-arrow-shape": "none",
          "source-arrow-shape": "none",
        },
      },
      {
        selector: "edge.arrow-both",
        style: {
          "target-arrow-shape": "triangle",
          "source-arrow-shape": "triangle",
        },
      },
      {
        selector: "edge.arrow-left",
        style: {
          "target-arrow-shape": "none",
          "source-arrow-shape": "triangle",
        },
      },
      {
        selector: "edge.arrow-right",
        style: {
          "target-arrow-shape": "triangle",
          "source-arrow-shape": "none",
        },
      },
    ];

    this.cy = cytoscape({
      container: document.getElementById("cy"),
      elements: [],
      style: stylesheet,
      layout: {
        name: "cose",
        padding: 50,
        nodeRepulsion: 400000,
        idealEdgeLength: 100,
      },
      wheelSensitivity: 0.2,
      selectionType: "additive", // Cytoscape handles shift-click naturally if we let it, or we handle it manually. 'additive' means standard click behavior.
    });

    let isDragging = false;
    this.cy.on("grab", "node", (e) => {
      // If user grabs a selection containing locked nodes, Cytoscape blocks the entire drag.
      // We fix this by immediately unselecting any locked nodes when a grab starts.
      const selectedLocked = this.cy
        .nodes(":selected")
        .filter((n) => n.data("locked"));
      if (selectedLocked.length > 0) {
        selectedLocked.unselect();
      }

      if (!isDragging) {
        isDragging = true;
        this.saveState();
      }
    });
    this.cy.on("free", "node", (e) => {
      setTimeout(() => {
        isDragging = false;
      }, 50);
    });

    // FFP State
    this.ffpMode = "off"; // 'off', 'both', 'followers', 'following'
    this.ffpDepth = 10;

    this.ffpRankLabelMode = false;
    this.globalGhostMode = false;
    this.snapToGrid = false; // Add snap to grid state
    this.ktrussMode = false;
    this.ktrussK = 3;

    // Track edges efficiently: 'sourceId->targetId'e
    this.showMutuals = false;

    // Manual Link Drawing State
    this.drawLinkMode = false;
    this.drawLinkSourceNode = null;

    // Undo State
    this.undoStack = [];
  }

  saveState() {
    // limit stack size to 20 to prevent runaway memory usage
    if (this.undoStack.length >= 20) {
      this.undoStack.shift();
    }

    // DEEP CLONE the graph data! Otherwise Cytoscape returns live object references
    // that get mutated by future selections and drags, ruining the undo history.
    const graphData = JSON.parse(JSON.stringify(this.cy.json().elements || {}));

    this.undoStack.push({
      elements: graphData,
      uiState: {
        ffpMode: this.ffpMode,
        ffpDepth: this.ffpDepth,
        ffpRankLabelMode: this.ffpRankLabelMode,
        ktrussMode: this.ktrussMode,
        ktrussK: this.ktrussK,
        isDotMode: this.isDotMode,
        isLightMode: this.isLightMode,
        globalGhostMode: this.globalGhostMode,
        showMutuals: this.showMutuals,
        // Note: drawLinkMode intentionally excluded — undo should not restore UI draw mode
      },
    });

    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) undoBtn.classList.remove("disabled");
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.showToast("Nothing to undo!");
      return;
    }

    const state = this.undoStack.pop();

    if (this.undoStack.length === 0) {
      const undoBtn = document.getElementById("undo-btn");
      if (undoBtn) undoBtn.classList.add("disabled");
    }

    this.cy.batch(() => {
      this.cy.elements().remove();

      // Just like import JSON, restore from the flat array structure
      let elements = [
        ...(state.elements.nodes || []),
        ...(state.elements.edges || []),
      ];

      this.cy.add(elements);

      // IMPORTANT: Cytoscape's cy.add() does accept `classes` in the spec,
      // but after a JSON round-trip the classes field is a string and may not
      // always be reapplied correctly (especially for locked/manual edges).
      // We explicitly re-apply classes from the snapshot to guarantee fidelity.
      elements.forEach((elSpec) => {
        if (!elSpec.classes) return;
        const el = this.cy.getElementById(elSpec.data.id);
        if (!el || el.length === 0) return;

        // Reset to only the classes from the saved snapshot
        // (Cytoscape uses classes('') to clear, not removeAllClasses)
        el.classes(elSpec.classes);

        // Also re-apply native cytoscape lock state for locked nodes
        if (elSpec.data && elSpec.data.locked) {
          el.lock();
        } else {
          el.unlock();
        }
      });

      this.edgeSet.clear();
      this.cy.edges().forEach((edge) => {
        const s = edge.data("source");
        const t = edge.data("target");
        if (s && t) this.edgeSet.add(`${s}->${t}`);
      });
    });

    // Restore UI State
    if (state.uiState) {
      this.ffpMode =
        state.uiState.ffpMode !== undefined ? state.uiState.ffpMode : "off";
      this.ffpDepth =
        state.uiState.ffpDepth !== undefined ? state.uiState.ffpDepth : 10;
      this.ffpRankLabelMode =
        state.uiState.ffpRankLabelMode !== undefined
          ? state.uiState.ffpRankLabelMode
          : false;
      this.ktrussMode =
        state.uiState.ktrussMode !== undefined
          ? state.uiState.ktrussMode
          : false;
      this.ktrussK =
        state.uiState.ktrussK !== undefined ? state.uiState.ktrussK : 3;

      if (state.uiState.isDotMode !== undefined) {
        this.isDotMode = state.uiState.isDotMode;
        const avatarDotBtn = document.getElementById("avatar-dot-toggle-btn");
        if (avatarDotBtn)
          avatarDotBtn.classList.toggle("active", this.isDotMode);

        if (this.isDotMode) {
          this.cy.nodes().addClass("dot-mode");
        } else {
          this.cy.nodes().removeClass("dot-mode");
        }
      }
      if (state.uiState.isLightMode !== undefined) {
        this.isLightMode = state.uiState.isLightMode;
        if (this.isLightMode) {
          document.documentElement.classList.add("light-mode");
          document.body.classList.add("light-mode");
        } else {
          document.documentElement.classList.remove("light-mode");
          document.body.classList.remove("light-mode");
        }
        this.updateStylesheetForMode();
      }
      if (state.uiState.globalGhostMode !== undefined) {
        this.globalGhostMode = state.uiState.globalGhostMode;
        const ghostBtn = document.getElementById("global-ghost-btn");
        if (ghostBtn) ghostBtn.classList.toggle("active", this.globalGhostMode);
        this.updateGlobalGhost();
      }
      // Always exit draw-link mode on undo — never restore this transient UI state
      this.drawLinkMode = false;
      this.drawLinkSourceNode = null;
      const drawBtn = document.getElementById("draw-link-btn");
      if (drawBtn) drawBtn.classList.remove("active");
      document.getElementById("cy")?.classList.remove("cursor-crosshair");
      if (state.uiState.showMutuals !== undefined) {
        this.showMutuals = state.uiState.showMutuals;
        const mutualBtn = document.getElementById("highlight-mutuals-btn");
        if (mutualBtn) mutualBtn.classList.toggle("active", this.showMutuals);
        this.updateStylesheetForMode();
      }
      if (typeof this.updateFFPUI === "function") {
        this.updateFFPUI();
      }
      if (typeof this.updateKTrussUI === "function") {
        this.updateKTrussUI();
      }
    }

    this.updateStats();
    this.updateDropown();
    this.showToast("Undo successful");
  }

  initEventListeners() {
    // UI Navigation handlers
    const topNavBtns = document.querySelectorAll(".nav-btn");
    const sidePanel = document.getElementById("side-panel");
    const panelSections = document.querySelectorAll(".panel-section");
    let activeCategory = null;

    const togglePanel = (category) => {
      if (activeCategory === category) {
        // Clicked same category, close it
        activeCategory = null;
        topNavBtns.forEach((b) => b.classList.remove("active"));
        panelSections.forEach((sec) => sec.classList.add("hidden"));
      } else {
        // Open new category
        activeCategory = category;

        // Update nav buttons
        topNavBtns.forEach((b) => {
          b.classList.toggle("active", b.dataset.category === category);
        });

        // Update panel sections
        panelSections.forEach((sec) => {
          if (sec.dataset.panel === category) {
            sec.classList.remove("hidden");
          } else {
            sec.classList.add("hidden");
          }
        });
      }
    };

    topNavBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePanel(btn.dataset.category);
      });
    });

    // Close panel with ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (activeCategory !== null) {
          activeCategory = null;
          topNavBtns.forEach((b) => b.classList.remove("active"));
          panelSections.forEach((sec) => sec.classList.add("hidden"));
        } else {
          // ESC clears selection when no panel is open
          this.cy.nodes().unselect();
          this.cy.edges().unselect();
        }
      }
    });

    // Delete currently selected nodes on backspace/delete
    document.addEventListener("keydown", (e) => {
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        e.target === document.body
      ) {
        const selected = this.cy.$(":selected");
        if (selected.length > 0) {
          this.saveState();
          this.cy.remove(selected);

          // Cleanup edgeSet
          this.edgeSet.clear();
          this.cy.edges().forEach((edge) => {
            const s = edge.data("source");
            const t = edge.data("target");
            if (s && t) this.edgeSet.add(`${s}->${t}`);
          });

          this.updateStats();
        }
      }
    });

    // Placeholder subtools
    const placeholderBtns = document.querySelectorAll(
      ".subtool-btn.placeholder-btn",
    );
    placeholderBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        this.showToast(`Placeholder triggered: ${action}`);
      });
    });

    // --- Appearance Toggles Logic ---
    const avatarDotBtn = document.getElementById("avatar-dot-toggle-btn");
    this.isDotMode = false;
    if (avatarDotBtn) {
      avatarDotBtn.addEventListener("click", () => {
        this.isDotMode = !this.isDotMode;
        avatarDotBtn.classList.toggle("active", this.isDotMode);
        if (this.isDotMode) {
          this.cy.nodes().addClass("dot-mode");
        } else {
          this.cy.nodes().removeClass("dot-mode");
        }
        this.updateStylesheetForMode();
        this.showToast(
          this.isDotMode ? "Dot view enabled" : "Avatar view enabled",
        );
      });
    }

    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        this.isLightMode = !this.isLightMode;
        const icon = themeToggleBtn.querySelector("i");
        if (this.isLightMode) {
          document.documentElement.classList.add("light-mode");
          document.body.classList.add("light-mode");
          if (icon) {
            icon.setAttribute("data-lucide", "moon");
            lucide.createIcons(); // refresh icon
          }
        } else {
          document.documentElement.classList.remove("light-mode");
          document.body.classList.remove("light-mode");
          if (icon) {
            icon.setAttribute("data-lucide", "sun");
            lucide.createIcons(); // refresh icon
          }
        }
        this.updateStylesheetForMode();
        if (this.ffpMode !== "off") this.applyFFPStyles();
        this.showToast(
          this.isLightMode ? "White Mode enabled" : "Dark Mode enabled",
        );
      });
    }

    const highlightMutualsBtn = document.getElementById(
      "highlight-mutuals-btn",
    );
    if (highlightMutualsBtn) {
      highlightMutualsBtn.addEventListener("click", () => {
        this.showMutuals = !this.showMutuals;
        highlightMutualsBtn.classList.toggle("active", this.showMutuals);
        this.updateStylesheetForMode();
        this.showToast(
          this.showMutuals
            ? "Mutual connections highlighted"
            : "Mutual connections faded to default",
        );
      });
    }

    const globalGhostBtn = document.getElementById("global-ghost-btn");
    if (globalGhostBtn) {
      globalGhostBtn.addEventListener("click", () => {
        this.globalGhostMode = !this.globalGhostMode;
        globalGhostBtn.classList.toggle("active", this.globalGhostMode);
        this.updateGlobalGhost();
      });
    }

    const shortestRouteBtn = document.getElementById("shortest-route-btn");
    if (shortestRouteBtn) {
      shortestRouteBtn.addEventListener("click", () => {
        this.calculateShortestRoute();
      });
    }

    const selectSeedsBtn = document.getElementById("select-seeds-btn");
    if (selectSeedsBtn) {
      selectSeedsBtn.addEventListener("click", () => {
        const seedNodes = this.cy.nodes('[type="seed"]');
        if (seedNodes.length === 0) {
          this.showToast("No seeds found in current graph.");
          return;
        }
        // Save state just in case they want to undo the selection drop, though
        // selection isn't strictly tracked in the undo stack currently, it's good practice
        // if we ever add selection to the state snapshot.
        this.cy.elements().unselect();
        seedNodes.select();
        this.showToast(`Selected ${seedNodes.length} seed node(s).`);
      });
    }

    const selectSingletonsBtn = document.getElementById(
      "select-singletons-btn",
    );
    if (selectSingletonsBtn) {
      selectSingletonsBtn.addEventListener("click", () => {
        // Find nodes with exactly 1 connected edge
        const singletons = this.cy
          .nodes()
          .filter((node) => node.connectedEdges().length === 1);
        if (singletons.length === 0) {
          this.showToast("No singletons found in current graph.");
          return;
        }
        this.cy.elements().unselect();
        singletons.select();
        this.showToast(`Selected ${singletons.length} singleton node(s).`);
      });
    }

    const inverseSelectBtn = document.getElementById("inverse-select-btn");
    if (inverseSelectBtn) {
      inverseSelectBtn.addEventListener("click", () => {
        const selected = this.cy.elements(":selected");
        const unselected = this.cy.elements().difference(selected);

        this.cy.elements().unselect();
        unselected.select();

        this.showToast(
          `Inverted selection: ${unselected.length} element(s) selected.`,
        );
      });
    }

    // Tracking for simulated double-click
    let lastTapTime = 0;
    let lastTappedNode = null;
    let singleTapTimeout = null;

    // Clear node selections when clicking empty graph space (but do NOT close nav panels)
    this.cy.on("tap", (e) => {
      if (e.target === this.cy) {
        // Background clicked — only deselect nodes
        this.cy.nodes().unselect();
      } else if (e.target.isNode()) {
        // Node clicked
        const node = e.target;
        const originalEvent = e.originalEvent;
        const now = Date.now();

        // Detect double click (300ms window) on the same node
        if (lastTappedNode === node.id() && now - lastTapTime < 300) {
          // Double click: Select the node and everything it is connected to
          if (singleTapTimeout) clearTimeout(singleTapTimeout); // Prevent unselecting previous selection

          // Use setTimeout to ensure our explicit select() overrides Cytoscape's native toggle unselect
          setTimeout(() => {
            node.select();
            // Select edges attached to this node
            node.connectedEdges().select();
            // Select nodes attached to those edges
            node.connectedEdges().connectedNodes().select();
          }, 10);
        } else {
          // Single click: If not holding shift/ctrl, clear others after 300ms (allows time for a potential double click to keep them)
          if (
            !originalEvent.shiftKey &&
            !originalEvent.ctrlKey &&
            !originalEvent.metaKey
          ) {
            if (singleTapTimeout) clearTimeout(singleTapTimeout);
            singleTapTimeout = setTimeout(() => {
              this.cy.nodes().difference(node).unselect();
              // Because 'additive' selection type natively toggles nodes immediately,
              // clicking an already-selected node toggles it OFF natively before we reach here.
              // So we explicitly select it to ensure unmodified click makes it the sole selection.
              node.select();
            }, 300);
          }
        }

        lastTapTime = now;
        lastTappedNode = node.id();
      }
    });

    // Prevent selection of faded or ghosted elements
    this.cy.on("select", "node, edge", (e) => {
      const el = e.target;
      if (el.hasClass("faded") || el.hasClass("ktruss-faded")) {
        el.unselect();
      }
    });

    // Attach selection listeners for Ghost Mode and Connected Edges
    this.cy.on("select unselect", () => {
      if (this.globalGhostMode) {
        this.updateGlobalGhost();
      }
      this.updateSelectedEdges();
    });

    // --- Ingest Modal Logic ---
    const ingestModalBackdrop = document.getElementById(
      "ingest-modal-backdrop",
    );
    const btnCloseModal = document.getElementById("close-modal-btn");
    const btnCancelIngest = document.getElementById("cancel-ingest-btn");
    const btnSubmitIngest = document.getElementById("submit-ingest-btn");
    const radioTypes = document.querySelectorAll('input[name="ingest-type"]');
    const seedSelectGroup = document.getElementById("seed-select-group");
    let activeSubtoolBtn = null;

    const openIngestModal = (triggerBtn) => {
      activeSubtoolBtn = triggerBtn;
      triggerBtn.classList.add("active");
      ingestModalBackdrop.classList.remove("hidden");
    };

    const closeIngestModal = () => {
      if (activeSubtoolBtn) {
        activeSubtoolBtn.classList.remove("active");
        activeSubtoolBtn = null;
      }
      ingestModalBackdrop.classList.add("hidden");
    };

    // Wire Ingest Button
    const ingestBtn = document.querySelector('[data-action="Ingest"]');
    if (ingestBtn) {
      ingestBtn.addEventListener("click", () => {
        this.updateDropown(); // ensure seeds are populated
        openIngestModal(ingestBtn);
      });
    }

    btnCloseModal.addEventListener("click", closeIngestModal);
    btnCancelIngest.addEventListener("click", closeIngestModal);

    // Hide/Show seed dropdown based on type selection
    radioTypes.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.value === "seed") {
          seedSelectGroup.style.display = "none";
        } else {
          seedSelectGroup.style.display = "flex";
        }
      });
    });

    btnSubmitIngest.addEventListener("click", () => {
      this.handleImport();
      closeIngestModal();
    });

    // Snap to Grid Logic
    const btnSnapGrid = document.getElementById("snap-grid-btn");
    if (btnSnapGrid) {
      btnSnapGrid.addEventListener("click", () => {
        this.snapToGrid = !this.snapToGrid;
        btnSnapGrid.classList.toggle("active", this.snapToGrid);
        this.showToast(
          this.snapToGrid ? "Snap to Grid: ON" : "Snap to Grid: OFF",
        );
      });
    }

    // The 'free' event fires when a user lets go of a dragged node
    this.cy.on("free", "node", (e) => {
      if (!this.snapToGrid) return;

      this.saveState(); // Save before snapping

      const gridSize = 100; // 100px grid

      // If dragging a single node vs a selected group
      const draggedNode = e.target;
      const selectedNodes = this.cy.nodes(":selected");

      // If the node we dragged is part of a selection, snap ALL selected nodes
      const nodesToSnap = selectedNodes.contains(draggedNode)
        ? selectedNodes
        : this.cy.collection().add(draggedNode);

      this.cy.batch(() => {
        nodesToSnap.forEach((node) => {
          const pos = node.position();
          node.position({
            x: Math.round(pos.x / gridSize) * gridSize,
            y: Math.round(pos.y / gridSize) * gridSize,
          });
        });
      });
    });

    // Wipe Graph Modal Logic
    const btnWipeGraph = document.getElementById("wipe-graph-btn");
    const wipeModalBackdrop = document.getElementById("wipe-modal-backdrop");
    const btnCloseWipe = document.getElementById("close-wipe-modal-btn");
    const btnCancelWipe = document.getElementById("cancel-wipe-btn");
    const btnSubmitWipe = document.getElementById("submit-wipe-btn");
    let activeWipeBtn = null;

    const openWipeModal = (triggerBtn) => {
      activeWipeBtn = triggerBtn;
      triggerBtn.classList.add("active");
      wipeModalBackdrop.classList.remove("hidden");
    };

    const closeWipeModal = () => {
      if (activeWipeBtn) {
        activeWipeBtn.classList.remove("active");
        activeWipeBtn = null;
      }
      wipeModalBackdrop.classList.add("hidden");
    };

    if (btnWipeGraph) {
      btnWipeGraph.addEventListener("click", () => {
        openWipeModal(btnWipeGraph);
      });
    }

    if (btnCloseWipe) btnCloseWipe.addEventListener("click", closeWipeModal);
    if (btnCancelWipe) btnCancelWipe.addEventListener("click", closeWipeModal);

    if (btnSubmitWipe) {
      btnSubmitWipe.addEventListener("click", () => {
        if (this.cy.nodes().length > 0) {
          this.saveState(); // Allow undo
        }

        this.cy.elements().remove();
        this.edgeSet.clear();

        // Reset UI toggles
        this.ffpMode = "off";
        this.ffpDepth = 10;
        this.ffpRankLabelMode = false;

        this.updateFFPUI();
        this.updateStats();
        this.updateDropown();

        this.showToast("Graph wiped completely.");
        closeWipeModal();
      });
    }

    // Debug Paste Modal Logic
    const btnDebugPaste = document.getElementById("debug-paste-btn");
    const debugModalBackdrop = document.getElementById("debug-modal-backdrop");
    const btnCloseDebug = document.getElementById("close-debug-modal-btn");
    const btnCancelDebug = document.getElementById("cancel-debug-btn");
    const btnDownloadDebug = document.getElementById("download-debug-btn");
    let activeDebugBtn = null;

    const openDebugModal = (triggerBtn) => {
      activeDebugBtn = triggerBtn;
      triggerBtn.classList.add("active");
      debugModalBackdrop.classList.remove("hidden");
    };

    const closeDebugModal = () => {
      if (activeDebugBtn) {
        activeDebugBtn.classList.remove("active");
        activeDebugBtn = null;
      }
      debugModalBackdrop.classList.add("hidden");
    };

    if (btnDebugPaste) {
      btnDebugPaste.addEventListener("click", () => {
        openDebugModal(btnDebugPaste);
      });
    }
    btnCloseDebug.addEventListener("click", closeDebugModal);
    btnCancelDebug.addEventListener("click", closeDebugModal);

    btnDownloadDebug.addEventListener("click", () => {
      const pasteArea = document.getElementById("debug-paste-area");
      if (pasteArea && pasteArea.innerHTML.trim() !== "") {
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(
            JSON.stringify(
              {
                rawText: pasteArea.innerText || pasteArea.textContent,
                html: pasteArea.innerHTML,
              },
              null,
              2,
            ),
          );
        const dlAnchorElem = document.createElement("a");
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute(
          "download",
          `tiktok_paste_debug_${new Date().getTime()}.json`,
        );
        dlAnchorElem.click();
        this.showToast("Paste data saved to downloaded JSON file.");
        closeDebugModal();
        pasteArea.innerHTML = "";
      } else {
        this.showToast("Please paste something into the box first!");
      }
    });

    // JSON Export/Import Events
    const exportBtn = document.getElementById("export-json-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportToJSON();
      });
    }

    // Reheat: re-run force layout to spread nodes
    const reheatBtn = document.getElementById("reheat-btn");
    if (reheatBtn) {
      reheatBtn.addEventListener("click", () => {
        const selectedNodes = this.cy.nodes(":selected");
        const targetNodes =
          selectedNodes.length > 0 ? selectedNodes : this.cy.elements();
        const isGlobal = selectedNodes.length === 0;

        this.saveState();
        this.showToast(isGlobal ? "Reheating graph…" : "Reheating cluster…");

        let bb = targetNodes.boundingBox();
        // Give the bounding box plenty of space so the physics engine can push nodes apart
        if (bb.w < 1200) {
          bb.x1 -= 600;
          bb.w = 1200;
        }
        if (bb.h < 1200) {
          bb.y1 -= 600;
          bb.h = 1200;
        }

        const layoutOptions = isGlobal
          ? {
              name: "cose",
              padding: 80,
              idealEdgeLength: 120,
              nodeRepulsion: 12000,
              animate: true,
              animationDuration: 800,
              fit: true,
              randomize: true, // Forces random initial positions
              componentSpacing: 100,
            }
          : {
              name: "concentric",
              fit: false,
              animate: true,
              animationDuration: 800,
              boundingBox: { x1: bb.x1, y1: bb.y1, w: bb.w, h: bb.h },
              spacingFactor: 1.1,
              minNodeSpacing: 30,
              avoidOverlap: true,
            };

        targetNodes.layout(layoutOptions).run();
      });
    }

    // Space Layout Helpers
    const relaxLayout = (scaleDir) => {
      const selectedNodes = this.cy.nodes(":selected");
      const targetNodes =
        selectedNodes.length > 0
          ? selectedNodes
          : this.cy.nodes().not(":locked");

      if (targetNodes.length === 0) return;
      this.saveState();

      // Calculate center of the target nodes to scale from
      const bb = targetNodes.boundingBox();
      const center = {
        x: (bb.x1 + bb.x2) / 2,
        y: (bb.y1 + bb.y2) / 2,
      };

      // Calculate the new positions mathematically
      const newPositions = {};
      targetNodes.forEach((node) => {
        const pos = node.position();
        newPositions[node.id()] = {
          x: center.x + (pos.x - center.x) * scaleDir,
          y: center.y + (pos.y - center.y) * scaleDir,
        };
      });

      // Use 'preset' layout to smoothly animate to exactly these coordinates
      // without ANY physics simulation ruining it. By calling layout on targetNodes,
      // we only affect the selected cluster.
      targetNodes
        .layout({
          name: "preset",
          positions: newPositions,
          animate: true,
          animationDuration: 300,
          fit: false,
        })
        .run();

      // If we are spacing the entire graph, adjust camera zoom to counter the spatial scaling.
      // If we are just spacing a specific cluster, leave the camera zoom alone.
      if (selectedNodes.length === 0) {
        this.cy.animate(
          {
            zoom: this.cy.zoom() * (1 / scaleDir),
            center: { eles: this.cy.nodes() }, // Keep the graph somewhat centered
          },
          {
            duration: 300,
          },
        );
      }
    };

    const centerBtn = document.getElementById("center-graph-btn");
    if (centerBtn) {
      centerBtn.addEventListener("click", () => {
        const selectedNodes = this.cy.nodes(":selected");
        if (selectedNodes.length > 0) {
          this.cy.fit(selectedNodes, 50);
        } else {
          this.cy.fit(null, 50);
        }
      });
    }

    const expandBtn = document.getElementById("expand-space-btn");
    if (expandBtn) expandBtn.addEventListener("click", () => relaxLayout(1.3));

    const contractBtn = document.getElementById("contract-space-btn");
    if (contractBtn)
      contractBtn.addEventListener("click", () => relaxLayout(0.7));

    const importBtn = document.getElementById("import-json-btn");
    const importHidden = document.getElementById("import-json-hidden");
    if (importBtn && importHidden) {
      importBtn.addEventListener("click", () => {
        importHidden.click(); // Trigger native file dialog
      });
      importHidden.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.saveState();
          this.importFromJSON(file);
        }
        // Reset input in case they want to upload the same file again later
        importHidden.value = "";
      });
    }

    const undoBtn = document.getElementById("undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", () => {
        this.undo();
      });
    }

    // --- FFP Controls Logic ---
    const ffpToggleBtn = document.getElementById("ffp-toggle-btn");
    const ffpFollowersBtn = document.getElementById("ffp-followers-btn");
    const ffpFollowingBtn = document.getElementById("ffp-following-btn");
    const ffpDepthUp = document.getElementById("ffp-depth-up");
    const ffpDepthDown = document.getElementById("ffp-depth-down");
    const ffpDepthToast = document.getElementById("ffp-depth-toast");
    let ffpToastTimeout;

    const showDepthToast = () => {
      ffpDepthToast.textContent = this.ffpDepth;
      ffpDepthToast.classList.remove("hidden");

      if (ffpToastTimeout) clearTimeout(ffpToastTimeout);
      ffpToastTimeout = setTimeout(() => {
        ffpDepthToast.classList.add("hidden");
      }, 1500);
    };

    const ffpControlsContainer = document.getElementById(
      "ffp-controls-container",
    );
    const ffpSubToggles = document.getElementById("ffp-sub-toggles");
    const ffpRankLabelBtn = document.getElementById("ffp-rank-label-btn");
    let ffpHoverTimeout = null;

    this.updateFFPUI = () => {
      // Reset active classes
      ffpToggleBtn.className = "subtool-btn";
      ffpFollowersBtn.className = "subtool-btn micro-btn";
      ffpFollowingBtn.className = "subtool-btn micro-btn";

      if (this.ffpMode !== "off") {
        if (this.ffpMode === "both") {
          ffpToggleBtn.classList.add("btn-ffp-active");
          ffpFollowersBtn.classList.add("btn-ffp-sub-active");
          ffpFollowingBtn.classList.add("btn-ffp-sub-active");
        } else if (this.ffpMode === "followers") {
          ffpToggleBtn.classList.add("btn-ffp-partial");
          ffpFollowersBtn.classList.add("btn-ffp-sub-active");
        } else if (this.ffpMode === "following") {
          ffpToggleBtn.classList.add("btn-ffp-partial");
          ffpFollowingBtn.classList.add("btn-ffp-sub-active");
        }
      }

      // Rank label mode feedback
      if (this.ffpRankLabelMode) {
        ffpRankLabelBtn.classList.add("btn-ffp-sub-active");
      } else {
        ffpRankLabelBtn.classList.remove("btn-ffp-sub-active");
      }

      // Disable # button when FFP is off (it needs FFP edges to label)
      if (this.ffpMode === "off") {
        ffpRankLabelBtn.disabled = true;
        // Also auto-clear rank label state if FFP is turned off
        if (this.ffpRankLabelMode) {
          this.ffpRankLabelMode = false;
          ffpRankLabelBtn.classList.remove("btn-ffp-sub-active");
        }
      } else {
        ffpRankLabelBtn.disabled = false;
      }

      // Sub-toggle visibility is managed solely by hover — never force show/hide here
      this.applyFFPStyles();
    };

    // Initialise collapsed (no class toggling — direct style so CSS transitions always fire)
    ffpSubToggles.style.maxWidth = "0px";
    ffpSubToggles.style.opacity = "0";
    ffpSubToggles.style.pointerEvents = "none";

    const showSub = () => {
      ffpSubToggles.style.maxWidth = "400px";
      ffpSubToggles.style.opacity = "1";
      ffpSubToggles.style.pointerEvents = "auto";
    };

    const hideSub = () => {
      ffpSubToggles.style.maxWidth = "0px";
      ffpSubToggles.style.opacity = "0";
      ffpSubToggles.style.pointerEvents = "none";
    };

    ffpControlsContainer.addEventListener("mouseenter", showSub);
    ffpControlsContainer.addEventListener("mouseleave", hideSub);

    // K-Truss UI logic
    const ktrussControlsContainer = document.getElementById(
      "ktruss-controls-container",
    );
    const ktrussToggleBtn = document.getElementById("ktruss-toggle-btn");
    const ktrussSubToggles = document.getElementById("ktruss-sub-toggles");
    const ktrussDepthUp = document.getElementById("ktruss-depth-up");
    const ktrussDepthDown = document.getElementById("ktruss-depth-down");
    const ktrussDepthToast = document.getElementById("ktruss-depth-toast");

    let ktrussToastTimeout = null;

    this.updateKTrussUI = () => {
      if (this.ktrussMode) {
        ktrussToggleBtn.classList.add("btn-ffp-active");
      } else {
        ktrussToggleBtn.classList.remove("btn-ffp-active");
      }
      this.applyKTrussStyles();
    };

    ktrussSubToggles.style.maxWidth = "0px";
    ktrussSubToggles.style.opacity = "0";
    ktrussSubToggles.style.pointerEvents = "none";

    const showKtrussSub = () => {
      ktrussSubToggles.style.maxWidth = "400px";
      ktrussSubToggles.style.opacity = "1";
      ktrussSubToggles.style.pointerEvents = "auto";
    };

    const hideKtrussSub = () => {
      ktrussSubToggles.style.maxWidth = "0px";
      ktrussSubToggles.style.opacity = "0";
      ktrussSubToggles.style.pointerEvents = "none";
    };

    ktrussControlsContainer.addEventListener("mouseenter", showKtrussSub);
    ktrussControlsContainer.addEventListener("mouseleave", hideKtrussSub);

    ktrussToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.saveState();
      this.ktrussMode = !this.ktrussMode;

      // If turning ON, ensure FFP is OFF to avoid conflicting highlights
      if (this.ktrussMode) {
        if (this.ffpMode !== "off") {
          this.ffpMode = "off";
          this.updateFFPUI();
        }
      }

      this.updateKTrussUI();
    });

    const showKtrussToast = () => {
      ktrussDepthToast.textContent = `K = ${this.ktrussK}`;
      ktrussDepthToast.classList.remove("hidden", "fade-out");
      if (ktrussToastTimeout) clearTimeout(ktrussToastTimeout);
      ktrussToastTimeout = setTimeout(() => {
        ktrussDepthToast.classList.add("fade-out");
        setTimeout(() => ktrussDepthToast.classList.add("hidden"), 300);
      }, 1500);
    };

    ktrussDepthUp.addEventListener("click", (e) => {
      e.stopPropagation();
      this.saveState();
      this.ktrussK += 1;
      showKtrussToast();
      if (this.ktrussMode) this.updateKTrussUI();
    });

    ktrussDepthDown.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.ktrussK <= 3) {
        this.showToast("Minimum K is 3 (Triangles)");
        return;
      }
      this.saveState();
      this.ktrussK -= 1;
      showKtrussToast();
      if (this.ktrussMode) this.updateKTrussUI();
    });

    // Global Ctrl+Z / Cmd+Z to trigger undo
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        // Prevent default browser undo behavior just in case
        e.preventDefault();
        this.undo();
      }
    });

    // Hover logic: open after 400ms on heart, stay open anywhere in row, close 1s after leaving
    let ffpLeaveTimeout = null;

    ffpToggleBtn.addEventListener("mouseenter", () => {
      if (ffpLeaveTimeout) clearTimeout(ffpLeaveTimeout);
      if (ffpHoverTimeout) clearTimeout(ffpHoverTimeout);
      ffpHoverTimeout = setTimeout(showSub, 400);
    });

    // Cancel close timer anywhere in the entire row (covers gaps between buttons)
    const ffpMainRow = document.querySelector(".ffp-main-row");
    ffpMainRow.addEventListener("mouseenter", () => {
      if (ffpLeaveTimeout) clearTimeout(ffpLeaveTimeout);
    });

    // Start 1s close timer only when cursor truly leaves the whole row
    ffpMainRow.addEventListener("mouseleave", () => {
      if (ffpHoverTimeout) clearTimeout(ffpHoverTimeout);
      ffpLeaveTimeout = setTimeout(hideSub, 1000);
    });

    ffpToggleBtn.addEventListener("click", () => {
      this.ffpMode = this.ffpMode === "both" ? "off" : "both";
      this.updateFFPUI();
    });

    ffpFollowersBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ffpMode = this.ffpMode === "followers" ? "off" : "followers";
      this.updateFFPUI();
    });

    ffpFollowingBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ffpMode = this.ffpMode === "following" ? "off" : "following";
      this.updateFFPUI();
    });

    ffpDepthUp.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ffpDepth += 1;
      showDepthToast();
      if (this.ffpMode !== "off") this.updateFFPUI();
    });

    ffpDepthDown.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.ffpDepth > 1) {
        this.ffpDepth -= 1;
        showDepthToast();
        if (this.ffpMode !== "off") this.updateFFPUI();
      }
    });

    ffpRankLabelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.ffpRankLabelMode = !this.ffpRankLabelMode;
      this.updateFFPUI();
    });

    const ffpDistanceReheatBtn = document.getElementById(
      "ffp-distance-reheat-btn",
    );
    if (ffpDistanceReheatBtn) {
      ffpDistanceReheatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // 1. Get targets
        const selectedNodes = this.cy.nodes(":selected");
        const targetNodes =
          selectedNodes.length > 0
            ? selectedNodes
            : this.cy.nodes().not(":locked");

        if (targetNodes.length < 2) {
          this.showToast(
            "Select 2 or more nodes to spatially reheat by FFP distance.",
          );
          return;
        }

        this.saveState();
        this.showToast("Reheating topology by FFP distance...");

        // 2. Custom Physics layout
        // Give it a much larger bounding box so the physics engine has room to push
        const bb = targetNodes.boundingBox();
        if (bb.w < 1200) {
          bb.x1 -= 600;
          bb.w = 1200;
        }
        if (bb.h < 1200) {
          bb.y1 -= 600;
          bb.h = 1200;
        }

        targetNodes
          .layout({
            name: "cose",
            animate: true,
            animationDuration: 1000,
            fit: false,
            randomize: true, // MUST be true or cose defaults to a rigid starting grid
            componentSpacing: 100,
            boundingBox: { x1: bb.x1, y1: bb.y1, w: bb.w, h: bb.h },
            padding: 80,
            nodeRepulsion: function (node) {
              return 10000;
            },
            idealEdgeLength: function (edge) {
              // Not strictly read by all physics engines but good practice
              const rank = edge.data("ffpRank");
              if (edge.data("mutual") === "true" || !rank) return 32; // Tightly packed
              return 32 + rank * 20; // Longer resting spring length
            },
            edgeElasticity: function (edge) {
              const rank = edge.data("ffpRank");
              // Highly elastic (pulls hard) for mutuals/rank 1. Very weak for Rank N.
              if (edge.data("mutual") === "true" || !rank) return 100;
              return Math.max(1, 100 - rank * 8);
            },
          })
          .run();
      });
    }

    // --- Hover Panel Logic ---
    const hoverPanel = document.getElementById("node-hover-panel");
    const hoverDisplayName = document.getElementById("hover-display-name");
    const hoverUsername = document.getElementById("hover-username");
    const hoverBio = document.getElementById("hover-bio");
    const hoverFollowing = document.getElementById("hover-following-count");
    const hoverFollowers = document.getElementById("hover-followers-count");
    const hoverIngestTime = document.getElementById("hover-ingest-time");
    const hoverCopyBtn = document.getElementById("hover-copy-btn");
    let hoverTimeout = null;
    let hoverShowTimeout = null;
    let isHoveringPanel = false;
    let activeHoverNodeData = null;

    hoverUsername.addEventListener("click", () => {
      if (activeHoverNodeData && activeHoverNodeData.id) {
        window.open(
          `https://www.tiktok.com/@${activeHoverNodeData.id}`,
          "_blank",
        );
      }
    });

    const edgeTooltip = document.getElementById("edge-hover-tooltip");
    const edgeRankLabel = document.getElementById("edge-rank-label");
    const edgeIngestTime = document.getElementById("edge-ingest-time");

    // Keep panel open if mouse moves over the panel itself
    hoverPanel.addEventListener("mouseenter", () => {
      isHoveringPanel = true;
      if (hoverTimeout) clearTimeout(hoverTimeout);
    });

    hoverPanel.addEventListener("mouseleave", () => {
      isHoveringPanel = false;
      hoverPanel.classList.add("hidden");
    });

    this.cy.on("mouseover", "node", (e) => {
      const node = e.target;
      if (node.data("type") !== "seed") return; // Only show for seeds

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
          hoverFollowing.style.color = "#22c55e";
          hoverFollowing.style.fontWeight = "bold";
        } else {
          hoverFollowing.style.color = "";
          hoverFollowing.style.fontWeight = "normal";
        }

        if (data.hasFollowers) {
          hoverFollowers.style.color = "#22c55e";
          hoverFollowers.style.fontWeight = "bold";
        } else {
          hoverFollowers.style.color = "";
          hoverFollowers.style.fontWeight = "normal";
        }

        // Calculate position (offset from node)
        const pos = node.renderedPosition();
        const bb = node.renderedBoundingBox();

        // Prefer placing panel to the right of the node
        let left = bb.x2 + 10;
        let top = pos.y - 50;

        // Simple viewport bounds check
        if (left + 280 > window.innerWidth) {
          // 280 roughly panel width
          left = bb.x1 - 290; // flip to left side
        }
        if (top < 10) top = 10;

        hoverPanel.style.left = `${left}px`;
        hoverPanel.style.top = `${top}px`;

        hoverPanel.classList.remove("hidden");
      }, 400);
    });

    this.cy.on("mouseout", "node", (e) => {
      const node = e.target;
      if (node.data("type") !== "seed") return;

      if (hoverShowTimeout) clearTimeout(hoverShowTimeout); // Cancel if they leave too soon
      hoverTimeout = setTimeout(() => {
        if (!isHoveringPanel) {
          hoverPanel.classList.add("hidden");
          activeHoverNodeData = null;
        }
      }, 250); // slight delay to allow moving mouse to the panel
    });

    // Copy Buffer action
    hoverCopyBtn.addEventListener("click", () => {
      if (!activeHoverNodeData) return;
      let timeStr = "N/A";
      if (activeHoverNodeData.ingestTime)
        timeStr = new Date(activeHoverNodeData.ingestTime).toLocaleString();

      const txt = `Username: @${activeHoverNodeData.id}\nDisplay Name: ${activeHoverNodeData.label}\nFollowing: ${activeHoverNodeData.following || "Unknown"}\nFollowers: ${activeHoverNodeData.followers || "Unknown"}\nIngested: ${timeStr}\nBio:\n${activeHoverNodeData.bio || ""}`;

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(txt)
          .then(() => {
            this.showToast("Profile info copied to clipboard!");
          })
          .catch((err) => {
            console.error("Failed to copy", err);
            this.showToast("Failed to copy text.");
          });
      } else {
        // Fallback for non-https local files sometimes
        const textArea = document.createElement("textarea");
        textArea.value = txt;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          this.showToast("Profile info copied to clipboard!");
        } catch (err) {
          this.showToast("Failed to copy text.");
        }
        document.body.removeChild(textArea);
      }
    });

    // --- Right-Click Radial Menu ---
    const radialMenu = document.getElementById("radial-menu");
    const btnLockNode = document.getElementById("btn-lock-node");
    let activeRadialNode = null;

    const hideRadialMenu = () => {
      radialMenu.classList.add("hidden");
      activeRadialNode = null;
    };

    this.cy.on("cxttap", "node", (e) => {
      if (e.originalEvent) e.originalEvent.preventDefault();
      const node = e.target;

      // If the node isn't selected, select it (and unselect others)
      if (!node.selected()) {
        this.cy.elements().unselect();
        node.select();
      }

      activeRadialNode = node;

      // Update UI of the lock button based on clicked node
      const isLocked = node.data("locked");
      if (isLocked) {
        btnLockNode.classList.add("active");
        btnLockNode.title = "Unlock Selected Nodes";
      } else {
        btnLockNode.classList.remove("active");
        btnLockNode.title = "Lock Selected Nodes";
      }

      // Position menu at mouse click
      const rect = this.cy.container().getBoundingClientRect();
      if (e.renderedPosition) {
        radialMenu.style.left = `${rect.left + e.renderedPosition.x}px`;
        radialMenu.style.top = `${rect.top + e.renderedPosition.y}px`;
      } else {
        // Fallback if triggered without a real mouse event (e.g. touch device)
        const pos = node.renderedPosition();
        radialMenu.style.left = `${rect.left + pos.x}px`;
        radialMenu.style.top = `${rect.top + pos.y}px`;
      }
      radialMenu.classList.remove("hidden");
    });

    // Hide radial menu on background click or pan/zoom
    this.cy.on("tap drag pan zoom", hideRadialMenu);

    // Lock Button Logic
    btnLockNode.addEventListener("click", (e) => {
      e.stopPropagation();
      this.saveState();

      let selectedNodes = this.cy.nodes(":selected");
      if (selectedNodes.length === 0 && activeRadialNode) {
        selectedNodes = this.cy.collection().add(activeRadialNode);
      }

      // Determine new state based on the specific node that was right-clicked
      const isCurrentlyLocked = activeRadialNode
        ? activeRadialNode.data("locked")
        : false;
      const newState = !isCurrentlyLocked;

      this.cy.batch(() => {
        selectedNodes.forEach((n) => {
          n.data("locked", newState);
          if (newState) {
            n.lock();
          } else {
            n.unlock();
          }
        });
      });

      this.showToast(
        newState
          ? `Locked ${selectedNodes.length} node(s)`
          : `Unlocked ${selectedNodes.length} node(s)`,
      );
      hideRadialMenu();
    });

    // --- Manual Link Drawing Logic ---
    const drawLinkBtn = document.getElementById("draw-link-btn");
    const edgeRadialMenu = document.getElementById("edge-radial-menu");
    const edgeStyleBtns = document.querySelectorAll(".edge-style-btn");
    let activeRadialEdge = null;

    if (drawLinkBtn) {
      drawLinkBtn.addEventListener("click", () => {
        this.saveState();
        this.drawLinkMode = !this.drawLinkMode;
        this.drawLinkSourceNode = null; // Reset on toggle

        drawLinkBtn.classList.toggle("active", this.drawLinkMode);
        if (this.drawLinkMode) {
          document.getElementById("cy").classList.add("cursor-crosshair");
          this.showToast(
            "Draw Link mode activated. Click two nodes to connect them.",
          );
        } else {
          document.getElementById("cy").classList.remove("cursor-crosshair");
        }
      });
    }

    const hideEdgeRadialMenu = () => {
      edgeRadialMenu.classList.add("hidden");
      activeRadialEdge = null;
    };

    // Edge clicking in drawing mode
    this.cy.on("tap", "node", (e) => {
      if (!this.drawLinkMode) return;

      const node = e.target;

      if (!this.drawLinkSourceNode) {
        // Select first node
        this.drawLinkSourceNode = node;
        this.showToast(`Selected source: @${node.id()}. Click target node.`);
      } else {
        // We have a source, this is the target
        const sourceId = this.drawLinkSourceNode.id();
        const targetId = node.id();

        if (sourceId === targetId) {
          this.showToast("Cannot link a node to itself.");
          this.drawLinkSourceNode = null;
          return;
        }

        this.saveState();

        // Create edge
        const edgeId = `manual-${sourceId}-${targetId}-${Date.now()}`;

        this.cy.add({
          group: "edges",
          data: {
            id: edgeId,
            source: sourceId,
            target: targetId,
          },
          // Ensure base styles are applied
          classes: "manual-link line-solid arrow-right",
        });

        this.showToast(`Linked @${sourceId} to @${targetId}`);

        const newEdge = this.cy.getElementById(edgeId);

        // Trigger radial menu immediately and artificially position it
        activeRadialEdge = newEdge;
        const sourcePos = this.drawLinkSourceNode.renderedPosition();
        const targetPos = node.renderedPosition();
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        const rect = this.cy.container().getBoundingClientRect();

        edgeRadialMenu.style.left = `${rect.left + midX}px`;
        edgeRadialMenu.style.top = `${rect.top + midY}px`;

        // Highlight the current style button
        edgeStyleBtns.forEach((btn) => btn.classList.remove("active"));
        const currentStyleBtn = Array.from(edgeStyleBtns).find(
          (btn) => btn.dataset.style === "right",
        );
        if (currentStyleBtn) currentStyleBtn.classList.add("active");

        edgeRadialMenu.classList.remove("hidden");

        // Reset drawing mode completely for the next action to allow standard use
        this.drawLinkMode = false;
        drawLinkBtn.classList.remove("active");
        document.getElementById("cy").classList.remove("cursor-crosshair");
        this.drawLinkSourceNode = null;
      }
    });

    // Binding the edge style buttons
    edgeStyleBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!activeRadialEdge) return;

        const type = btn.dataset.type;
        const newStyle = btn.dataset.style;

        // Handle delete action
        if (type === "action" && newStyle === "delete") {
          this.saveState();
          activeRadialEdge.remove();
          hideEdgeRadialMenu();
          this.showToast("Link deleted");
          return;
        }

        this.saveState();

        this.cy.batch(() => {
          // If arrow type already active, toggle it OFF (set to arrow-none)
          let finalStyle = newStyle;
          if (
            type === "arrow" &&
            activeRadialEdge.hasClass(`${type}-${newStyle}`)
          ) {
            finalStyle = "none";
          }

          // Strip all classes of this specific type (line-* or arrow-*)
          activeRadialEdge.classes().forEach((cls) => {
            if (cls.startsWith(`${type}-`)) {
              activeRadialEdge.removeClass(cls);
            }
          });

          // Add new style class
          activeRadialEdge.addClass(`${type}-${finalStyle}`);
        });

        // Keep menu open for rapid toggling but update active states
        updateEdgeRadialButtonStates();
      });
    });

    const updateEdgeRadialButtonStates = () => {
      if (!activeRadialEdge) return;
      edgeStyleBtns.forEach((btn) => btn.classList.remove("active"));
      activeRadialEdge.classes().forEach((cls) => {
        if (cls.startsWith("line-") || cls.startsWith("arrow-")) {
          const parts = cls.split("-");
          const type = parts[0];
          const style = parts[1];
          const activeBtn = Array.from(edgeStyleBtns).find(
            (b) => b.dataset.type === type && b.dataset.style === style,
          );
          if (activeBtn) activeBtn.classList.add("active");
        }
      });
    };

    // Right clicking any edge
    this.cy.on("cxttap", "edge", (e) => {
      if (e.originalEvent) e.originalEvent.preventDefault();

      activeRadialEdge = e.target;
      updateEdgeRadialButtonStates();

      // Position Menu
      const rect = this.cy.container().getBoundingClientRect();
      if (e.renderedPosition) {
        edgeRadialMenu.style.left = `${rect.left + e.renderedPosition.x}px`;
        edgeRadialMenu.style.top = `${rect.top + e.renderedPosition.y}px`;
      } else {
        // Midpoint fallback if no event
        const srcPos = activeRadialEdge.source().renderedPosition();
        const tgtPos = activeRadialEdge.target().renderedPosition();
        const midX = (srcPos.x + tgtPos.x) / 2;
        const midY = (srcPos.y + tgtPos.y) / 2;
        edgeRadialMenu.style.left = `${rect.left + midX}px`;
        edgeRadialMenu.style.top = `${rect.top + midY}px`;
      }

      edgeRadialMenu.classList.remove("hidden");
    });

    // Global hide for edge radial menu
    this.cy.on("tap drag pan zoom", hideEdgeRadialMenu);

    // Keep menu open handled in click listener, hide on explicit actions handled above
  }

  showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    console.log(message);
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 300ms ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  updateStylesheetForMode() {
    const rootStyles = getComputedStyle(document.documentElement);

    const textColor = rootStyles.getPropertyValue("--text").trim() || "#e6e9f2";
    const bgColor = rootStyles.getPropertyValue("--bg").trim() || "#0f1115";
    const brandColor =
      rootStyles.getPropertyValue("--brand").trim() || "#2ea8ff";
    const borderColor =
      rootStyles.getPropertyValue("--muted").trim() || "#94a3b8";

    const defaultEdgeColor = this.isLightMode ? "#cbd5e1" : "#475569";
    const mutualEdgeColor = this.showMutuals ? brandColor : defaultEdgeColor;

    this.cy
      .style()
      .selector("node")
      .style("border-color", borderColor)
      .style("color", textColor)
      .style("text-background-color", bgColor)
      .selector("node:selected")
      .style("border-color", brandColor)
      .selector("edge")
      .style("line-color", defaultEdgeColor)
      .style("target-arrow-color", defaultEdgeColor)
      .selector('edge[mutual="true"]')
      .style("line-color", mutualEdgeColor)
      .style("target-arrow-color", mutualEdgeColor)
      .style("source-arrow-color", mutualEdgeColor)
      .selector("edge.manual-link")
      .style("line-color", "#f59e0b")
      .style("target-arrow-color", "#f59e0b")
      .style("source-arrow-color", "#f59e0b")
      .selector("edge.connected-selected")
      .style("line-color", brandColor)
      .style("target-arrow-color", brandColor)
      .style("source-arrow-color", brandColor)
      .style("opacity", 1)
      .style("width", 3)
      .style("z-index", 10)
      .selector("node.faded")
      .style("opacity", 0.15)
      .style("text-opacity", 0.15)
      .selector("edge.faded")
      .style("opacity", 0.05)
      .selector("node.ktruss-highlight")
      .style("z-index", 20)
      .selector("edge.ktruss-highlight")
      .style("width", 2)
      .style("line-color", "#a855f7")
      .style("target-arrow-color", "#a855f7")
      .style("opacity", 1)
      .style("z-index", 20)
      .selector("node.ktruss-faded")
      .style("opacity", 0.1)
      .style("text-opacity", 0.1)
      .selector("edge.ktruss-faded")
      .style("opacity", 0.05)
      .update();
  }

  updateStats() {
    const nodeStat = document.getElementById("stat-nodes");
    const edgeStat = document.getElementById("stat-edges");
    if (nodeStat) nodeStat.textContent = this.cy.nodes().length;
    if (edgeStat) edgeStat.textContent = this.cy.edges().length;
  }

  updateDropown() {
    const select = document.getElementById("active-seed");
    if (!select) return;
    // Clear options except first
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Populate with seed nodes, or maybe all nodes
    const seeds = this.cy.nodes('[type="seed"]');
    seeds.forEach((n) => {
      const data = n.data();
      const option = document.createElement("option");
      option.value = data.id;
      option.textContent = data.label + ` (@${data.id})`;
      select.appendChild(option);
    });

    if (seeds.length > 0) {
      select.value = seeds.last().id();
    }
  }

  handleImport() {
    const typeSelect = document.querySelector(
      'input[name="ingest-type"]:checked',
    ).value;
    const targetId = document.getElementById("active-seed").value;
    const pasteArea = document.getElementById("html-paste-area");
    const overlay = document.getElementById("loading-overlay");

    const html = pasteArea.innerHTML;
    const rawText = pasteArea.innerText || pasteArea.textContent;

    if (!rawText.trim() && !html.trim()) {
      this.showToast("Please paste some content first.");
      return;
    }

    if (
      (typeSelect === "following" || typeSelect === "followers") &&
      !targetId
    ) {
      this.showToast("Please select a target seed node.");
      return;
    }

    // Show loading
    overlay.classList.remove("hidden");

    // Let the UI render before locking the thread with parsing
    setTimeout(() => {
      const profiles = this.parseTikTokProfiles(html, rawText, typeSelect);
      console.log(`Parsed ${profiles.length} profiles from paste.`);

      // Always clear the paste area after attempting to parse, so it doesn't get stuck on failed ingests
      if (pasteArea) {
        pasteArea.innerHTML = "";
      }

      if (profiles.length === 0) {
        overlay.classList.add("hidden");
        this.showToast(
          "No TikTok profiles could be parsed. Ensure you copied the elements directly.",
        );
        return;
      }

      this.saveState();
      let newlyAddedElements = this.cy.collection();
      const existingNodeCount = this.cy.nodes().length;

      this.cy.batch(() => {
        // If it's a seed ingest, just add the seed node
        if (typeSelect === "seed") {
          profiles.forEach((p) => {
            this.addNodeToGraph(p, true);
            newlyAddedElements.merge(this.cy.getElementById(p.id));
          });
        } else {
          // It's a follower/following ingest mapped to an existing seed
          const seedNode = this.cy.getElementById(targetId);
          if (typeSelect === "following") seedNode.data("hasFollowing", true);
          if (typeSelect === "followers") seedNode.data("hasFollowers", true);

          const totalNewProfiles = profiles.length;

          profiles.forEach((p, index) => {
            this.addNodeToGraph(p, false);

            const newNode = this.cy.getElementById(p.id);
            newlyAddedElements.merge(newNode);

            // FFP Chronological Rank: index 0 is newest, index L-1 is oldest (Rank 1)
            const rank = totalNewProfiles - index;
            const rankDirection = typeSelect; // 'following' or 'followers'

            if (typeSelect === "following") {
              this.addEdgeToGraph(targetId, p.id, rank, rankDirection);
            } else {
              this.addEdgeToGraph(p.id, targetId, rank, rankDirection);
            }
          });
        }
        this.updateDropown();

        // Select all newly added nodes automatically
        newlyAddedElements.select();
      });

      overlay.classList.add("hidden");
      this.updateStats();

      // Only layout if this is the first ingest, otherwise leave user's manual dragging intact
      if (existingNodeCount === 0) {
        this.cy
          .layout({ name: "cose", padding: 50, idealEdgeLength: 60 })
          .run();
      } else {
        let center = { x: 0, y: 0 };
        // If appending to a target seed, scatter around that seed
        if (typeSelect !== "seed" && targetId) {
          const targetSeed = this.cy.getElementById(targetId);
          if (targetSeed && !targetSeed.empty()) {
            center = targetSeed.position();
          }
        } else {
          // If adding independent seeds to an existing graph, scatter them around the center of the viewport
          center = { x: this.cy.width() / 2, y: this.cy.height() / 2 };
        }

        newlyAddedElements.nodes().forEach((n) => {
          n.position({
            x: center.x + (Math.random() * 300 - 150),
            y: center.y + (Math.random() * 300 - 150),
          });
        });
      }
      this.showToast("Ingest complete!");

      // Close the primary ingest modal backdrop as well
      const ingestModalBackdrop = document.getElementById(
        "ingest-modal-backdrop",
      );
      if (ingestModalBackdrop) {
        ingestModalBackdrop.classList.add("hidden");
      }

      // Remove active state from the ingest button if it's still there
      const ingestBtn = document.querySelector('[data-action="Ingest"]');
      if (ingestBtn) {
        ingestBtn.classList.remove("active");
      }

      // Re-apply FFP styles if active
      if (this.ffpMode !== "off") {
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
    const exportObj = {
      elements: graphData,
      uiState: {
        ffpMode: this.ffpMode,
        ffpDepth: this.ffpDepth,
        ffpGhostMode: this.ffpGhostMode,
        ffpRankLabelMode: this.ffpRankLabelMode,
        isDotMode: this.isDotMode,
        isLightMode: this.isLightMode,
        globalGhostMode: this.globalGhostMode,
        showMutuals: this.showMutuals,
      },
    };
    const dataStr = JSON.stringify(exportObj, null, 2);

    // Find seed node to name the file
    const seeds = this.cy.nodes('[type="seed"]');
    let prefix = "export";
    if (seeds.length > 0) {
      prefix = seeds.first().id();
    }

    // Generate safe timestamp string
    const date = new Date();
    const timeString = date.toISOString().replace(/[:.]/g, "-");
    const filename = `${prefix}_${timeString}.json`;

    // Create virtual download anchor
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
        const parsed = JSON.parse(e.target.result);
        const existingNodeCount = this.cy.nodes().length;

        // Normalise to flat array — export saves {nodes:[...], edges:[...]}
        let elements;
        let uiState = null;

        if (Array.isArray(parsed)) {
          elements = parsed; // Legacy flat array
        } else if (parsed.elements) {
          // New format with uiState
          if (Array.isArray(parsed.elements)) {
            elements = parsed.elements;
          } else {
            elements = [
              ...(parsed.elements.nodes || []),
              ...(parsed.elements.edges || []),
            ];
          }
          uiState = parsed.uiState;
        } else {
          // Legacy object format
          elements = [...(parsed.nodes || []), ...(parsed.edges || [])];
        }

        // Merge: only add elements whose IDs don't already exist
        const newElements = [];
        for (const el of elements) {
          const id = el.data && el.data.id;
          if (id && !this.cy.getElementById(id).empty()) {
            // Element already exists — update its data in-place
            const existing = this.cy.getElementById(id);
            if (el.data) {
              Object.entries(el.data).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== "") {
                  existing.data(k, v);
                }
              });
            }
          } else {
            newElements.push(el);
          }
        }

        let addedElements;
        this.cy.batch(() => {
          addedElements = this.cy.add(newElements);
          // Rebuild edgeSet from newly added edges
          addedElements.edges().forEach((edge) => {
            const s = edge.data("source");
            const t = edge.data("target");
            if (s && t) this.edgeSet.add(`${s}->${t}`);
          });
        });

        // Scatter new nodes that land at 0,0 (no saved position)
        let needsLayout = false;
        if (existingNodeCount > 0) {
          const cx = this.cy.width() / 2;
          const cy = this.cy.height() / 2;
          addedElements.nodes().forEach((n) => {
            const pos = n.position();
            if (!pos || (pos.x === 0 && pos.y === 0)) {
              n.position({
                x: cx + (Math.random() * 300 - 150),
                y: cy + (Math.random() * 300 - 150),
              });
            }
          });
        } else {
          // It's a fresh graph. Check if ALL imported nodes lack positions (e.g. legacy/blank import)
          const nodesWithoutPos = addedElements.nodes().filter((n) => {
            const pos = n.position();
            return !pos || (pos.x === 0 && pos.y === 0);
          });

          // If any node was missing a position, we must run the layout to organize them
          if (nodesWithoutPos.length > 0) {
            needsLayout = true;
          }
        }

        if (needsLayout) {
          this.cy
            .layout({ name: "cose", padding: 50, idealEdgeLength: 60 })
            .run();
        } else {
          // Nodes have saved positions, but the camera is at default 0,0
          // We must center the camera on the newly loaded graph
          this.cy.fit(null, 50);
        }

        this.updateStats();
        this.updateDropown();

        if (uiState) {
          if (uiState.ffpMode !== undefined) this.ffpMode = uiState.ffpMode;
          if (uiState.ffpDepth !== undefined) this.ffpDepth = uiState.ffpDepth;
          if (uiState.ffpRankLabelMode !== undefined)
            this.ffpRankLabelMode = uiState.ffpRankLabelMode;
          if (uiState.isDotMode !== undefined) {
            this.isDotMode = uiState.isDotMode;
            const avatarDotBtn = document.getElementById(
              "avatar-dot-toggle-btn",
            );
            if (avatarDotBtn) {
              avatarDotBtn.classList.toggle("active", this.isDotMode);
            }
            if (this.isDotMode) {
              this.cy.nodes().addClass("dot-mode");
            } else {
              this.cy.nodes().removeClass("dot-mode");
            }
          }
          if (uiState.isLightMode !== undefined) {
            this.isLightMode = uiState.isLightMode;
            const themeBtnIcon = document.querySelector("#theme-toggle-btn i");
            if (this.isLightMode) {
              document.documentElement.classList.add("light-mode");
              document.body.classList.add("light-mode");
              if (themeBtnIcon)
                themeBtnIcon.setAttribute("data-lucide", "moon");
            } else {
              document.documentElement.classList.remove("light-mode");
              document.body.classList.remove("light-mode");
              if (themeBtnIcon) themeBtnIcon.setAttribute("data-lucide", "sun");
            }
            if (typeof lucide !== "undefined") lucide.createIcons();
            this.updateStylesheetForMode();
          }
          if (uiState.globalGhostMode !== undefined) {
            this.globalGhostMode = uiState.globalGhostMode;
            const ghostBtn = document.getElementById("global-ghost-btn");
            if (ghostBtn)
              ghostBtn.classList.toggle("active", this.globalGhostMode);
            this.updateGlobalGhost();
          }
          if (uiState.showMutuals !== undefined) {
            this.showMutuals = uiState.showMutuals;
            const mutualBtn = document.getElementById("highlight-mutuals-btn");
            if (mutualBtn)
              mutualBtn.classList.toggle("active", this.showMutuals);
            this.updateStylesheetForMode(); // ensure it applies here as well
          }
          if (typeof this.updateFFPUI === "function") {
            this.updateFFPUI();
          }
        }

        // Defer select so it fires AFTER any layout animation (cose is async)
        // Select only the genuinely new nodes so user can drag them immediately
        setTimeout(() => {
          addedElements.nodes().select();
        }, 200);

        const skipped = elements.length - newElements.length;
        const msg =
          skipped > 0
            ? `Merged ${file.name}: ${newElements.length} new, ${skipped} updated`
            : `Imported ${file.name}`;
        this.showToast(msg);

        if (this.ffpMode !== "off") {
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
    const doc = new DOMParser().parseFromString(htmlString, "text/html");
    const profiles = [];
    const seenIds = new Set();
    const ingestDateTime = new Date().toISOString();

    if (mode === "seed") {
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

      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);
      if (lines.length > 0) {
        // Usually the first line is the ID and second is the display name
        id = lines[0].replace(/[@]/g, "");

        let possibleDisplayName = id;
        if (lines.length > 1) {
          const line2 = lines[1];
          // If the second line is a known stats keyword or a number, the display name was omitted
          if (
            !/^(?:\d+[KMBkmb]?|\d{1,3}(?:,\d{3})*|Following|Followers|Likes)$/i.test(
              line2,
            )
          ) {
            possibleDisplayName = line2;
          }
        }
        displayName = possibleDisplayName;

        // Hunt for stats and Bio
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase() === "following" && i > 0)
            followingCount = lines[i - 1];
          if (lines[i].toLowerCase() === "followers" && i > 0)
            followerCount = lines[i - 1];
          if (lines[i].toLowerCase() === "likes" && i > 0) {
            likesCount = lines[i - 1];
            // Bio is usually whatever follows "Likes"
            if (i + 1 < lines.length) {
              // Reconstruct bio from the remaining lines (might include links)
              bioText = lines.slice(i + 1).join("\n");
            }
          }
        }

        if (id && !seenIds.has(id)) {
          seenIds.add(id);

          // Try to find the avatar image from HTML if available
          const img = doc.querySelector('img[src*="tiktokcdn"]');
          const imgUrl = img ? img.getAttribute("src") : null;

          profiles.push({
            id: id,
            label: displayName,
            image:
              imgUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=random`,
            bio: bioText,
            following: followingCount,
            followers: followerCount,
            likes: likesCount,
            ingestTime: ingestDateTime,
          });
        }
      }
    } else {
      // METHOD 2: Anchor Links (Perfect for Follower/Following Lists)
      const anchors = Array.from(doc.querySelectorAll("a"));
      anchors.forEach((a) => {
        const href = a.getAttribute("href");
        if (!href) return;

        // Match /@username or https://www.tiktok.com/@username
        const match = href.match(/(?:tiktok\.com)?\/@([^?/#]+)/);
        if (!match) return;

        const id = match[1];
        if (seenIds.has(id)) return;
        seenIds.add(id);

        let container = a.closest("li") || a.parentElement;
        const img = container.querySelector("img");
        const imgUrl = img ? img.getAttribute("src") : null;

        const texts = Array.from(container.querySelectorAll("span, h3, h4, p"))
          .map((el) => el.textContent.trim())
          .filter((t) => t && t !== id);

        const displayName = texts.length > 0 ? texts[0] : id;

        profiles.push({
          id: id,
          label: displayName,
          image:
            imgUrl ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(id)}`,
          bio: "",
          following: "Unknown",
          followers: "Unknown",
          likes: "Unknown",
          ingestTime: ingestDateTime,
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
              ingestTime: ingestDateTime,
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
        node.data("type", "seed");
      }
      // Update node fields if the new scrape had more data
      if (profile.bio) node.data("bio", profile.bio);
      if (profile.following !== "Unknown")
        node.data("following", profile.following);
      if (profile.followers !== "Unknown")
        node.data("followers", profile.followers);

      // Override avatar if the new profile has a real image, unconditionally overwriting whatever was there
      const newImg = profile.image || "";
      if (newImg && !newImg.includes("dicebear.com")) {
        node.data("image", newImg);
      }
    } else {
      node = this.cy.add({
        group: "nodes",
        data: {
          id: profile.id,
          label: profile.label,
          type: isSeed ? "seed" : "normal",
          image: profile.image,
          bio: profile.bio || "",
          following: profile.following || "Unknown",
          followers: profile.followers || "Unknown",
          likes: profile.likes || "Unknown",
          ingestTime: profile.ingestTime || new Date().toISOString(),
        },
      });
    }

    if (this.isDotMode) {
      node.addClass("dot-mode");
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
        existingReverse.data("mutual", "true");
      }
    }

    this.cy.add({
      group: "edges",
      data: {
        id: edgeId,
        source: source,
        target: target,
        mutual: isMutual ? "true" : "false",
        ffpRank: rank,
        ffpDirection: rankDirection,
        ingestedAt: new Date().toISOString(),
      },
    });
  }

  applyFFPStyles() {
    // Reset old inline styles
    this.cy.edges().removeStyle("line-color");
    this.cy.edges().removeStyle("target-arrow-color");
    this.cy.edges().removeClass("faded");
    this.cy.nodes().removeClass("faded");

    if (this.ffpMode === "off") {
      return; // Back to default
    }

    const maxRank = this.ffpDepth;

    // Gradient generator: Rank 1 (Hot Pink) -> Rank N (Deep Blue) passing through Red/Orange/Green
    const getGradientColor = (rank) => {
      if (this.isLightMode) {
        if (maxRank <= 1) return "#db2777"; // Darker pink for white mode
        const rawRatio = (rank - 1) / (maxRank - 1);
        const hue = Math.round(340 - rawRatio * 140);
        // Darker lightness to stand out on bright white
        return `hsl(${hue}, 85%, 40%)`;
      } else {
        if (maxRank <= 1) return "#ec4899"; // Hot pink for dark mode
        const rawRatio = (rank - 1) / (maxRank - 1);
        const hue = Math.round(340 - rawRatio * 140);
        // Rich vivid lightness to glow on dark backgrounds
        return `hsl(${hue}, 90%, 60%)`;
      }
    };

    this.cy.batch(() => {
      const allEdges = this.cy.edges();
      allEdges.addClass("faded"); // Fade everything first

      // Collection to track which nodes are part of currently active FFP edges
      const activeNodes = this.cy.collection();

      allEdges.forEach((edge) => {
        const rank = edge.data("ffpRank");
        const dir = edge.data("ffpDirection");

        // Filter by mode
        if (this.ffpMode === "followers" && dir !== "followers") return;
        if (this.ffpMode === "following" && dir !== "following") return;

        // Check depth threshold
        if (rank != null && rank <= maxRank) {
          edge.removeClass("faded");
          const color = getGradientColor(rank);
          edge.style("line-color", color);
          edge.style("target-arrow-color", color);

          // Rank label: show number if toggle is on
          if (this.ffpRankLabelMode) {
            edge.style("label", String(rank));
            edge.style("font-size", "9px");
            edge.style("color", "#e2e8f0");
            edge.style("text-background-color", "#1e293b");
            edge.style("text-background-opacity", 0.75);
            edge.style("text-background-padding", "2px");
            edge.style("text-background-shape", "roundrectangle");
            edge.style("text-rotation", "autorotate");
          } else {
            edge.removeStyle("label");
          }

          // Track nodes attached to visible FFP edges
          activeNodes.merge(edge.source());
          activeNodes.merge(edge.target());
        }
      });

      // Re-apply global ghost logic now that FFP has updated active edges
      if (this.globalGhostMode) {
        this.updateGlobalGhost();
      } else {
        this.cy.nodes().removeClass("faded"); // Unfade all
      }
    });
  }

  applyKTrussStyles() {
    this.cy.edges().removeClass("ktruss-highlight");
    this.cy.nodes().removeClass("ktruss-highlight");
    this.cy.elements().removeClass("ktruss-faded");

    if (!this.ktrussMode) {
      if (this.globalGhostMode) this.updateGlobalGhost();
      return;
    }

    const k = this.ktrussK;
    const minTriangles = k - 2;

    let E = new Set(this.cy.edges().map((e) => e.id()));
    let changed = true;

    while (changed) {
      changed = false;

      const adj = new Map();

      this.cy.edges().forEach((e) => {
        if (!E.has(e.id())) return;
        const src = e.source().id();
        const tgt = e.target().id();
        if (src === tgt) return;

        if (!adj.has(src)) adj.set(src, new Set());
        if (!adj.has(tgt)) adj.set(tgt, new Set());

        adj.get(src).add(tgt);
        adj.get(tgt).add(src);
      });

      const edgesToRemove = [];

      this.cy.edges().forEach((e) => {
        if (!E.has(e.id())) return;
        const src = e.source().id();
        const tgt = e.target().id();
        if (src === tgt) return;

        let triangleCount = 0;
        const srcNeighbors = adj.get(src);
        const tgtNeighbors = adj.get(tgt);

        if (srcNeighbors && tgtNeighbors) {
          for (const n of srcNeighbors) {
            if (tgtNeighbors.has(n)) {
              triangleCount++;
            }
          }
        }

        if (triangleCount < minTriangles) {
          edgesToRemove.push(e.id());
        }
      });

      if (edgesToRemove.length > 0) {
        edgesToRemove.forEach((id) => E.delete(id));
        changed = true;
      }
    }

    const trussEdges = this.cy.edges().filter((e) => E.has(e.id()));
    const trussNodes = trussEdges.connectedNodes();

    if (trussEdges.length === 0 && trussNodes.length === 0) {
      this.showToast(`No ${k}-Truss found in this graph.`);
      this.cy.elements().addClass("ktruss-faded");
    } else {
      trussEdges.addClass("ktruss-highlight");
      trussNodes.addClass("ktruss-highlight");

      const nonTruss = this.cy
        .elements()
        .difference(trussEdges)
        .difference(trussNodes);
      nonTruss.addClass("ktruss-faded");
    }
  }

  updateGlobalGhost() {
    if (!this.globalGhostMode) {
      if (this.ffpMode !== "off") {
        this.applyFFPStyles(); // Let FFP take over fading if active
      } else {
        this.cy.elements().removeClass("faded"); // Normal
      }
      return;
    }

    // Global Ghost IS active
    const selectedElements = this.cy.elements(":selected");

    if (selectedElements.length > 0) {
      // Fade everything, then unfade selection
      this.cy.elements().addClass("faded");
      selectedElements.removeClass("faded");
      // If they selected a node, we should also unfade the edges immediately attached to the selected nodes?
      // The requirement says "fade any node and link not selected". Cytoscape allows edge selection.
      // So strictly fading unselected elements is correct.
    } else {
      // Nothing selected: show all (or defer to FFP if active)
      if (this.ffpMode !== "off") {
        this.applyFFPStyles();
      } else {
        this.cy.elements().removeClass("faded");
      }
    }
  }

  updateSelectedEdges() {
    // Clear previous selected edges
    this.cy.edges().removeClass("connected-selected");

    const selectedNodes = this.cy.nodes(":selected");
    if (selectedNodes.length > 1) {
      // .edgesWith() finds edges that connect a node in collection A to a node in collection A
      const connectedEdges = selectedNodes.edgesWith(selectedNodes);
      connectedEdges.addClass("connected-selected");

      if (this.globalGhostMode) {
        // Keep them visible even if not explicitly "selected"
        // but they technically connect selected nodes.
        connectedEdges.removeClass("faded");
      }
    }
  }

  // --- Graph Algorithms ---

  getBfsDistances(sourceId) {
    // Runs undirected BFS and returns a Map of id -> distance from source
    const dists = new Map();
    const q = [sourceId];
    dists.set(sourceId, 0);

    while (q.length > 0) {
      const currId = q.shift();
      const currDist = dists.get(currId);
      const node = this.cy.getElementById(currId);

      node.connectedEdges().forEach((e) => {
        const partnerId =
          e.source().id() === currId ? e.target().id() : e.source().id();
        if (!dists.has(partnerId)) {
          dists.set(partnerId, currDist + 1);
          q.push(partnerId);
        }
      });
    }
    return dists;
  }

  calculateShortestRoute() {
    const selectedNodes = this.cy.nodes(":selected");
    if (selectedNodes.length < 2) {
      this.showToast(
        "Select 2 or more nodes to find the shortest route between them.",
      );
      return;
    }

    this.saveState();
    const resultElements = this.cy.collection();

    // Convert to array of IDs
    const ids = selectedNodes.map((n) => n.id());

    // We run BFS from every selected node once, and store the distances map.
    const distMaps = new Map(); // id -> Map(id -> dist)
    ids.forEach((id) => {
      distMaps.set(id, this.getBfsDistances(id));
    });

    // For every pairwise combination of selected nodes:
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = ids[i];
        const B = ids[j];
        const distA = distMaps.get(A);
        const distB = distMaps.get(B);

        const shortestPathLen = distA.get(B);

        if (shortestPathLen === undefined) {
          continue; // No path exists between A and B
        }

        // Any node V is on A shortest path between A and B if:
        // dist(A, V) + dist(B, V) === dist(A, B)
        this.cy.nodes().forEach((n) => {
          const v = n.id();
          if (distA.has(v) && distB.has(v)) {
            if (distA.get(v) + distB.get(v) === shortestPathLen) {
              resultElements.merge(n);
            }
          }
        });

        // Any Edge E(u,v) is on a shortest path between A and B if it connects two nodes
        // on the shortest path in a way that increments the distance from A toward B.
        this.cy.edges().forEach((e) => {
          const u = e.source().id();
          const v = e.target().id();

          if (distA.has(u) && distB.has(u) && distA.has(v) && distB.has(v)) {
            // Check if travelling A -> u -> v -> B matches the exact length
            if (distA.get(u) + 1 + distB.get(v) === shortestPathLen) {
              resultElements.merge(e);
            }
            // Check reverse traversal A -> v -> u -> B
            else if (distA.get(v) + 1 + distB.get(u) === shortestPathLen) {
              resultElements.merge(e);
            }
          }
        });
      }
    }

    // We add the newly discovered shortest path elements to the current selection,
    // OR we can replace the selection. Replacing makes the most sense so the path isolates.
    this.cy.elements().unselect();
    resultElements.select();
    this.showToast("Shortest routes selected.");
  }

  computeKTrussAndColor(k) {
    // Reset all nodes to base colors and unhide all edges
    this.cy.nodes().removeClass("faded");
    this.cy.edges().removeClass("faded");

    // Remove old community styles
    for (let i = 1; i <= 6; i++) {
      this.cy.nodes().removeClass(`comm-${i}`);
    }

    if (this.cy.nodes().length < 3) {
      alert("Not enough nodes for meaningful structural analysis.");
      return;
    }

    // We operate on an undirected version of the graph for classic k-truss
    const adj = new Map();

    // Ensure every node is in adj
    this.cy.nodes().forEach((n) => adj.set(n.id(), new Set()));

    // Build adjacency from visible edges
    this.cy.edges().forEach((e) => {
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

        if (triangles < k - 2) {
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
      alert(
        `No communities found at k-truss level ${k}. Try a lower level or add more highly interconnected nodes.`,
      );
      return;
    }

    // Color the communities (max 6 unique colors, then loop or random)
    let colorIdx = 1;

    // Dim everything first
    this.cy.nodes().addClass("faded");
    this.cy.edges().addClass("faded");

    this.cy.batch(() => {
      components.forEach((comp) => {
        const cssClass = `comm-${((colorIdx - 1) % 6) + 1}`;

        // Ensure dynamic styles exist for these classes
        this.ensureCommunityStyle(cssClass, colorIdx);

        for (const nodeId of comp) {
          const node = this.cy.getElementById(nodeId);
          node.removeClass("faded");
          node.addClass(cssClass);

          // Un-fade connecting edges WITHIN the same community
          const connectedEdges = node.connectedEdges();
          connectedEdges.forEach((e) => {
            if (
              comp.includes(e.source().id()) &&
              comp.includes(e.target().id())
            ) {
              e.removeClass("faded");
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
    const colorVarValue = rootStyles
      .getPropertyValue(
        `--comm-${cssVarIdx > 6 ? (cssVarIdx % 6) + 1 : cssVarIdx}`,
      )
      .trim();

    // Since we already have basic node styling, we just update the dynamic stylesheet rules
    this.cy
      .style()
      .selector(`node.${className}`)
      .style("border-color", colorVarValue)
      .style("border-width", 4)
      .update();

    this.cy.style().selector(".faded").style("opacity", 0.2).update();
  }
}

// Boot application
window.addEventListener("DOMContentLoaded", () => {
  window.app = new GraphApp();
});
