# Scribblboard - Real-Time Collaborative Whiteboard

Scribblboard is a fast, lightweight collaborative whiteboard built with **React 19**, **Konva.js**, and **Yjs CRDTs**. It provides offline persistence via IndexedDB and peer sync through WebSocket/WebRTC providers.

---

## Features

### Real-Time Collaboration & CRDT State
- **Decoupled CRDT Engine**: Canvas items (shapes, strokes, text, images, notes, frames, z-index) are maintained in a `Y.Doc` shared map (`Y.Map<CanvasElement>`).
- **Live Peer Cursors & Presence**: Real-time cursor coordinates and user badges broadcasted through Yjs Awareness.
- **Presenter Spotlight & Follow Mode**: Click on any peer avatar to follow their screen view in real time; pan or press `Esc` to detach.
- **Ephemeral Laser Pointer (`K`)**: Presentations emit glowing laser trails synced live across peers without polluting persistent board state.
- **Emoji Reactions & Threaded Comments**: Add reaction counters to canvas items or open threaded discussion panels with comment resolution.
- **Undo / Redo**: Integrated with native `Y.UndoManager` (`Ctrl+Z`, `Ctrl+Y`).

### Canvas & Structural Layout
- **Object Locking (`Ctrl+L`)**: Prevent accidental moves, transforms, or deletion of background templates and diagrams.
- **Grouping & Ungrouping (`Ctrl+G` / `Ctrl+Shift+G`)**: Group multiple items into a single bounding box for unified transform and atomic movement.
- **Alignment & Distribution**: Align Left, Center, Right, Top, Middle, Bottom and distribute elements horizontally or vertically with even gaps.
- **Smart Snapping & Dynamic Guides**: Snaps to nearby element edges and centerlines with temporary guide lines.
- **Frames / Artboards (`F`)**: Dedicated container cards with editable titles that automatically bundle and move child items together.
- **Interactive Radar Minimap**: Collapsible bird's-eye canvas viewport indicator in the corner with click-to-pan.
- **Starter Templates**: 1-click starter setups for **Kanban Boards**, **Sprint Retrospectives**, **Flowcharts**, and **SWOT Matrices**.

### Drawing, Media & Export
- **Drawing Tools**: Freehand Pen (`P`), Rectangles (`R`), Circles (`C`), Straight Lines (`L`), and Magnetic Arrows (`A`) with snap anchors.
- **Sticky Notes (`S`) & Text (`T`)**: 6 pastel color themes, shadow effects, auto-wrapping text, and double-click inline text editing.
- **Image Insertion**: Drag-and-drop images from desktop, file picker, or clipboard paste (`Ctrl+V`).
- **Export Options**: Export high-resolution PNG (1x, 2x, 3x), JPEG, SVG vector, or multi-page PDF documents.
- **JSON Backup & Restore**: Complete board state export and restore.

---

## Tech Stack

- **Framework**: React 19, TypeScript
- **Rendering**: Konva.js / React-Konva
- **CRDT & Sync**: Yjs, `y-indexeddb`, `y-websocket`
- **Styling & UI**: Tailwind CSS, Lucide Icons
- **Build Tool**: Vite
- **Testing**: Vitest

---

## Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `V` | Select & Move tool |
| `H` / `Space + Drag` | Hand / Pan canvas |
| `K` | Temporary Laser Pointer |
| `P` | Freehand Pen |
| `R` / `C` | Rectangle / Circle |
| `F` | Frame / Artboard |
| `A` / `L` | Arrow (Snaps to shapes) / Straight Line |
| `S` / `T` | Sticky Note / Text block |
| `E` | Eraser |
| `Ctrl + L` | Lock / Unlock selected elements |
| `Ctrl + G` | Group selected elements (2+ items) |
| `Ctrl + Shift + G` | Ungroup selected elements |
| `Ctrl + C` / `X` / `V` | Copy, Cut, Paste |
| `Ctrl + D` | Duplicate selection |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo |
| `?` | Keyboard shortcuts cheat sheet |

---

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Run Tests
```bash
npm test -- --run
```

### Production Build
```bash
npm run build
```
