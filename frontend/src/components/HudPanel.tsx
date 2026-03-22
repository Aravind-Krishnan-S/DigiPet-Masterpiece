import { useRenderMode } from '../context/RenderMode';

interface Drives {
  energy: number;
  affection: number;
  boredom: number;
}

interface HudPanelProps {
  status: string;
  mood: string;
  visionContext: string;
  drives: Drives;
  personality: string;
  onPoke: () => void;
}

export default function HudPanel({ status, mood, visionContext, drives, personality, onPoke }: HudPanelProps) {
  const { mode, setMode, selectedModel, setSelectedModel, availableModels } = useRenderMode();

  const driveColor = (value: number) => {
    if (value > 60) return 'var(--primary)';
    if (value > 30) return 'var(--secondary)';
    return 'var(--error, #ff716c)';
  };

  return (
    <div className="panel-content">
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="headline">P.E.T. Core</h1>
        <div className="status-indicator">
          <div className="status-dot" style={{ background: status === 'Connected' ? 'var(--primary)' : '#ff716c' }}></div>
          <span className="label-sm" style={{ textTransform: 'none' }}>{status}</span>
        </div>
      </div>

      {/* Render Mode Toggle */}
      <div className="render-toggle">
        <button
          className={`toggle-btn ${mode === '2d' ? 'active' : ''}`}
          onClick={() => setMode('2d')}
        >
          2D
        </button>
        <button
          className={`toggle-btn ${mode === '3d' ? 'active' : ''}`}
          onClick={() => setMode('3d')}
        >
          3D
        </button>
      </div>

      {/* Model Selector (3D only) */}
      {mode === '3d' && (
        <div className="model-selector">
          <span className="label-sm">MODEL</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-dropdown"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Personality Chip */}
      <div className="personality-chip">
        <span className="label-sm">SOUL TYPE</span>
        <span className="personality-value">{personality}</span>
      </div>

      {/* Mood Display */}
      <div className="mood-display">
        <span className="label-sm">CURRENT STATE</span>
        <span className="mood-value">{mood}</span>
      </div>

      {/* Vision Display */}
      <div className="vision-display" style={{ marginTop: '10px' }}>
        <span className="label-sm">AWARENESS</span>
        <span className="mood-value" style={{ color: 'var(--tertiary)' }}>{visionContext}</span>
      </div>

      {/* Live Drive Gauges */}
      <div className="drives-section">
        <div className="drive-row">
          <span className="label-sm">ENERGY</span>
          <div className="drive-bar-bg">
            <div className="drive-bar-fill" style={{ width: `${drives.energy}%`, background: driveColor(drives.energy) }}></div>
          </div>
          <span className="drive-val">{Math.round(drives.energy)}</span>
        </div>
        <div className="drive-row">
          <span className="label-sm">AFFECTION</span>
          <div className="drive-bar-bg">
            <div className="drive-bar-fill" style={{ width: `${drives.affection}%`, background: driveColor(drives.affection) }}></div>
          </div>
          <span className="drive-val">{Math.round(drives.affection)}</span>
        </div>
        <div className="drive-row">
          <span className="label-sm">BOREDOM</span>
          <div className="drive-bar-bg">
            <div className="drive-bar-fill" style={{ width: `${drives.boredom}%`, background: drives.boredom > 70 ? '#ff716c' : drives.boredom > 40 ? 'var(--secondary)' : 'var(--tertiary)' }}></div>
          </div>
          <span className="drive-val">{Math.round(drives.boredom)}</span>
        </div>
      </div>

      <button className="btn-primary" onClick={onPoke}>
        ⚡ INTERACT
      </button>
    </div>
  );
}
