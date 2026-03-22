import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import './index.css';

import { RenderModeProvider } from './context/RenderMode';
import { invoke } from '@tauri-apps/api/core';
import PetRenderer from './components/PetRenderer';
import HudPanel from './components/HudPanel';

interface Drives {
  energy: number;
  affection: number;
  boredom: number;
}

function AppInner() {
  const [status, setStatus] = useState('Connecting...');
  const [mood, setMood] = useState('Idle');
  const [drives, setDrives] = useState<Drives>({ energy: 80, affection: 50, boredom: 20 });
  const [personality, setPersonality] = useState('Unknown');
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [visionContext, setVisionContext] = useState('Idle');

  const petRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null); // Added dashboardRef
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);

  const engineRef = useRef(Matter.Engine.create());
  const wsRef = useRef<WebSocket | null>(null);
  const petBodyRef = useRef<Matter.Body | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Continuously report opaque rects to Rust backend for native click-through toggling
  useEffect(() => {
    let lastRectsStr = '';
    let interval: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const rects = [];
      const dpr = window.devicePixelRatio || 1;
      // Get physical screen coordinates by adding window position and multiplying by DPI scale
      const toPhysical = (val: number, isX: boolean) => 
        (val + (isX ? window.screenX : window.screenY)) * dpr;

      if (petRef.current) {
        const r = petRef.current.getBoundingClientRect();
        rects.push({ 
          x: toPhysical(r.left, true), 
          y: toPhysical(r.top, false), 
          width: r.width * dpr, 
          height: r.height * dpr 
        });
      }
      if (dashboardRef.current) {
        const r = dashboardRef.current.getBoundingClientRect();
        rects.push({ 
          x: toPhysical(r.left, true), 
          y: toPhysical(r.top, false), 
          width: r.width * dpr, 
          height: r.height * dpr 
        });
      }
      const newStr = JSON.stringify(rects);
      if (newStr !== lastRectsStr) {
        lastRectsStr = newStr;
        try {
          await invoke('update_opaque_rects', { rects }).catch(console.error);
        } catch (e) {
          console.warn('Tauri invoke not available yet:', e);
        }
      }
      interval = setTimeout(poll, 50);
    };
    interval = setTimeout(poll, 50);

    return () => clearTimeout(interval);
  }, []);

  // Track mouse globally for eye-tracking + 3D lean
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const engine = engineRef.current;
    engine.gravity.y = 0.5;

    // Boundary walls
    const ground    = Matter.Bodies.rectangle(w / 2, h + 50, w, 100, { isStatic: true });
    const leftWall  = Matter.Bodies.rectangle(-25, h / 2, 50, h, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(w + 25, h / 2, 50, h, { isStatic: true });
    const ceiling   = Matter.Bodies.rectangle(w / 2, -50, w, 100, { isStatic: true });

    // Pet rigid body - Start in center instead of off-screen
    const petBody = Matter.Bodies.circle(w / 2, h / 2, 60, {
      restitution: 0.9,
      friction: 0.1,
      density: 0.001,
    });
    petBodyRef.current = petBody;

    // Separate collision groups
    petBody.collisionFilter.category = 0x0002;

    Matter.World.add(engine.world, [ground, leftWall, rightWall, ceiling, petBody]);

    // Mouse constraint for grab-and-throw
    const renderMouse = Matter.Mouse.create(document.body);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: renderMouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Matter.World.add(engine.world, mouseConstraint);

    // Sensory feedback on drag
    Matter.Events.on(mouseConstraint, 'startdrag', (event: any) => {
      if (event.body === petBody) {
        wsRef.current?.send(JSON.stringify({ type: 'sensory', event: 'grabbed' }));
      }
    });
    Matter.Events.on(mouseConstraint, 'enddrag', (event: any) => {
      if (event.body === petBody) {
        const speed = Matter.Vector.magnitude(petBody.velocity);
        const eventType = speed > 3 ? 'thrown' : 'grabbed';
        wsRef.current?.send(JSON.stringify({ type: 'sensory', event: eventType }));
      }
    });

    // 60fps physics → DOM render loop
    let animFrame: number;
    const update = () => {
      Matter.Engine.update(engine, 1000 / 60);

      const px = petBody.position.x;
      const py = petBody.position.y;

      if (petRef.current) {
        petRef.current.style.transform = `translate(${px - 60}px, ${py - 60}px) rotate(${petBody.angle}rad)`;
      }

      // EYE TRACKING (2D mode): Compute pupil offset toward cursor
      const mx = mousePosRef.current.x;
      const my = mousePosRef.current.y;
      const angle = Math.atan2(my - py, mx - px);
      const eyeOffset = 4;
      const ex = Math.cos(angle) * eyeOffset;
      const ey = Math.sin(angle) * eyeOffset;

      if (leftEyeRef.current) leftEyeRef.current.style.transform = `translate(${ex}px, ${ey}px)`;
      if (rightEyeRef.current) rightEyeRef.current.style.transform = `translate(${ex}px, ${ey}px)`;

      animFrame = requestAnimationFrame(update);
    };
    update();

    // Resize handler
    const handleResize = () => {
      const rw = window.innerWidth;
      const rh = window.innerHeight;
      Matter.Body.setPosition(ground, { x: rw / 2, y: rh + 50 });
      Matter.Body.setPosition(leftWall, { x: -25, y: rh / 2 });
      Matter.Body.setPosition(rightWall, { x: rw + 25, y: rh / 2 });
    };
    window.addEventListener('resize', handleResize);

    // ── WebSocket to Cortex ──
    const ws = new WebSocket('ws://127.0.0.1:8766/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('Connected');
      ws.send(JSON.stringify({ type: 'init' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === 'connected') {
          if (data.vision_context) setVisionContext(data.vision_context);
        }

        if (data.type === 'state_update') {
          if (data.psyche) setDrives(data.psyche);
          if (data.personality) setPersonality(data.personality.archetype);
          if (data.vision_context) setVisionContext(data.vision_context);
        }
        
        if (data.type === 'vision_update') {
          setVisionContext(data.context);
        }

        if (data.type === 'impulse') {
          if (data.mood) setMood(data.mood);
          if (data.animation) setCurrentAnimation(data.animation);
          if (data.vector) {
            Matter.Body.applyForce(petBody, petBody.position, data.vector);
          }
          setTimeout(() => setCurrentAnimation('idle'), 2000);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    ws.onclose = () => {
      setStatus('Disconnected');
      setMood('Sleepy 💤');
    };

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
      ws.close();
      Matter.Engine.clear(engine);
    };
  }, []);

  const handlePoke = () => {
    wsRef.current?.send(JSON.stringify({ type: 'poke' }));
  };

  // ── HUD Panel Manual Dragging ──
  const panelPos = useRef({ x: window.innerWidth - 350, y: 50 });
  const isDraggingPanel = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (dashboardRef.current) {
      dashboardRef.current.style.transform = `translate(${panelPos.current.x}px, ${panelPos.current.y}px)`;
    }
  }, []);

  const onDragStart = (e: React.PointerEvent) => {
    isDraggingPanel.current = true;
    dragOffset.current = {
      x: e.clientX - panelPos.current.x,
      y: e.clientY - panelPos.current.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (isDraggingPanel.current && dashboardRef.current) {
      panelPos.current = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      };
      dashboardRef.current.style.transform = `translate(${panelPos.current.x}px, ${panelPos.current.y}px)`;
    }
  };

  const onDragEnd = (e: React.PointerEvent) => {
    isDraggingPanel.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      {/* ═══ THE PET — Physics-Bound, Render-Mode-Aware ═══ */}
      <PetRenderer
        ref={petRef}
        position={{ x: 0, y: 0 }}
        rotation={0}
        animation={currentAnimation}
        mousePos={mousePosRef.current}
        leftEyeRef={leftEyeRef}
        rightEyeRef={rightEyeRef}
      />

      {/* ═══ THE UI PANEL — Free Draggable HUD ═══ */}
      {/* ═══ HUD PANEL ═══ */}
      <div 
        ref={dashboardRef}
        className="hud-panel-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: isDraggingPanel.current ? 'grabbing' : 'grab',
          pointerEvents: 'auto',
          zIndex: 1000
        }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <HudPanel
          status={status}
          mood={mood}
          visionContext={visionContext}
          drives={drives}
          personality={personality}
          onPoke={handlePoke}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RenderModeProvider>
      <AppInner />
    </RenderModeProvider>
  );
}
