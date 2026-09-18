/** Stage timing and lifetime correspond to the client windup presentation. */
export const WINDUP = Object.freeze({
  stageMilliseconds: [0, 345, 545, 745] as readonly number[],
  firstPartFrames: 60, partSpacingFrames: 30, reservationFrames: 120,
  fadeBaseMilliseconds: 1000, deleteBaseMilliseconds: 1500, partMilliseconds: 500,
  framesPerSecond: 60
});
// The requested solid text palette is independent of the original texture tint.
export const WINDUP_STAGES = [
  { glyph: '!', color: '#ffbf00' }, { glyph: '!', color: '#ff7700' },
  { glyph: '!!', color: '#f06b22' }, { glyph: '!!', color: '#ee3b38' }
] as const;
export type WindupNotice = { id: number; start: number; parts: number; amount: number; source: number };
export type WindupView = { id: number; level: number; glyph: string; color: string; amount: number; fading: boolean };
export function windupEnd(notice: WindupNotice): number {
  return notice.start + (WINDUP.deleteBaseMilliseconds + WINDUP.partMilliseconds * notice.parts) * WINDUP.framesPerSecond / 1000;
}
export function windupView(notices: readonly WindupNotice[], frame: number): WindupView | null {
  const notice = notices.find(n => frame >= n.start && frame < windupEnd(n));
  if (!notice) return null;
  const milliseconds = (frame - notice.start) * 1000 / WINDUP.framesPerSecond;
  let level = 1;
  while (level < notice.parts && level < WINDUP_STAGES.length && milliseconds >= WINDUP.stageMilliseconds[level]) level++;
  return { id: notice.id, level, ...WINDUP_STAGES[level - 1], amount: notice.amount,
    fading: milliseconds >= WINDUP.fadeBaseMilliseconds + WINDUP.partMilliseconds * notice.parts };
}
