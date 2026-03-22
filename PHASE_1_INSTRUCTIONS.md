# Phase 1: Basic Pet UI (Render + Drag)

## Task Breakdown
1. **Repository Setup:** Initialize the folder structure (`frontend/` and `backend/`).
2. **Backend (Python):** Create an asynchronous WebSocket server that accepts connections and logs incoming messages.
3. **Frontend (Tauri+React):** Construct a React app wrapped in Tauri with a transparent, borderless, always-on-top window. Render a basic pet sprite/shape.
4. **Interactivity:** Make the pet draggable using Tauri's built-in window dragging.
5. **Integration:** Establish a WebSocket client in React to connect to the Python backend on startup.

---

## Codex CLI Instructions (Backend)
**Context:** You are responsible for the Python backend of a modular AI desktop pet. 
**Task:** Initialize a Python WebSocket server to act as the core communication hub.
**Requirements:**
1. Create a `backend` directory.
2. Initialize a Python environment and `requirements.txt` containing `websockets` and `asyncio` (or `FastAPI` if preferred).
3. Write `main.py` that starts a WebSocket server listening on `ws://localhost:8765`.
4. Implement a clean connection handler that accepts JSON payloads, logs them, and can send back basic acknowledgments (e.g., `{"status": "connected"}`).
5. Ensure the code is production-ready, modular, and well-documented.

---

## Gemini CLI Instructions (Frontend)
**Context:** You are responsible for the UI/UX and interaction of a modular AI desktop pet frontend using Tauri + React (TypeScript).
**Task:** Create a transparent, draggable pet overlay that connects to the backend.
**Requirements:**
1. Create a `frontend` directory and initialize a Tauri + React app (`npx create-tauri-app@latest`).
2. Modify `tauri.conf.json` to make the main window:
   - `transparent: true`
   - `decorations: false`
   - `alwaysOnTop: true`
3. In React, render a simple placeholder pet sprite or shape (e.g., a 100x100 colored div).
4. Implement `data-tauri-drag-region` on the pet element so the user can drag the window around the screen.
5. Implement a WebSocket client in React using `useEffect` that connects to `ws://localhost:8765` and sends a `{"type": "init"}` message on load.
6. Provide styling to ensure the background remains fully transparent.

---

## Integration Notes
- **Contract:** All communication uses JSON. Base format: `{"type": "action_name", "payload": {}}`.
- **Execution Order:**
  1. Start backend: `python backend/main.py`
  2. Start frontend: `cd frontend && npm run tauri dev`
- **Verification:** The backend console should log the `"init"` event from the frontend. The pet UI should be visible over other windows and freely draggable.
