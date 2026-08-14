import type { Poi } from '@whereabouts/case-content';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { GlobePicker } from '../globe/globe-picker';
import { PoiDossier } from './poi-dossier';
import { PoiSearch } from './poi-search';

type PoiPickerProps = {
  pois: Poi[];
  guessedPoiIds?: Set<string>;
  disabledPoiIds?: Set<string>;
  onGuess: (poi: Poi) => void;
  globe?: (selectPoi: (poi: Poi) => void) => ReactNode;
};

export function PoiPicker({
  pois,
  guessedPoiIds,
  disabledPoiIds,
  onGuess,
  globe,
}: PoiPickerProps) {
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const eliminatedPoiIds = useMemo(() => {
    if (!guessedPoiIds) return disabledPoiIds ?? new Set<string>();
    if (!disabledPoiIds) return guessedPoiIds;
    return new Set([...guessedPoiIds, ...disabledPoiIds]);
  }, [disabledPoiIds, guessedPoiIds]);

  const selectPoi = (poi: Poi) => {
    if (!eliminatedPoiIds.has(poi.id)) setSelectedPoi(poi);
  };

  const confirmSelection = () => {
    if (!selectedPoi) return;
    onGuess(selectedPoi);
    setSelectedPoi(null);
  };

  return (
    <section className="space-y-4" aria-label="Choose a location">
      {globe ? globe(selectPoi) : null}
      {!globe ? (
        <GlobePicker
          disabledPoiIds={eliminatedPoiIds}
          onSelect={selectPoi}
          pois={pois}
          selectedPoiId={selectedPoi?.id ?? null}
        />
      ) : null}
      <PoiSearch
        disabledPoiIds={eliminatedPoiIds}
        onSelect={selectPoi}
        pois={pois}
      />
      <PoiDossier
        onConfirm={confirmSelection}
        onOpenChange={(open) => {
          if (!open) setSelectedPoi(null);
        }}
        open={selectedPoi !== null}
        poi={selectedPoi}
      />
    </section>
  );
}
