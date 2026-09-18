import type { EnginePort } from './port.ts';
import { Tetromino, rotationPositionIsLegal } from './vendor/integrated.js';
type Cell = [number, number];
export type SpawnWarning = { blocked: boolean; overlap: Cell[]; spawn: Cell[]; clearedRows: number[] };
/** Read-only placement projection. It never spawns on the live engine or consumes its queue.
 * This checks NEXT's spawn footprint, not future garbage, buffered inputs or all causes of topout.
 */
export function projectSpawnWarning(engine: EnginePort, ghost: Cell[], clutch: boolean): SpawnWarning | null {
  const next = engine.queue[0];
  if (!next) return null;
  const { board } = engine;
  const state = board.state.map(row => row.slice());
  if (!ghost.length || ghost.some(([x,y]) => !Number.isInteger(x) || !Number.isInteger(y) || x<0 || x>=board.width || y<0 || y>=board.fullHeight || state[y][x]!==null)) return null;
  for (const [x,y] of ghost) state[y][x] = { mino: engine.falling.symbol };
  // Permanent and bomb cells are not ordinary full lines in the integrated board engine.
  const clearedRows = state.flatMap((row,y) => row.every(c=>c!==null&&c.mino!=='gbd'&&c.mino!=='bomb') ? [y] : []);
  const cleared = new Set(clearedRows);
  const surviving = ghost.filter(([,y])=>!cleared.has(y)).map(([x,y])=>({ original:[x,y] as Cell, projected:[x,y-clearedRows.filter(r=>r<y).length] as Cell }));
  const projected = state.filter((_,y)=>!cleared.has(y));
  while (projected.length < board.fullHeight) projected.push(Array(board.width).fill(null));
  const piece = new Tetromino({boardHeight:board.height,boardWidth:board.width,initialRotation:engine.kickTable.spawn_rotation[next]??0,symbol:next});
  const cells = () => piece.blocks.map(([dx,dy])=>[piece.location[0]+dx,piece.location[1]-dy]);
  const spawn = piece.absoluteBlocks.map(([x,y])=>[x,y] as Cell);
  let blocked = !rotationPositionIsLegal(cells(), projected);
  if (blocked && clearedRows.length && clutch) {
    while (piece.y < board.fullHeight) {
      piece.location[1]++;
      if (rotationPositionIsLegal(cells(), projected)) { blocked=false; break; }
    }
  }
  const overlaps = surviving.filter(p=>spawn.some(([x,y])=>p.projected[0]===x&&p.projected[1]===y));
  // Keep original ghost coordinates so clears do not move the red crosses away from the preview.
  return {blocked,overlap:blocked?overlaps.map(p=>p.original):[],spawn,clearedRows};
}
