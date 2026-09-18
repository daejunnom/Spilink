/** Display geometry only. The rules still use a 20-row field plus a 20-row buffer. */
export const BOARD_VIEW = Object.freeze({ columns: 10, fieldRows: 20, extraRows: 4, rows: 24 });
export const BOARD_ASPECT = BOARD_VIEW.rows / BOARD_VIEW.columns;
export const SPAWN_BAND_PERCENT = BOARD_VIEW.extraRows / BOARD_VIEW.rows * 100;
export function boardScreenY(row: number, cell: number): number {
  return (BOARD_VIEW.rows - 1 - row) * cell;
}
