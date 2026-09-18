import type { EnginePort, Tile } from './port.ts';
export function fallingPositionLegal(engine: EnginePort, upward = 0): boolean {
  const { falling, board } = engine;
  return falling.blocks.every(([dx, dy]) => {
    const x = falling.x + dx, y = falling.location[1] - dy + upward;
    return x >= 0 && x < board.width && y >= 0 && y <= board.fullHeight - 1 && board.state[Math.floor(y)]?.[x] === null;
  });
}
/** Native PushUpFallingIfNeeded permits one row per inserted line, not an unlimited rescue. */
export function pushFallingOneRow(engine: EnginePort): boolean {
  if (fallingPositionLegal(engine)) return true;
  if (!fallingPositionLegal(engine, 1)) return false;
  engine.falling.location[1]++;
  return true;
}
export function garbageCeilingFull(board: Tile[][]): boolean {
  return board.length > 0 && board[board.length - 1].every(cell => cell !== null);
}
