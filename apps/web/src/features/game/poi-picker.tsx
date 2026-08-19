import type { Poi } from '@whereabouts/case-content';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { PoiDossier } from './poi-dossier';
import { PoiSearch } from './poi-search';

type PoiPickerProps = {
  pois: Poi[];
  disabledPoiIds?: Set<string>;
  dossierDetail?: 'full' | 'identity';
  onGuess: (poi: Poi) => void;
  globe?: (selectPoi: (poi: Poi) => void, fallback: ReactNode) => ReactNode;
};

export function PoiPicker({
  pois,
  disabledPoiIds,
  dossierDetail = 'full',
  onGuess,
  globe,
}: PoiPickerProps) {
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const eliminatedPoiIds = useMemo(
    () => disabledPoiIds ?? new Set<string>(),
    [disabledPoiIds],
  );

  const selectPoi = (poi: Poi) => {
    if (!eliminatedPoiIds.has(poi.id)) setSelectedPoi(poi);
  };

  const confirmSelection = () => {
    if (!selectedPoi) return;
    onGuess(selectedPoi);
    setSelectedPoi(null);
  };

  const search = (
    <PoiSearch
      disabledPoiIds={eliminatedPoiIds}
      onSelect={selectPoi}
      pois={pois}
    />
  );

  return (
    <section className="space-y-4" aria-label="Choose a location">
      {globe ? globe(selectPoi, search) : null}
      {!globe ? (
        <GlobePicker
          disabledPoiIds={eliminatedPoiIds}
          fallback={search}
          onSelect={selectPoi}
          pois={pois}
          selectedPoiId={selectedPoi?.id ?? null}
        />
      ) : null}
      <PoiDossier
        detail={dossierDetail}
        onOpenChange={(open) => {
          if (!open) setSelectedPoi(null);
        }}
        open={selectedPoi !== null}
        onConfirm={confirmSelection}
        poi={selectedPoi}
      />
    </section>
  );
}
