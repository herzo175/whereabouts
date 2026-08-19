import { makeFiveRoundCase } from '@whereabouts/case-content/testing';

const fixtureCase = makeFiveRoundCase();

export const FIVE_ROUND_CASE = {
  ...fixtureCase,
  pois: fixtureCase.pois.map((poi, index) => {
    if (index !== 5) return poi;
    const { wikipediaTitle: _title, ...candidate } = poi;
    return candidate;
  }),
};
