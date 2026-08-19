import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { FiveRoundGameScreen } from '../src/features/game/five-round-game-screen';
import { buildShareText, shareResult } from '../src/features/game/share';
import { FIVE_ROUND_CASE } from './fixture';
import '../src/styles.css';

const globeSupported =
  new URLSearchParams(window.location.search).get('globe') === '1';
const root = document.getElementById('root');
if (!root) throw new Error('Missing five-round browser harness root');

createRoot(root).render(
  <StrictMode>
    <FiveRoundGameScreen
      caseData={FIVE_ROUND_CASE}
      globeSupported={globeSupported}
      onShare={async (activeCase, progress) => {
        await shareResult(
          buildShareText(activeCase, progress, window.location.origin),
          navigator,
        );
      }}
    />
  </StrictMode>,
);
