# ScribblBoard - Collaborative Whiteboard Application

A high-performance whiteboard web application built for marketing and school projects. Built with **React 19**, **Konva.js**, **Yjs (CRDT)**, and **y-indexeddb** for local persistence, with an architecture ready for seamless transition to real-time multiplayer collaboration.

## 🚀 Key Features

### 1. CRDT State Architecture (Yjs)
- **Decoupled State**: All canvas data (shapes, strokes, text, images, notes, z-index, timestamps) is stored in a `Y.Doc` shared map (`Y.Map<CanvasElement>`).
- **Unidirectional Subscription**: Canvas render cycles subscribe to Yjs state changes rather than binding directly to transient local canvas state.
- **Undo / Redo**: Integrated native `Y.UndoManager` for history tracking across CRDT transactions.

### 2. URL Routing for Boards
- Generates a unique UUID for each new board (`?board=[uuid]`).
- Updates browser URL parameters using the History API without page reloads.
- Persists board state in browser **IndexedDB** (`y-indexeddb`) keyed by the board UUID (`whiteboard-board-[uuid]`).
- Refreshing the page or sharing the link loads the exact state for that board ID.

### 3. Multiplayer Readiness
- Architecture is designed to connect a real-time network provider (`y-websocket` or `y-webrtc`) with zero refactoring of the canvas or component layers:
  ```ts
  // In src/services/yjsDoc.ts
  import { WebsocketProvider } from 'y-websocket';
  const wsProvider = new WebsocketProvider('wss://your-server.com', boardId, this.doc);
  ```

### 4. Interactive Canvas Operations
- **Infinite Pan**: Hold `Spacebar + Drag`, middle-click drag, or use the **Hand Tool (`H`)**.
- **Smooth Zoom**: Mouse wheel zoom centered at cursor pointer, with zoom limits (10% to 500%).
- **Interactive Grid**: Switch between `Dots`, `Grid Lines`, and `None`.

### 5. Drawing & Creation Tools
- **Select & Move (`V`)**: Single or multi-selection, drag, rotate, and scale bounding boxes via Konva Transformer.
- **Freehand Pen (`P`)**: Smooth stroke rendering with configurable thickness and color.
- **Geometric Shapes**: Rectangles (`R`), Circles/Ellipses (`C`), Arrows (`A`), Straight Lines (`L`).
- **Sticky Notes (`S`)**: Realistic post-it notes with 6 pastel themes, drop shadow, auto-wrapping text, and double-click inline editor.
- **Text Tool (`T`)**: Scalable text items with font size and color controls.
- **Eraser (`E`)**: One-click or drag deletion of elements.

### 6. Media Handling & Exports
- **Drag-and-Drop Images**: Drag image files (`.png`, `.jpg`, `.svg`, `.webp`) directly from your desktop onto the canvas.
- **Clipboard Paste**: Paste images or screenshots directly (`Ctrl+V` / `Cmd+V`).
- **High-Resolution Exports**:
  - Viewport export (1x PNG)
  - Full board export (2x High-Definition PNG)
  - Print-ready export (3x Ultra HD PNG)
- **JSON Backup & Restore**: Download complete board data or import backups.

---

## 🛠 Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Canvas Rendering:** Konva.js / React-Konva
- **CRDT Engine:** Yjs
- **Local Persistence:** `y-indexeddb`
- **Build Tool:** Vite

---

## 💻 Getting Started

### Development
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

### Production Build
```bash
npm run build
```
The built assets will be located in the `dist/` directory.
