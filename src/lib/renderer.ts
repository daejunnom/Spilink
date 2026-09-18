// Canvas block rendering adapted from Clearra contributors (MIT).
import type { Session } from './session.ts';
import type { Mino } from './port.ts';

import { BOARD_VIEW, BOARD_ASPECT, boardScreenY } from './board-view.ts';
export const COLORS: Record<string, string> = { i5: '#49d4e7', gbd: '#394854', i: '#49d4e7', j: '#6192ee', l: '#f5ad68', o: '#f0d56c', s: '#75cf9c', t: '#bc92ed', z: '#ee8491', gb: '#849499' };
function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opacity = 1): void {
  ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  const bevel = Math.max(1, size * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1, y + 1, size - 2, bevel);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 1, y + size - bevel - 1, size - 2, bevel);
  ctx.globalAlpha = 1;
}
function boardY(y: number, size: number): number {
  return boardScreenY(y, size);
}
function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ff4040';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.18, y + size * 0.18);
  ctx.lineTo(x + size * 0.82, y + size * 0.82);
  ctx.moveTo(x + size * 0.82, y + size * 0.18);
  ctx.lineTo(x + size * 0.18, y + size * 0.82);
  ctx.stroke();
  ctx.restore();
}
export function drawBoard(canvas: HTMLCanvasElement, session: Session): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const ratio = Math.min(3, window.devicePixelRatio || 1), width = Math.round(canvas.clientWidth * ratio), height = Math.round(width * BOARD_ASPECT);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const size = canvas.width / BOARD_VIEW.columns;
  ctx.fillStyle = '#0c141d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(115, 140, 155, 0.08)'; ctx.fillRect(0, 0, canvas.width, size * BOARD_VIEW.extraRows);
  ctx.strokeStyle = 'rgba(153,187,204,.08)'; ctx.lineWidth = 1;
  for (let x = 0; x <= BOARD_VIEW.columns; x++) { ctx.beginPath(); ctx.moveTo(x * size, 0); ctx.lineTo(x * size, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= BOARD_VIEW.rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * size); ctx.lineTo(canvas.width, y * size); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(138, 218, 194, 0.25)';
  ctx.beginPath(); ctx.moveTo(0, size * BOARD_VIEW.extraRows); ctx.lineTo(canvas.width, size * BOARD_VIEW.extraRows); ctx.stroke();
  for (let y = 0; y < BOARD_VIEW.rows; y++) for (let x = 0; x < BOARD_VIEW.columns; x++) {
    const tile = session.engine.board.state[y]?.[x]; if (tile) block(ctx, x * size, boardY(y, size), size, COLORS[tile.mino] ?? COLORS.gb);
  }
  if (!session.sleeping && !['completed','topout','stopped'].includes(session.status)) {
    const color = COLORS[session.engine.falling.symbol];
    const warning = session.spawnWarning();
    if (warning) {
      ctx.save(); ctx.strokeStyle='rgba(186,210,221,.38)'; ctx.lineWidth=Math.max(1,size*.045); ctx.setLineDash([size*.12,size*.12]);
      for (const [x,y] of warning.spawn) if (y>=0 && y<BOARD_VIEW.rows) ctx.strokeRect(x*size+2,boardY(y,size)+2,size-4,size-4);
      ctx.restore();
    }
    for (const [x, y] of session.ghost()) if (y >= 0 && y < BOARD_VIEW.rows) {
      const top = boardY(y, size);
      block(ctx, x * size, top, size, color, 0.2);
    }
    for (const [x, y] of session.engine.falling.absoluteBlocks) if (y >= 0 && y < BOARD_VIEW.rows) block(ctx, x * size, boardY(y, size), size, color);
    for (const [x,y] of warning?.overlap??[]) if (y>=0&&y<BOARD_VIEW.rows) drawCross(ctx,x*size,boardY(y,size),size);
    canvas.dataset.spawnBlocked=String(warning?.blocked??false);
    canvas.dataset.spawnWarningCells=String(warning?.overlap.length??0);
  }
}
export function previewCells(session: Session | null, piece: Mino | null): { x: number; y: number; color: string }[] {
  if (!session || !piece) return [];
  return session.engine.getPreview(piece).data.map(([x, y]) => ({ x, y, color: COLORS[piece] }));
}
