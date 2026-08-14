export type GameEngine = {
  status: 'ready';
};

export function createGameEngine(): GameEngine {
  return { status: 'ready' };
}
