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
- **Radial Context Menu**: Long-click or right-click any node to access all primary investigative actions.
- **Unified Bulk Actions**: Selecting multiple nodes and clicking **Lock** or **Note** applies those changes to the entire selection instantly.
- **Data-Informed Notes**: The bulk note editor comes pre-populated with existing intelligence (`@user : note`), ensuring you never lose context.

### 4. Real-Time Intelligence
- **Universal Hover Panel**: Mouse over any account to see bios, stats, and investigator notes without clicking (400ms steady delay).
- **Rank by Influence**: Power-scale node sizes (up to 180px) to instantly identify network hubs.
- **Dynamic Visuals**: Adjust link label sizing and transparency via the **Graph Preferences** menu.

### 5. Advanced Analysis Tools
- **FFP Mode**: Force-Followed-Paths logic for finding hidden connections.
- **Global Ghost Mode**: Fade the rest of the graph to focus on specific clusters.
- **Snap-to-Grid**: Neatly organize your intelligence map for screenshots.
- **Ego Networks**: Focus on the 1-hop or 2-hop neighborhood of a specific target.

## 🛠 Usage

1. **Ingest**: Paste TikTok profile elements into the DATA menu.
2. **Branch**: If a cluster looks interesting, select it and click **Isolate Selection** to open it in a new tab.
3. **Analyze**: Use the influence toggle to find hubs or global ghost to find clusters.
4. **Annotate**: Right-click selections to add bulk notes or lock nodes in place.
5. **Report**: Export a CSV for raw data analysis or a .docx for formal reporting.

---
*Built for Wayfinder Intelligence.*
