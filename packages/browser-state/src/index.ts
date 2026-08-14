export type BrowserState = {
  activeCaseId?: string;
};

export { formatLocalDate, parseCaseDate } from './date.js';
export { clearProgress, loadProgress, saveProgress } from './storage.js';
