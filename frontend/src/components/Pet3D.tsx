import { forwardRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Center } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import type { PetProps } from './types';
import { useRenderMode } from '../context/RenderMode';

interface ModelProps {
  modelPath: string;
  animation: string;
  mousePos: { x: number; y: number };
}

function PetModel({ modelPath, animation, mousePos }: ModelProps) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null!);

  // Clone the scene and store base transforms for pseudo-skeletal animation
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.Group).isGroup) {
        child.userData.basePos = child.position.clone();
        child.userData.baseRot = child.rotation.clone();
        child.userData.baseScale = child.scale.clone();
      }
    });
    return clone;
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    const baseScale = 1.0;
    let targetScaleX = baseScale;
    let targetScaleY = baseScale;
    let targetScaleZ = baseScale;

    // 1. MACRO ANIMATIONS (Global Body)
    switch (animation) {
      case 'idle':
        groupRef.current.position.y = Math.sin(t * 1.5) * 0.05;
        targetScaleX = baseScale + Math.sin(t * 2) * 0.02;
        targetScaleY = baseScale + Math.sin(t * 2 + Math.PI) * 0.02;
        groupRef.current.rotation.y += delta * 0.2;
        break;
      case 'sleep':
        groupRef.current.position.y = -0.15;
        targetScaleX = baseScale + Math.sin(t * 1) * 0.03;
        targetScaleY = baseScale - 0.1 + Math.sin(t * 1 + Math.PI) * 0.03;
        groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
        break;
      case 'zoomies':
        groupRef.current.rotation.y += delta * 15;
        groupRef.current.position.y = Math.abs(Math.sin(t * 12)) * 0.4;
        targetScaleY = baseScale + 0.2;
        targetScaleX = baseScale - 0.1;
        targetScaleZ = baseScale - 0.1;
        break;
      case 'bounce':
        const bouncePhase = t * 8;
        const hopY = Math.abs(Math.sin(bouncePhase)) * 0.3;
        groupRef.current.position.y = hopY;
        if (hopY < 0.05) {
          targetScaleY = baseScale - 0.2;
          targetScaleX = baseScale + 0.15;
          targetScaleZ = baseScale + 0.15;
        } else {
          targetScaleY = baseScale + 0.15;
          targetScaleX = baseScale - 0.1;
          targetScaleZ = baseScale - 0.1;
        }
        groupRef.current.rotation.y += delta * 0.5;
        break;
      case 'walk':
        const walkPhase = t * 8;
        groupRef.current.position.y = Math.abs(Math.sin(walkPhase)) * 0.15;
        groupRef.current.rotation.z = Math.sin(walkPhase) * 0.15;
        break;
      default:
        groupRef.current.rotation.y += delta * 0.3;
    }

    // 2. MICRO ANIMATIONS (Procedural Skeletal Bones)
    // We traverse all sub-meshes and apply wave offsets to simulate an interconnected spine/skeleton
    groupRef.current.traverse((child) => {
      if (child.userData.basePos) {
        const yOffset = child.userData.basePos.y * 2.0; // Use local Y as bone tier
        const cx = child.userData.baseRot.x;
        const cz = child.userData.baseRot.z;
        const py = child.userData.basePos.y;

        switch (animation) {
          case 'walk':
            // Swinging limbs/head
            child.rotation.x = cx + Math.sin(t * 12 + yOffset) * 0.15;
            child.position.y = py + Math.abs(Math.sin(t * 12 + yOffset)) * 0.02;
            break;
          case 'zoomies':
            // Frantic vibration of individual parts
            child.rotation.z = cz + Math.sin(t * 30 + yOffset) * 0.1;
            child.rotation.x = cx + Math.cos(t * 25 + yOffset) * 0.1;
            break;
          case 'sleep':
            // Deep slow breathing expansion per bone
            const breath = Math.sin(t * 1.5 - yOffset) * 0.05;
            child.position.y = py + breath;
            child.rotation.x = cx + breath * 0.5;
            break;
          case 'bounce':
            // Jelly squish reaction
            const squish = Math.sin(t * 16 + yOffset) * 0.1;
            child.rotation.x = cx + squish;
            break;
          case 'idle':
          default:
            // Subtle ambient skeletal sway
            child.rotation.z = cz + Math.sin(t * 2 + yOffset) * 0.02;
            child.rotation.x = cx + Math.cos(t * 2.5 + yOffset) * 0.02;
            break;
        }
      }
    });

    // Apply smooth scale interpolation
    groupRef.current.scale.x = THREE.MathUtils.lerp(groupRef.current.scale.x, targetScaleX, 0.2);
    groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetScaleY, 0.2);
    groupRef.current.scale.z = THREE.MathUtils.lerp(groupRef.current.scale.z, targetScaleZ, 0.2);

    // Subtle lean toward mouse
    const leanX = (mousePos.x / window.innerWidth - 0.5) * 0.3;
    const leanZ = (mousePos.y / window.innerHeight - 0.5) * -0.2;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, leanZ, 0.05);
    
    // Mix mouse tracking with sleep drooping
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      animation === 'sleep' ? Math.sin(state.clock.elapsedTime * 0.5) * 0.15 : leanX,
      0.05
    );
  });

  return (
    <group ref={groupRef} scale={1.5}>
      <primitive object={clonedScene} />
    </group>
  );
}

const Pet3D = forwardRef<HTMLDivElement, PetProps>(({ animation, mousePos }, ref) => {
  const { selectedModel, availableModels } = useRenderMode();
  const model = availableModels.find(m => m.id === selectedModel) ?? availableModels[0];

  return (
    <div
      ref={ref}
      className={`pet-body-3d anim-3d-${animation}`}
      style={{ pointerEvents: 'auto' }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 3], fov: 45 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <pointLight
          position={[0, 2, 0]}
          intensity={animation === 'zoomies' ? 3 : 0.8}
          color={animation === 'zoomies' ? '#00eeff' : '#8ff5ff'}
        />
        <Suspense fallback={null}>
            <Center>
              <PetModel modelPath={model.path} animation={animation} mousePos={mousePos} />
            </Center>
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
        />
      </Canvas>
    </div>
  );
});

Pet3D.displayName = 'Pet3D';
export default Pet3D;
