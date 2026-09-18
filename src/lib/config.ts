import { PRACTICE_TIMING_DEFAULTS, SEASON_TWO_PC } from './rule-defaults.ts';
import { AppError } from './errors.ts';
import type { GameKey } from './port.ts';
export type Command = 'pause' | 'retry' | 'undo' | 'redo';
export type Bindings = Record<GameKey | Command, string>;
export type Config = {
  continueAfter400: boolean; seed: number; gravity: number; gravityIncrease: boolean;
  gravityRate: number; incomingApm: number; maxAttack: number; floor: number;
  initialGarbage: number; firstAttackFrames: number; garbageCap: number;
  attackMultiplier: number; receiveMultiplier: number; cancelMultiplier: number;
  chargeAt: number; chargeBase: number; specialBonus: boolean; pressureAssist: boolean;
  arr: number; das: number; dcd: number; sdf: number; safelock: boolean;
  cancel: boolean; may20g: boolean; irs: 'off' | 'hold' | 'tap'; ihs: 'off' | 'hold' | 'tap';
  lockTime: number; ttrx: boolean; bindings: Bindings; clutch: boolean; noLockout: boolean;
  playerName: string; bagType: '7-bag' | 'zenith'; spinBonuses: 'all-mini+' | 'all+' | 'all' | 'all-mini' | 'T-spins' | 'T-spins+';
  altitude: number | null; senderAltitude: number | null; progression: boolean;
  cancelCorrection: boolean; targetingGrace: boolean; timeCancelFatigue: boolean; fatigue: boolean;
  garbageSpeed: number; garbagePhase: number | null; garbageQueue: boolean; absoluteCap: number;
  garbageEntry: 'instant' | 'delayed' | 'continuous'; are: number; lineClearAre: number; garbageAre: number; garbageAreBump: number;
  messinessInner: number | null; messinessChange: number | null; garbageFavor: number | null; noSameHole: boolean;
  roundMode: 'down' | 'rng'; attackCap: number; allClearGarbage: number; allClearB2B: number;
  initialQueue: string; initialBoard: string; initialPending: number; startGrace: number; maxDuration: number;
  attackIncrease: boolean; attackRate: number; receiveIncrease: boolean; receiveRate: number;
  lockDecrease: boolean; lockRate: number; lockMinimum: number;

};
export const DEFAULT_CONFIG: Config = {
  continueAfter400: false, seed: 1, gravity: 0.02, gravityIncrease: false,
  gravityRate: 0.0001, incomingApm: 45, maxAttack: 24, floor: 1,
  initialGarbage: 0, firstAttackFrames: 30, garbageCap: 8,
  attackMultiplier: 1, receiveMultiplier: 1, cancelMultiplier: 1,
  chargeAt: 4, chargeBase: 0, specialBonus: true, pressureAssist: false,
  arr: 2, das: 10, dcd: 2, sdf: 6, safelock: true, cancel: false, may20g: true,
  irs: 'tap', ihs: 'tap', lockTime: 30, ttrx: false,
  playerName: 'SPILINK', bagType: '7-bag', spinBonuses: 'all-mini+', altitude: null, senderAltitude: null, progression: false,
  cancelCorrection: true, targetingGrace: true, timeCancelFatigue: false, fatigue: false,
  ...PRACTICE_TIMING_DEFAULTS, absoluteCap: 0,
  garbageEntry: 'instant', are: 0, lineClearAre: 0, clutch: true, noLockout: true,
  messinessInner: null, messinessChange: null, garbageFavor: null, noSameHole: false,
  roundMode: 'down', attackCap: 0, allClearGarbage: 10, allClearB2B: SEASON_TWO_PC.allClearB2B,
  initialQueue: '', initialBoard: '', initialPending: 0, startGrace: 0, maxDuration: 3600,
  attackIncrease: false, attackRate: 0.01, receiveIncrease: false, receiveRate: 0.01,
  lockDecrease: false, lockRate: 0.01, lockMinimum: 6,
  bindings: { moveLeft: 'ArrowLeft', moveRight: 'ArrowRight', softDrop: 'ArrowDown',
    hardDrop: 'Space', rotateCW: 'ArrowUp', rotateCCW: 'KeyZ', rotate180: 'KeyA',
    hold: 'KeyC', pause: 'Escape', retry: 'KeyR', undo: 'Control+KeyZ', redo: 'Control+KeyY' }
};
export function validateConfig(input: unknown): Config {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('error.config');
  const v = input as Record<string, unknown>;
  const c = structuredClone(DEFAULT_CONFIG);
  const ranges: Partial<Record<keyof Config, [number, number, number]>> = {
    seed: [1, 2147483646, 1], gravity: [0, 1000, 0], gravityRate: [0, 100, 0],
    incomingApm: [0, 2000, 0.1], maxAttack: [1, 1000, 1], floor: [1, 10, 1],
    initialGarbage: [0, 19, 1], firstAttackFrames: [0, 36000, 1], garbageCap: [1, 40, 1],
    attackMultiplier: [0, 100, 0], receiveMultiplier: [0, 100, 0], cancelMultiplier: [1, 100, 0],
    chargeAt: [0, 10, 1], chargeBase: [0, 10, 1], arr: [0, 5, 0.1], das: [1, 20, 0.1],
    dcd: [0, 20, 0.1], sdf: [5, 41, 1], lockTime: [0, 3600, 1],
    garbageSpeed: [0, 36000, 1], absoluteCap: [0, 10000, 1], are: [0, 300, 1], lineClearAre: [0, 300, 1], garbageAre: [1, 300, 1], garbageAreBump: [0, 300, 1],
    attackCap: [0, 10000, 1], allClearGarbage: [0, 10000, 1], allClearB2B: [0, 100, 1], initialPending: [0, 1000, 1], startGrace: [0, 36000, 1], maxDuration: [0, 86400, 1],
    attackRate: [0, 100, 0], receiveRate: [0, 100, 0], lockRate: [0, 100, 0], lockMinimum: [0, 3600, 1]
  };
  for (const [key, range] of Object.entries(ranges)) {
    const value = v[key] ?? c[key as keyof Config];
    const [min, max, step] = range;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (step && Math.abs(value / step - Math.round(value / step)) > 1e-7)) throw new AppError('error.range', {key,min,max,step});
    Object.assign(c, { [key]: value });
  }
  for (const key of ['clutch','noLockout','continueAfter400','gravityIncrease','specialBonus','pressureAssist','safelock','cancel','may20g','ttrx','progression','cancelCorrection','targetingGrace','timeCancelFatigue','fatigue','garbageQueue','noSameHole','attackIncrease','receiveIncrease','lockDecrease'] as const) {
    if (v[key] !== undefined && typeof v[key] !== 'boolean') throw new AppError('error.toggle', {key});
    c[key] = (v[key] ?? c[key]) as boolean;
  }
  for (const key of ['irs','ihs'] as const) {
    if (v[key] !== undefined && !['off','hold','tap'].includes(v[key] as string)) throw new AppError('error.initialHandling');
    c[key] = (v[key] ?? c[key]) as Config[typeof key];
  }
  const nullableRanges = { altitude: [0, 100000], senderAltitude: [0, 100000], garbagePhase: [0, 36000], messinessInner: [0, 10], messinessChange: [0, 10], garbageFavor: [-1000, 1000] };
  for (const [key, [min, max]] of Object.entries(nullableRanges)) {
    const value = v[key] ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (key === 'garbagePhase' && !Number.isInteger(value)))) throw new AppError('error.range', {key,min,max,step:key==='garbagePhase'?1:0});
    Object.assign(c, { [key]: value });
  }
  const enums = { bagType: ['7-bag','zenith'], roundMode: ['down','rng'], garbageEntry: ['instant','delayed','continuous'], spinBonuses: ['all-mini+','all+','all','all-mini','T-spins','T-spins+'] };
  for (const [key, values] of Object.entries(enums)) {
    const value = v[key] ?? c[key as keyof Config];
    if (!values.includes(value as string)) throw new AppError('error.choice', {key});
    Object.assign(c, { [key]: value });
  }
  for (const key of ['playerName','initialQueue','initialBoard'] as const) {
    const value = v[key] ?? c[key];
    if (typeof value !== 'string') throw new AppError('error.string', {key});
    c[key] = value.trim();
  }
  if (!c.playerName || c.playerName.length > 32 || /[\x00-\x1f\x7f]/.test(c.playerName)) throw new AppError('error.playerName');
  if (c.initialQueue.length > 4096 || (c.initialQueue && !/^(?:[IJLOSTZ]|I5)(?:[ ,]*(?:[IJLOSTZ]|I5))*$/i.test(c.initialQueue))) throw new AppError('error.queue');
  if (c.initialBoard) {
    const rows = c.initialBoard.split(/\r?\n/);
    if (rows.length > 40 || rows.some(row => !/^[.IJLOSTZGX]{10}$/i.test(row))) throw new AppError('error.board');
  }
  const bindings = v.bindings ?? c.bindings;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new AppError('error.bindings');
  const used = new Set<string>();
  for (const key of Object.keys(c.bindings) as (keyof Bindings)[]) {
    const code = (bindings as Record<string, unknown>)[key] ?? c.bindings[key];
    if (typeof code !== 'string' || !/^(?:(?:Control|Alt|Shift|Meta)\+)*[A-Za-z][A-Za-z0-9]{0,31}$/.test(code)) throw new AppError('error.key', {key});
    if (used.has(code)) throw new AppError('error.duplicateKey', {key:code});
    used.add(code); c.bindings[key] = code;
  }
  return c;
}
