import { forwardRef } from 'react';
import type { RefObject } from 'react';
import Pet2D from './Pet2D';
import Pet3D from './Pet3D';
import { Suspense } from 'react';
import { useRenderMode } from '../context/RenderMode';
import type { PetProps } from './types';

interface PetRendererProps extends PetProps {
  leftEyeRef: RefObject<HTMLDivElement | null>;
  rightEyeRef: RefObject<HTMLDivElement | null>;
}

const PetRenderer = forwardRef<HTMLDivElement, PetRendererProps>((props, ref) => {
  const { mode } = useRenderMode();

  if (mode === '3d') {
    return (
      <Suspense fallback={
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', color: '#00eeff', fontFamily: 'monospace', fontSize: '18px', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px' }}>
          Initializing 3D Core...
        </div>
      }>
        <Pet3D ref={ref} position={props.position} rotation={props.rotation} animation={props.animation} mousePos={props.mousePos} />
      </Suspense>
    );
  }

  return (
    <Pet2D
      ref={ref}
      {...props}
    />
  );
});

PetRenderer.displayName = 'PetRenderer';
export default PetRenderer;
