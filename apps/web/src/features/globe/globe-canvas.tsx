'use client';

import type { Poi } from '@whereabouts/case-content';
import {
  type GeoJSONSource,
  type MapLayerMouseEvent,
  Map as MapLibreMap,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';

export const POI_HIT_RADIUS = 24;
export const POI_BEAM_RADIUS = 0.25;
const POI_BEAM_SEGMENTS = 16;

type GlobeCanvasProps = {
  pois: Poi[];
  disabledPoiIds: Set<string>;
  selectedPoiId: string | null;
  onSelect: (poi: Poi) => void;
  reducedMotion: boolean;
};

function pointData(
  pois: Poi[],
  disabledPoiIds: Set<string>,
  selectedPoiId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: pois.map((poi) => {
      const disabled = disabledPoiIds.has(poi.id);
      const selected = poi.id === selectedPoiId;
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [poi.longitude, poi.latitude],
        },
        properties: {
          id: poi.id,
          color: disabled ? '#737373' : selected ? '#f7c948' : '#4fd1c5',
          radius: selected ? 10 : 8,
        },
      };
    }),
  };
}

function beamData(
  pois: Poi[],
  disabledPoiIds: Set<string>,
  selectedPoiId: string | null,
) {
  return {
    type: 'FeatureCollection' as const,
    features: pois.map((poi) => {
      const disabled = disabledPoiIds.has(poi.id);
      const selected = poi.id === selectedPoiId;
      const radius = selected ? POI_BEAM_RADIUS * 1.35 : POI_BEAM_RADIUS;
      const longitudeScale = Math.max(
        Math.cos((poi.latitude * Math.PI) / 180),
        0.25,
      );
      const ring = Array.from({ length: POI_BEAM_SEGMENTS + 1 }, (_, index) => {
        const angle = (index / POI_BEAM_SEGMENTS) * Math.PI * 2;
        return [
          poi.longitude + (Math.cos(angle) * radius) / longitudeScale,
          poi.latitude + Math.sin(angle) * radius,
        ];
      });
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ring],
        },
        properties: {
          color: disabled ? '#59666a' : selected ? '#f7c948' : '#4fd1c5',
          height: disabled ? 350_000 : selected ? 1_800_000 : 1_250_000,
          opacity: disabled ? 0.18 : selected ? 0.8 : 0.48,
        },
      };
    }),
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const poiByIdRef = useRef(new Map(pois.map((poi) => [poi.id, poi])));
  const disabledRef = useRef(disabledPoiIds);
  const data = useMemo(
    () => pointData(pois, disabledPoiIds, selectedPoiId),
    [disabledPoiIds, pois, selectedPoiId],
  );
  const beams = useMemo(
    () => beamData(pois, disabledPoiIds, selectedPoiId),
    [disabledPoiIds, pois, selectedPoiId],
  );
  const initialDataRef = useRef(data);
  const initialBeamDataRef = useRef(beams);

  onSelectRef.current = onSelect;
  poiByIdRef.current = new Map(pois.map((poi) => [poi.id, poi]));
  disabledRef.current = disabledPoiIds;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      attributionControl: { compact: true },
      center: [8, 18],
      container,
      fadeDuration: reducedMotion ? 0 : 300,
      renderWorldCopies: false,
      style: {
        version: 8,
        sources: {
          earth: {
            type: 'raster',
            tiles: [
              'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            ],
            tileSize: 256,
            attribution: 'Sentinel-2 cloudless — EOX',
          },
        },
        layers: [
          {
            id: 'globe-background',
            type: 'background',
            paint: { 'background-color': '#0b2632' },
          },
          {
            id: 'earth-texture',
            type: 'raster',
            source: 'earth',
            paint: { 'raster-fade-duration': reducedMotion ? 0 : 150 },
          },
        ],
      },
      zoom: 1.25,
    });
    mapRef.current = map;
    map.on('error', (event) => {
      console.error('whereabouts-globe-error', event.error?.message ?? event);
    });
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' });
      map.addSource('candidates', {
        type: 'geojson',
        data: initialDataRef.current,
      });
      map.addSource('beams', {
        type: 'geojson',
        data: initialBeamDataRef.current,
      });
      map.addLayer({
        id: 'poi-beams',
        type: 'fill-extrusion',
        source: 'beams',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.82,
          'fill-extrusion-vertical-gradient': true,
        },
      });
      map.addLayer({
        id: 'poi-glow',
        type: 'circle',
        source: 'candidates',
        paint: {
          'circle-blur': 0.8,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.7,
          'circle-radius': 16,
        },
      });
      map.addLayer({
        id: 'poi-hit-targets',
        type: 'circle',
        source: 'candidates',
        paint: {
          'circle-color': '#ffffff',
          'circle-opacity': 0.01,
          'circle-radius': POI_HIT_RADIUS,
        },
      });
      map.addLayer({
        id: 'poi-points',
        type: 'circle',
        source: 'candidates',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['get', 'radius'],
          'circle-stroke-color': '#e8f7f5',
          'circle-stroke-width': 2,
        },
      });
      map.on('mouseenter', 'poi-hit-targets', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'poi-hit-targets', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('click', 'poi-hit-targets', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties.id;
        if (typeof id !== 'string' || disabledRef.current.has(id)) return;
        const poi = poiByIdRef.current.get(id);
        if (poi) onSelectRef.current(poi);
      });
      map.once('render', () => {
        (map.getSource('candidates') as GeoJSONSource).setData(
          initialDataRef.current,
        );
        (map.getSource('beams') as GeoJSONSource).setData(
          initialBeamDataRef.current,
        );
      });
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [reducedMotion]);

  useEffect(() => {
    const source = mapRef.current?.getSource('candidates') as
      | GeoJSONSource
      | undefined;
    source?.setData(data);
  }, [data]);

  useEffect(() => {
    const source = mapRef.current?.getSource('beams') as
      | GeoJSONSource
      | undefined;
    source?.setData(beams);
  }, [beams]);

  return (
    <div
      aria-label="Interactive globe with candidate locations"
      className="h-[clamp(15rem,55vw,26.25rem)] max-h-[55svh] min-h-60 overflow-hidden rounded-lg border border-foreground/15 bg-[#071520]"
      data-testid="globe-canvas"
      ref={containerRef}
      role="application"
    />
  );
}
