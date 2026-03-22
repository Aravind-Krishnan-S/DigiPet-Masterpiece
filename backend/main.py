"""
DigiPet Cortex — The Cognitive Engine
=====================================
Implements:
  - Psyche (Homeostatic Drives: Energy, Affection, Boredom)
  - Personality Traits (unique per session)
  - Circadian Rhythm (real system clock influences drives)
  - Utility AI Action Evaluator
  - WebSocket bridge to the Motor Cerebellum (React/Tauri)
"""

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager
import json
import logging
import random
import math
from datetime import datetime
import mss
import pytesseract
from PIL import Image

# Initialize Tesseract OCR Path (Standard Windows 64-bit Directory)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

logging.basicConfig(level=logging.INFO, format="%(asctime)s [Cortex] %(message)s")


# ──────────────────────────────────────────────────────────
#  PERSONALITY — Randomized soul-seed, unique every session
# ──────────────────────────────────────────────────────────
class Personality:
    """Each pet instance gets a unique personality that biases its utility scores."""

    ARCHETYPES = ["Hyperactive", "Lazy", "Needy", "Independent", "Chaotic"]

    def __init__(self):
        self.archetype = random.choice(self.ARCHETYPES)
        # Bias multipliers (1.0 = neutral, >1 = amplified, <1 = dampened)
        self.energy_decay_mult   = 1.0
        self.boredom_growth_mult = 1.0
        self.affection_decay_mult = 1.0
        self.zoomies_bias  = 1.0
        self.sleep_bias    = 1.0
        self.attention_bias = 1.0

        if self.archetype == "Hyperactive":
            self.energy_decay_mult = 0.6      # burns energy slowly
            self.boredom_growth_mult = 1.8    # gets bored fast
            self.zoomies_bias = 1.5
        elif self.archetype == "Lazy":
            self.energy_decay_mult = 1.5      # tires quickly
            self.sleep_bias = 1.8
            self.boredom_growth_mult = 0.5
        elif self.archetype == "Needy":
            self.affection_decay_mult = 2.0   # craves attention
            self.attention_bias = 2.0
        elif self.archetype == "Independent":
            self.affection_decay_mult = 0.3
            self.attention_bias = 0.4
        elif self.archetype == "Chaotic":
            self.energy_decay_mult = random.uniform(0.5, 1.5)
            self.boredom_growth_mult = random.uniform(0.8, 2.0)
            self.zoomies_bias = random.uniform(1.0, 2.5)

        logging.info(f"🧬 Personality initialized: {self.archetype}")

    def to_dict(self):
        return {"archetype": self.archetype}


# ──────────────────────────────────────────────────────────
#  PSYCHE — Internal Homeostatic Drive System
# ──────────────────────────────────────────────────────────
class Psyche:
    """Simulates the internal emotional state of the digital pet."""

    def __init__(self, personality: Personality):
        self.personality = personality
        self.energy     = 80.0   # 0 = exhausted, 100 = hypercharged
        self.affection  = 50.0   # 0 = lonely, 100 = loved
        self.boredom    = 20.0   # 0 = stimulated, 100 = dying of boredom

    def tick(self, dt: float = 1.0):
        """Called every metabolism cycle. Drives decay/grow organically."""
        hour = datetime.now().hour

        # ── Circadian Rhythm ──
        # Late night (11pm - 5am): energy drains faster
        # Morning (6am - 10am): energy recovers slightly
        circadian_energy_mod = 1.0
        if 23 <= hour or hour < 5:
            circadian_energy_mod = 1.8   # exhaustion accelerates at night
        elif 6 <= hour <= 10:
            circadian_energy_mod = 0.5   # morning vigor

        p = self.personality
        self.energy    = max(0, min(100, self.energy    - 0.3 * dt * p.energy_decay_mult * circadian_energy_mod))
        self.boredom   = max(0, min(100, self.boredom   + 0.4 * dt * p.boredom_growth_mult))
        self.affection = max(0, min(100, self.affection  - 0.15 * dt * p.affection_decay_mult))

    def receive_stimulus(self, event: str):
        """Process sensory feedback from the Cerebellum."""
        if event == "grabbed":
            self.affection = min(100, self.affection + 15)
            self.boredom   = max(0, self.boredom - 10)
            logging.info(f"💕 Stimulus: grabbed → Affection={self.affection:.0f}, Boredom={self.boredom:.0f}")
        elif event == "thrown":
            self.boredom   = max(0, self.boredom - 25)
            self.energy    = max(0, self.energy - 5)
            logging.info(f"🌪️ Stimulus: thrown → Boredom={self.boredom:.0f}, Energy={self.energy:.0f}")
        elif event == "clicked":
            self.affection = min(100, self.affection + 8)
            logging.info(f"👆 Stimulus: clicked → Affection={self.affection:.0f}")

    def to_dict(self):
        return {
            "energy":    round(self.energy, 1),
            "affection": round(self.affection, 1),
            "boredom":   round(self.boredom, 1),
        }


# ──────────────────────────────────────────────────────────
#  ACTIONS — Each action knows how to score itself
# ──────────────────────────────────────────────────────────
class Action:
    def __init__(self, name: str, mood: str):
        self.name = name
        self.mood = mood

    def score(self, psyche: Psyche, personality: Personality) -> float:
        raise NotImplementedError

    def get_impulses(self) -> list[dict]:
        raise NotImplementedError


class SleepAction(Action):
    def __init__(self):
        super().__init__("Sleep", "Sleepy 💤")

    def score(self, psyche, personality):
        # Exponential desire to sleep as energy approaches 0
        base = (100 - psyche.energy) ** 1.5 / 100
        return base * personality.sleep_bias

    def get_impulses(self):
        # Gentle settle-down: no force, just a status change
        return [{"type": "impulse", "vector": {"x": 0, "y": 0}, "mood": self.mood, "animation": "sleep"}]


class WanderAction(Action):
    def __init__(self):
        super().__init__("Wander", "Curious 🔍")

    def score(self, psyche, personality):
        if psyche.energy < 15:
            return 0  # too tired to wander
        return (psyche.boredom * 0.5 + (100 - psyche.affection) * 0.2) / 100 * 8

    def get_impulses(self):
        direction = random.choice([-1, 1])
        return [{"type": "impulse", "vector": {"x": direction * random.uniform(0.02, 0.08), "y": -0.02}, "mood": self.mood, "animation": "walk"}]


class ZoomiesAction(Action):
    def __init__(self):
        super().__init__("Zoomies", "ZOOMIES!! ⚡")

    def score(self, psyche, personality):
        if psyche.energy < 30:
            return 0
        # High energy + high boredom = ZOOMIES
        return (psyche.energy * 0.4 + psyche.boredom * 0.6) / 100 * 10 * personality.zoomies_bias

    def get_impulses(self):
        # Rapid chaotic bursts!
        impulses = []
        for _ in range(random.randint(3, 6)):
            impulses.append({
                "type": "impulse",
                "vector": {
                    "x": random.uniform(-0.15, 0.15),
                    "y": random.uniform(-0.5, -0.2)
                },
                "mood": self.mood,
                "animation": "zoomies"
            })
        return impulses


class DemandAttentionAction(Action):
    def __init__(self):
        super().__init__("Demand Attention", "Notice me! 🥺")

    def score(self, psyche, personality):
        # Craves attention when affection is low
        base = ((100 - psyche.affection) ** 1.3) / 100
        return base * personality.attention_bias

    def get_impulses(self):
        # Small bounce to attract attention
        return [
            {"type": "impulse", "vector": {"x": 0, "y": -0.15}, "mood": self.mood, "animation": "bounce"},
            {"type": "impulse", "vector": {"x": random.uniform(-0.03, 0.03), "y": -0.1}, "mood": self.mood, "animation": "bounce"},
        ]


# ──────────────────────────────────────────────────────────
#  UTILITY EVALUATOR — The Decision Engine
# ──────────────────────────────────────────────────────────
class UtilityEvaluator:
    def __init__(self):
        self.actions: list[Action] = [
            SleepAction(),
            WanderAction(),
            ZoomiesAction(),
            DemandAttentionAction(),
        ]

    def evaluate(self, psyche: Psyche, personality: Personality) -> Action:
        scores = [(a, a.score(psyche, personality)) for a in self.actions]
        # Add small noise for unpredictability
        scores = [(a, s + random.uniform(0, 1.5)) for a, s in scores]
        scores.sort(key=lambda x: x[1], reverse=True)

        winner = scores[0]
        logging.info(f"🎯 Utility Auction: {', '.join(f'{a.name}={s:.1f}' for a, s in scores)} → Winner: {winner[0].name}")
        return winner[0]


# ──────────────────────────────────────────────────────────
#  VISION SYSTEM — Screen Capture and OCR
# ──────────────────────────────────────────────────────────
class VisionSystem:
    def __init__(self):
        self.current_context = "Idle"
        
    def analyze_screen(self):
        try:
            with mss.mss() as sct:
                monitor = sct.monitors[1]  # Primary monitor
                sct_img = sct.grab(monitor)
            img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
            # Downscale by 4x to vastly accelerate OCR time
            img = img.resize((img.width // 4, img.height // 4))
            
            text = pytesseract.image_to_string(img).lower()
            
            if "youtube" in text or "video" in text or "netflix" in text:
                return "Watching Video"
            elif "github" in text or "vscode" in text or "code" in text or "import " in text or "function" in text:
                return "Coding"
            elif "discord" in text or "chat" in text or "message" in text:
                return "Chatting"
            elif "reddit" in text or "twitter" in text or "browser" in text or "search" in text:
                return "Browsing Web"
            else:
                return "Idle"
        except Exception as e:
            logging.error(f"Vision error: {e}")
            return "Vision Impaired"

vision = VisionSystem()

# ──────────────────────────────────────────────────────────
#  MAIN SERVER — WebSocket Cortex
# ──────────────────────────────────────────────────────────
personality = Personality()
psyche = Psyche(personality)
evaluator = UtilityEvaluator()
connected_clients: set = set()


async def metabolism_loop():
    """Background coroutine: The pet's internal clock ticks every second."""
    while True:
        await asyncio.sleep(1)
        psyche.tick(dt=1.0)


async def behavior_loop():
    """Background coroutine: Every 5 seconds, evaluate and broadcast an action."""
    while True:
        await asyncio.sleep(5)
        if not connected_clients:
            continue

        action = evaluator.evaluate(psyche, personality)
        impulses = action.get_impulses()

        # Broadcast state + impulses to all connected frontends
        state_msg = json.dumps({
            "type": "state_update",
            "psyche": psyche.to_dict(),
            "personality": personality.to_dict(),
        })

        for ws in connected_clients.copy():
            try:
                await ws.send_text(state_msg)
                for impulse in impulses:
                    impulse_msg = json.dumps(impulse)
                    await ws.send_text(impulse_msg)
                    await asyncio.sleep(0.3)  # stagger bursts for zoomies
            except Exception:
                connected_clients.discard(ws)


async def vision_loop():
    """Background coroutine: The pet's eyes. Captures screen and runs OCR every 3 seconds."""
    while True:
        await asyncio.sleep(3)
        if not connected_clients:
            continue
            
        loop = asyncio.get_running_loop()
        context = await loop.run_in_executor(None, vision.analyze_screen)
        
        if context != vision.current_context:
            logging.info(f"👁️ Vision Context Changed: {vision.current_context} -> {context}")
            vision.current_context = context
            
            vision_msg = json.dumps({
                "type": "vision_update",
                "context": context
            })
            for ws in connected_clients.copy():
                try:
                    await ws.send_text(vision_msg)
                except Exception:
                    connected_clients.discard(ws)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("══════════════════════════════════════════════")
    logging.info("  DigiPet Cortex Engine v3.0 (FastAPI AI)")
    logging.info(f"  Personality: {personality.archetype}")
    logging.info(f"  Circadian Hour: {datetime.now().hour}")
    logging.info("══════════════════════════════════════════════")
    
    t1 = asyncio.create_task(metabolism_loop())
    t2 = asyncio.create_task(behavior_loop())
    t3 = asyncio.create_task(vision_loop())
    yield
    t1.cancel()
    t2.cancel()
    t3.cancel()

app = FastAPI(lifespan=lifespan)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logging.info(f"🔌 New Cerebellum attached: {websocket.client}")
    await websocket.accept()
    connected_clients.add(websocket)

    # Send initial state
    await websocket.send_text(json.dumps({
        "status": "connected",
        "message": "Cognitive Cortex online.",
        "personality": personality.to_dict(),
        "psyche": psyche.to_dict(),
        "vision_context": vision.current_context,
    }))

    try:
        while True:
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                logging.info(f"📡 Input: {data}")

                if data.get("type") == "init":
                    await websocket.send_text(json.dumps({
                        "type": "state_update",
                        "psyche": psyche.to_dict(),
                        "personality": personality.to_dict(),
                        "vision_context": vision.current_context,
                    }))

                elif data.get("type") == "sensory":
                    psyche.receive_stimulus(data.get("event", "clicked"))
                    await websocket.send_text(json.dumps({
                        "type": "state_update",
                        "psyche": psyche.to_dict(),
                        "personality": personality.to_dict(),
                    }))

                elif data.get("type") == "poke":
                    psyche.receive_stimulus("clicked")
                    action = evaluator.evaluate(psyche, personality)
                    for impulse in action.get_impulses():
                        await websocket.send_text(json.dumps(impulse))
                        await asyncio.sleep(0.15)

            except json.JSONDecodeError:
                logging.warning(f"⚠️ Non-JSON garbage rejected: {message}")
    except WebSocketDisconnect as e:
        logging.info(f"🔌 Cerebellum disconnected: {e}")
    finally:
        connected_clients.discard(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8766, reload=True)
