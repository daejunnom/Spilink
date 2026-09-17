export type Mino = 'i' | 'j' | 'l' | 'o' | 's' | 't' | 'z' | 'i5';
export type Tile = { mino: string; connections?: number } | null;
export type GameKey = 'moveLeft' | 'moveRight' | 'softDrop' | 'hardDrop' | 'rotateCW' | 'rotateCCW' | 'rotate180' | 'hold';
export type KeyFrame = { frame: number; type: 'keydown' | 'keyup'; data: { key: GameKey; subframe: number; hoisted?: boolean } };
export type ClearEvent = { lines: number; garbageCleared: number; pc: boolean; hard: boolean; mino: Mino; spin: 'normal' | 'mini' | 'none' };
export interface EnginePort {
  frame: number; subframe: number; state: number; glock: number;
  board: { state: Tile[][]; width: number; height: number; fullHeight: number };
  falling: { symbol: Mino; x: number; y: number; location: [number, number]; rotation: number; absoluteBlocks: [number, number][]; blocks: [number, number][]; safeLock: number; locking: number; lockResets: number; highestY: number };
  queue: Mino[]; held: Mino | null; holdLocked: boolean; toppedOut: boolean;
  stats: { combo: number; b2b: number; pieces: number; lines: number; garbage: { attack: number; sent: number; receive: number; cleared: number } };
  lastSpin: ClearEvent['spin'] | null; lastWasClear: boolean;
  input: { lShift: { held: boolean; das: number; arr: number }; rShift: { held: boolean; das: number; arr: number }; keys: Record<string, boolean> };
  resCache: { pieces: number; keys: string[]; lastLock: number; garbage: { sent: number[]; received: unknown[] } };
  spilinkHooks?: { canTick(): boolean; clear(event: ClearEvent): unknown; input?(event: KeyFrame): void; held?(): void; score?(points: number): void; next?(): Mino };
  tick(events: KeyFrame[]): unknown;
  initiatePiece(piece: Mino, ignoreBlockout?: boolean, isHold?: boolean): void;
  dynamic: { gravity: { get(): number; set(value: number): void; tick(): void } };
  misc: { movement: { lockTime: number; may20G: boolean } };
  handling: Record<string, unknown>;
  gameOptions: { spinBonuses: string };
  nextPiece(ignoreBlockout?: boolean, isHold?: boolean): void;
  getPreview(piece: Mino): { w: number; h: number; data: number[][] };
  snapshot(): unknown;
  fromSnapshot(snapshot: unknown): void;
}
