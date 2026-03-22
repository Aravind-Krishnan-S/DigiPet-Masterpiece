import { forwardRef } from 'react';
import type { RefObject } from 'react';
import type { PetProps } from './types';

interface Pet2DProps extends PetProps {
  leftEyeRef: RefObject<HTMLDivElement | null>;
  rightEyeRef: RefObject<HTMLDivElement | null>;
}

const Pet2D = forwardRef<HTMLDivElement, Pet2DProps>(
  ({ animation, leftEyeRef, rightEyeRef }, ref) => {
    return (
      <div
        ref={ref}
        className={`pet-body anim-${animation}`}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Face / Eyes */}
        <div className="pet-face">
          <div className="eye-socket">
            <div ref={leftEyeRef} className="pupil"></div>
          </div>
          <div className="eye-socket">
            <div ref={rightEyeRef} className="pupil"></div>
          </div>
        </div>

        {/* Mouth — changes with mood */}
        <div className={`mouth mouth-${animation}`}></div>
      </div>
    );
  }
);

Pet2D.displayName = 'Pet2D';
export default Pet2D;
