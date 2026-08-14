'use client';

import type { Poi } from '@whereabouts/case-content';
import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

type GlobeCanvasProps = {
  pois: Poi[];
  disabledPoiIds: Set<string>;
  selectedPoiId: string | null;
  onSelect: (poi: Poi) => void;
  reducedMotion: boolean;
};

type GlobePoint = Poi & { color: string; radius: number; label: string };

function sizeFor(container: HTMLElement): { width: number; height: number } {
  const width = container.clientWidth || 320;
  return {
    width,
    height: Math.min(420, Math.max(240, Math.round(width * 0.7))),
  };
}

export function GlobeCanvas({
  pois,
  disabledPoiIds,
  selectedPoiId,
  onSelect,
  reducedMotion,
}: GlobeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  const points: GlobePoint[] = pois.map((poi) => {
    const disabled = disabledPoiIds.has(poi.id);
    const selected = poi.id === selectedPoiId;
    return {
      ...poi,
      color: disabled ? '#737373' : selected ? '#f7c948' : '#4fd1c5',
      radius: selected ? 0.38 : 0.26,
      label: `${poi.name}, ${poi.city}, ${poi.country}${disabled ? ' (already eliminated)' : ''}`,
    };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => setSize(sizeFor(container));
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="h-[clamp(15rem,55vw,26.25rem)] max-h-[55svh] min-h-60 overflow-hidden rounded-lg border border-foreground/15 bg-[#071520]"
      ref={containerRef}
    >
      <Globe
        backgroundColor="#071520"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        height={size.height}
        onPointClick={(point) => {
          const poi = point as GlobePoint;
          if (!disabledPoiIds.has(poi.id)) onSelect(poi);
        }}
        pointColor="color"
        pointLabel="label"
        pointLat="latitude"
        pointLng="longitude"
        pointRadius="radius"
        pointsData={points}
        pointsMerge={false}
        pointsTransitionDuration={reducedMotion ? 0 : 700}
        showAtmosphere
        width={size.width}
      />
    </div>
  );
}
