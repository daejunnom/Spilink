// Canvas block rendering adapted from Clearra contributors (MIT).
import type { Session } from './session.ts';
import type { Mino } from './port.ts';
export const COLORS: Record<string, string> = { i5: '#49d4e7', gbd: '#394854', i: '#49d4e7', j: '#6192ee', l: '#f5ad68', o: '#f0d56c', s: '#75cf9c', t: '#bc92ed', z: '#ee8491', gb: '#849499' };
function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity = 1): void {
  ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  const bevel = Math.max(1, size * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1, y + 1, size - 2, bevel);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 1, y + size - bevel - 1, size - 2, bevel);
  ctx.globalAlpha = 1;
}
export function drawBoard(canvas: HTMLCanvasElement, session: Session): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const ratio = Math.min(3, window.devicePixelRatio || 1), width = Math.round(canvas.clientWidth * ratio);
  if (canvas.width !== width || canvas.height !== width * 2) { canvas.width = width; canvas.height = width * 2; }
  const size = canvas.width / 10;
  ctx.fillStyle = '#0c141d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(153,187,204,.08)'; ctx.lineWidth = 1;
  for (let x = 0; x <= 10; x++) { ctx.beginPath(); ctx.moveTo(x * size, 0); ctx.lineTo(x * size, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= 20; y++) { ctx.beginPath(); ctx.moveTo(0, y * size); ctx.lineTo(canvas.width, y * size); ctx.stroke(); }
  for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) {
    const tile = session.engine.board.state[y]?.[x]; if (tile) block(ctx, x * size, (19 - y) * size, size, COLORS[tile.mino] ?? COLORS.gb);
  }
  if (!session.sleeping && !['completed','topout','stopped'].includes(session.status)) {
    const color = COLORS[session.engine.falling.symbol];
    for (const [x, y] of session.ghost()) if (y >= 0 && y < 20) block(ctx, x * size, (19 - y) * size, size, color, 0.2);
    for (const [x, y] of session.engine.falling.absoluteBlocks) if (y >= 0 && y < 20) block(ctx, x * size, (19 - y) * size, size, color);
  }
}
export function previewCells(session: Session | null, piece: Mino | null): { x: number; y: number; color: string }[] {
  if (!session || !piece) return [];
  return session.engine.getPreview(piece).data.map(([x, y]) => ({ x, y, color: COLORS[piece] }));
}
