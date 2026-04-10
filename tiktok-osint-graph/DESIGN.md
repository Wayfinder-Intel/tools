# Architecture & Design Principles

This document outlines the core architectural patterns and design philosophies of the TikTok OSINT Graph Builder. Future developers and AI agents should adhere to these principles to maintain systemic integrity and performance.

## 1. State Handover (Workspace Isolation)
The "Isolate Selection" feature uses a secure data handoff mechanism to branch investigations.
- **Mechanism**: `sessionStorage` is used to store a serialized JSON payload of the sub-graph.
- **Payload Structure**: Contains `elements` (nodes/edges) and a `uiState` object.
- **State Parity**: The `bootFromSerializedState()` method in `app.js` is responsible for restoring UI toggles (K-Truss, Ghost Mode, etc.) to ensure a seamless transition between tabs.
- **Guideline**: When adding new "global" UI modes, ensure their state is captured in `isolateToNewTab()` and restored in `applyImportedUiState()`.

## 2. Performance & Batching
With graphs potentially exceeding 1,000+ elements, UI responsiveness is critical.
- **Principle**: Minimize DOM / Cytoscape thrashing.
- **Implementation**: Always wrap mass data updates or style changes (like K-Truss coloring or Global Ghost mode) in `this.cy.batch(() => { ... })`.
- **Note Badges**: Note and Lock badges are implemented as DOM overlays rather than Cytoscape labels for maximum flexibility with icons and hover effects. Use `refreshNoteBadges()` sparingly or targeted at specific nodes.

## 3. Contextual UI Patterns
The tool prioritizes a "graph-first" workflow by moving non-ingest actions into the radial menu.
- **Solo vs. Bulk Logic**: The `btn-note-node` (Radial Menu) uses logic to detect the current selection. If `selection > 1`, it triggers the `openBulkNoteModal()`. If `selection === 1`, it opens the focused `openNoteEditor()`.
- **Locking Lifecycle**: Manual locking (`node.lock()`) is complemented by a data attribute `locked: true`. Both must be synchronized to ensure UI badges and physics remain consistent.

## 4. Coordinate Management
Initial ingestions often result in cluttered "center-point" clusters.
- **Scatter Logic**: The `positionAfterIngest()` method handles initial placement.
- **Collision Avoidance**: We use a `positionImportedNodes()` helper to check for overlaps and "push" new data into empty quadrants, preventing overwhelming the user with overlapping profiles.

## 5. Security & Privacy
- **Referrer Policy**: `no-referrer` is globally enforced in `index.html` to prevent leaking TikTok profile IDs to third-party CDNs when fetching avatars.
- **Data Persistence**: No data is sent to a backend. All intelligence remains local to the browser's memory and optionally `sessionStorage`.

---
*Maintained for Wayfinder Intelligence Architecture.*
