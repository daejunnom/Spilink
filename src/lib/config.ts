import type { GameKey } from './port.ts';
export type Bindings = Record<GameKey | 'pause' | 'retry', string>;
export type Config = {
  continueAfter400: boolean; seed: number; gravity: number; gravityIncrease: boolean;
  gravityRate: number; incomingApm: number; maxAttack: number; floor: number;
  initialGarbage: number; firstAttackFrames: number; garbageCap: number;
  attackMultiplier: number; receiveMultiplier: number; cancelMultiplier: number;
  chargeAt: number; chargeBase: number; specialBonus: boolean; pressureAssist: boolean;
  arr: number; das: number; dcd: number; sdf: number; safelock: boolean;
  cancel: boolean; may20g: boolean; irs: 'off' | 'hold' | 'tap'; ihs: 'off' | 'hold' | 'tap';
  lockTime: number; ttrx: boolean; bindings: Bindings;
};
export const DEFAULT_CONFIG: Config = {
  continueAfter400: false, seed: 1, gravity: 0.02, gravityIncrease: false,
  gravityRate: 0.0001, incomingApm: 45, maxAttack: 24, floor: 1,
  initialGarbage: 0, firstAttackFrames: 30, garbageCap: 8,
  attackMultiplier: 1, receiveMultiplier: 1, cancelMultiplier: 1,
  chargeAt: 4, chargeBase: 0, specialBonus: true, pressureAssist: false,
  arr: 2, das: 10, dcd: 2, sdf: 6, safelock: true, cancel: false, may20g: true,
  irs: 'tap', ihs: 'tap', lockTime: 30, ttrx: false,
  bindings: { moveLeft: 'ArrowLeft', moveRight: 'ArrowRight', softDrop: 'ArrowDown',
    hardDrop: 'Space', rotateCW: 'ArrowUp', rotateCCW: 'KeyZ', rotate180: 'KeyA',
    hold: 'KeyC', pause: 'Escape', retry: 'KeyR' }
};
export function validateConfig(input: unknown): Config {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('설정 형식이 올바르지 않습니다.');
  const v = input as Record<string, unknown>;
  const c = structuredClone(DEFAULT_CONFIG);
  const ranges: Partial<Record<keyof Config, [number, number, number]>> = {
    seed: [1, 2147483646, 1], gravity: [0, 1000, 0], gravityRate: [0, 100, 0],
    incomingApm: [0, 2000, 0], maxAttack: [1, 1000, 1], floor: [1, 10, 1],
    initialGarbage: [0, 19, 1], firstAttackFrames: [0, 36000, 1], garbageCap: [1, 40, 1],
    attackMultiplier: [0, 100, 0], receiveMultiplier: [0, 100, 0], cancelMultiplier: [1, 100, 0],
    chargeAt: [0, 10, 1], chargeBase: [0, 10, 1], arr: [0, 5, 0.1], das: [1, 20, 0.1],
    dcd: [0, 20, 0.1], sdf: [5, 41, 1], lockTime: [0, 3600, 1]
  };
  for (const [key, range] of Object.entries(ranges)) {
    const value = v[key] ?? c[key as keyof Config];
    const [min, max, step] = range;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (step && Math.abs(value / step - Math.round(value / step)) > 1e-7)) throw new Error(`${key}: ${min}~${max}${step ? `, 단위 ${step}` : ''} 범위의 값을 입력하세요.`);
    Object.assign(c, { [key]: value });
  }
  for (const key of ['continueAfter400','gravityIncrease','specialBonus','pressureAssist','safelock','cancel','may20g','ttrx'] as const) {
    if (v[key] !== undefined && typeof v[key] !== 'boolean') throw new Error(`${key}: 토글 값이 올바르지 않습니다.`);
    c[key] = (v[key] ?? c[key]) as boolean;
  }
  for (const key of ['irs','ihs'] as const) {
    if (v[key] !== undefined && !['off','hold','tap'].includes(v[key] as string)) throw new Error('IRS/IHS 설정이 올바르지 않습니다.');
    c[key] = (v[key] ?? c[key]) as Config[typeof key];
  }
  const bindings = v.bindings ?? c.bindings;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('키 설정이 올바르지 않습니다.');
  const used = new Set<string>();
  for (const key of Object.keys(c.bindings) as (keyof Bindings)[]) {
    const code = (bindings as Record<string, unknown>)[key];
    if (typeof code !== 'string' || !/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Escape|Tab|Backspace|Enter|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|F([1-9]|1[0-2]))$/.test(code)) throw new Error(`${key}: 지원되지 않는 키입니다.`);
    if (used.has(code)) throw new Error(`${code}: 다른 동작에 이미 지정된 키입니다.`);
    used.add(code); c.bindings[key] = code;
  }
  return c;
}
