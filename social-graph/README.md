# TikTok OSINT Graph Builder

A professional Cytoscape-based OSINT tool for mapping, analyzing, and reporting on TikTok follower/following networks.

## 🚀 Key Features

### 1. Investigation Isolation (Workspace Branching)
Branch your investigation into focused workspaces without losing progress.
- **Isolate Selection**: Select a cluster of nodes and export them to a complete, fresh browser tab.
- **State Parity**: The new tab automatically inherits your UI state, including K-Truss settings, influence scaling, and ghost modes.
- **Sub-graph Focus**: Perfect for deep-diving into a specific community while keeping your main broad-map open.

### 2. Comprehensive Graph Data Export
Export full network intelligence in portable formats.
- **OSINT Collections Report (.docx)**: Generate professional, offline reports with embedded identity cards, avatars, and findings.
- **Graph Data CSV**: A unified "sectioned" CSV containing both detailed **Account Metadata** (Nodes) and complete **A:B Relationship Linkages** (Edges) with timestamps.

### 3. Integrated Contextual Workflow
A streamlined UI focus on the graph itself.
- **Radial Context Menu**: Long-click or right-click any node or link to access investigative actions.
- **Link Annotations**: Right-click any link to add focused notes. Visual "pencil" badges appear at link midpoints for instant access.
- **Unified Bulk Actions**: Selecting multiple nodes and clicking **Lock** or **Note** applies those changes to the entire selection instantly.
- **Data-Informed Notes**: Both node and link note editors come pre-populated with existing intelligence, ensuring you never lose context.

### 4. Real-Time Intelligence
- **Universal Hover Panel**: Mouse over any account to see bios, stats, and investigator notes without clicking (400ms steady delay).
- **Rank by Influence**: Power-scale node sizes (up to 180px) to instantly identify network hubs.
- **Dynamic Visuals**: Adjust link label sizing and transparency via the **Graph Preferences** menu.

### 5. Advanced Analysis Tools
- **K-Truss Communities**: Identify deeply interconnected subgroups. Powered by Cohen's Linear Algorithm, the graph engine gracefully processes massive $O(E \sqrt{E})$ workloads.
- **Find Overlaps**: Instantly isolate structural common denominators using ultra-fast native ES6 Javascript Map caching logic.
- **FFP Mode**: Force-Followed-Paths logic for finding hidden connections.
- **Global Ghost Mode**: Fade the rest of the graph to focus on specific clusters.
- **Snap-to-Grid**: Neatly organize your intelligence map for screenshots.
- **Ego Networks**: Focus on the 1-hop or 2-hop neighborhood of a specific target.

### 6. Enhanced OSINT Reporting
- **Sectioned Collection Report**: The .docx Intelligence Report now includes granular per-seed analysis.
- **Ingest Coverage**: Every seed in the graph gets a dedicated breakdown of "Imported vs Total Seen" followers/following.
- **Account Tables**: Detailed tables for every seed identifying exactly which accounts were ingested for the current project.

## 🛠 Usage

1. **Ingest**: Paste TikTok profile elements into the DATA menu.
2. **Branch**: If a cluster looks interesting, select it and click **Isolate Selection** to open it in a new tab.
3. **Analyze**: Use the influence toggle to find hubs or global ghost to find clusters.
4. **Annotate**: Right-click selections to add bulk notes or lock nodes in place.
5. **Report**: Export a CSV for raw data analysis or a .docx for formal reporting.

---
*Built for Wayfinder Intelligence.*
