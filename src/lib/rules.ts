import type { Config } from './config.ts';
import type { ClearEvent } from './port.ts';
export class Random {
  state: number;
  constructor(seed: number) { this.state = Math.max(1, Math.trunc(seed) % 2147483647); }
  next(): number { this.state = this.state * 16807 % 2147483647; return (this.state - 1) / 2147483646; }
}
export type AttackEvent = { kind: 'surge' | 'clear' | 'allclear'; amount: number };
export class AttackRules {
  combo = 0; btb = 0; topCombo = 0; topBtb = 0;
  resolve(e: ClearEvent, c: Config): AttackEvent[] {
    const out: AttackEvent[] = [];
    if (!e.lines) { this.combo = 0; return out; }
    this.combo++;
    if (e.lines >= 4 || e.spin !== 'none') this.btb++;
    else {
      if (this.btb > c.chargeAt) {
        const n = Math.floor((this.btb - c.chargeAt + c.chargeBase) * c.attackMultiplier);
        const a = Math.round(n / 3);
        for (const amount of [a, a, n - 2 * a]) if (amount) out.push({ kind: 'surge', amount });
      }
      this.btb = 0;
    }
    this.topCombo = Math.max(this.topCombo, this.combo);
    this.topBtb = Math.max(this.topBtb, this.btb);
    const table = e.spin === 'normal' ? [0, 2, 4, 6, 10] : [0, 0, 1, 2, 4];
    let attack = table[Math.min(4, e.lines)];
    if (this.btb > 1) attack++;
    attack *= 1 + 0.25 * (this.combo - 1);
    if (this.combo > 2) attack = Math.max(attack, Math.log1p((this.combo - 1) * 1.25));
    attack = Math.floor(attack * c.attackMultiplier);
    if (c.specialBonus && e.garbageCleared > 0 && (e.spin !== 'none' || e.lines >= 4)) attack++;
    if (attack) out.push({ kind: 'clear', amount: attack });
    if (e.pc) {
      const amount = Math.floor(10 * c.attackMultiplier);
      if (amount) out.push({ kind: 'allclear', amount });
    }
    return out;
  }
}
export class Measurement {
  pieces = 0; attack = 0; first400Attack = 0;
  checkpoint: { pieces: 400; attack: number; frame: number } | null = null;
  record(attack: number, frame: number, continueAfter400: boolean): boolean {
    if (!Number.isFinite(attack) || attack < 0 || !Number.isFinite(frame) || frame < 0) throw new Error('Invalid measurement.');
    this.pieces++; this.attack += attack;
    if (this.pieces <= 400) this.first400Attack += attack;
    if (this.pieces === 400) this.checkpoint = { pieces: 400, attack: this.first400Attack, frame };
    return this.pieces >= 400 && !continueAfter400;
  }
}
export function splitLargeAttack(amount: number, altitude: number): number[] {
  if (amount < 8) return [amount];
  const capacity = 16 + (altitude >= 4000 ? Math.floor((altitude - 3500) / 500) : 0);
  const part = Math.floor(capacity / 4), extra = capacity % 4;
  const result: number[] = [];
  for (let i = 0; i < 4 && amount > 0; i++) {
    const n = Math.min(amount, part + (i >= 4 - extra ? 1 : 0));
    result.push(n); amount -= n;
  }
  return result;
}
