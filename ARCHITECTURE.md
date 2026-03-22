# DigiPet Architecture

## 1. Frontend (Tauri + React) - "The Cerebellum"
- **Role:** The nervous system and motor control. Renders the pet, handles UI/UX, animations, and executes frictionless local physics.
- **Key Features:**
  - Full-screen transparent overlay (unbound from a tiny box).
  - Integrated 60FPS Physics Engine (`matter.js` or `rapier`) to handle gravity, velocity, drag-and-throw inertia, and screen-edge collisions.
  - Pointer-event routing (click-through the void, interact with the entity).

## 2. Backend (Python Service) - "The Cortex"
- **Role:** Handles heavy cognitive AI processing, state management, and reasoning.
- **Key Modules:**
  - Vision module (screen capture + OCR).
  - **Emergent Behavior Engine (Utility AI):** Simulates internal drives (Energy, Affection, Boredom) driving an action-utility evaluator for spontaneous action.
  - RL module (reinforcement learning for adapting behavior).
  - LLM interface (for personality, dialogue).

## 3. Communication Layer
- **Role:** Bridges the high-speed motor control with the intelligent brain.
- **Protocol:** WebSockets (JSON payloads).
- **Flow:**
  - Frontend publishes sensor data (pet coordinates, collision events, user clicks) to backend.
  - Backend computes cognitive state and sends high-level impulses (`jump`, `walk_left(force=0.5)`, `play_animation(sleeping)`) down to frontend.
