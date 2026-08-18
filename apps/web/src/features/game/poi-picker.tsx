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
  dossierDetail?: 'full' | 'identity';
  globe?: (selectPoi: (poi: Poi) => void, fallback: ReactNode) => ReactNode;
} & (
  | { mode?: 'guess'; onGuess: (poi: Poi) => void }
  | { mode: 'browse'; onGuess?: never }
);

export function PoiPicker({
  pois,
  guessedPoiIds,
  disabledPoiIds,
  dossierDetail = 'full',
  onGuess,
  globe,
  mode = 'guess',
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
    if (!selectedPoi || !onGuess) return;
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
          fallback={mode === 'guess' ? search : undefined}
          onSelect={selectPoi}
          pois={pois}
          selectedPoiId={selectedPoi?.id ?? null}
        />
      ) : null}
      {mode === 'browse' ? search : null}
      <PoiDossier
        detail={dossierDetail}
        onOpenChange={(open) => {
          if (!open) setSelectedPoi(null);
        }}
        open={selectedPoi !== null}
        onConfirm={mode === 'guess' ? confirmSelection : undefined}
        poi={selectedPoi}
      />
    </section>
  );
}
