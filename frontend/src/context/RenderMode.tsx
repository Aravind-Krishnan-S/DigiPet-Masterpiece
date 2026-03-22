import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type RenderMode = '2d' | '3d';

export interface RenderModeState {
  mode: RenderMode;
  setMode: (m: RenderMode) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  availableModels: { id: string; label: string; path: string }[];
}

const MODELS = [
  { id: 'aqua_sparkle',     label: '✦ Aqua Sparkle',      path: '/models/aqua_sparkle_sprite.glb' },
  { id: 'cute_rabbit',      label: '🐰 Cute Rabbit',      path: '/models/cute_rabbit.glb' },
  { id: 'enchanted_forest', label: '🌿 Enchanted Forest',  path: '/models/enchanted_forest_sprite.glb' },
];

const RenderModeContext = createContext<RenderModeState | null>(null);

export function RenderModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<RenderMode>('3d');
  const [selectedModel, setSelectedModel] = useState(MODELS[1].id); // Default to rabbit

  return (
    <RenderModeContext.Provider
      value={{ mode, setMode, selectedModel, setSelectedModel, availableModels: MODELS }}
    >
      {children}
    </RenderModeContext.Provider>
  );
}

export function useRenderMode() {
  const ctx = useContext(RenderModeContext);
  if (!ctx) throw new Error('useRenderMode must be inside RenderModeProvider');
  return ctx;
}
