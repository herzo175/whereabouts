import { makeFiveRoundCase } from '@whereabouts/case-content/testing';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { FiveRoundGameScreen } from '../src/features/game/five-round-game-screen';
import { buildShareText, shareResult } from '../src/features/game/share';
import '../src/styles.css';

const caseData = makeFiveRoundCase();
const root = document.getElementById('root');
if (!root) throw new Error('Missing five-round browser harness root');

createRoot(root).render(
  <StrictMode>
    <FiveRoundGameScreen
      caseData={caseData}
      globeSupported={false}
      onShare={async (activeCase, progress) => {
        await shareResult(
          buildShareText(activeCase, progress, window.location.origin),
          navigator,
        );
      }}
    />
  </StrictMode>,
);
