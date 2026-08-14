'use client';

import type { Poi } from '@whereabouts/case-content';
import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useState,
} from 'react';

import { supportsWebGl } from './supports-webgl';

const LazyGlobeCanvas = lazy(() =>
  import('./globe-canvas').then(({ GlobeCanvas }) => ({
    default: GlobeCanvas,
  })),
);

let globeFailed = false;

type GlobePickerProps = {
  pois: Poi[];
  disabledPoiIds: Set<string>;
  selectedPoiId?: string | null;
  onSelect: (poi: Poi) => void;
  reducedMotion?: boolean;
  supported?: boolean;
};

type GlobeErrorBoundaryProps = {
  onError: () => void;
  children: ReactNode;
};

type GlobeErrorBoundaryState = { failed: boolean };

class GlobeErrorBoundary extends Component<
  GlobeErrorBoundaryProps,
  GlobeErrorBoundaryState
> {
  state: GlobeErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GlobeErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useReducedMotion(value: boolean | undefined): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (
      value !== undefined ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [value]);

  return value ?? prefersReducedMotion;
}

export function GlobePicker({
  pois,
  disabledPoiIds,
  selectedPoiId = null,
  onSelect,
  reducedMotion,
  supported,
}: GlobePickerProps) {
  const [canRenderGlobe, setCanRenderGlobe] = useState<boolean | null>(
    supported === false ? false : null,
  );
  const [failed, setFailed] = useState(globeFailed);
  const useReducedMotionPreference = useReducedMotion(reducedMotion);

  useEffect(() => {
    if (globeFailed) {
      setFailed(true);
      return;
    }
    setCanRenderGlobe(supported ?? supportsWebGl());
  }, [supported]);

  const showFallback = failed || canRenderGlobe === false;

  if (showFallback) {
    return <output>Globe unavailable; use location list</output>;
  }

  if (canRenderGlobe !== true) return null;

  return (
    <GlobeErrorBoundary
      onError={() => {
        globeFailed = true;
        setFailed(true);
      }}
    >
      <Suspense fallback={null}>
        <LazyGlobeCanvas
          disabledPoiIds={disabledPoiIds}
          onSelect={onSelect}
          pois={pois}
          reducedMotion={useReducedMotionPreference}
          selectedPoiId={selectedPoiId}
        />
      </Suspense>
    </GlobeErrorBoundary>
  );
}
