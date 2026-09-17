import type { Config } from './config.ts';
export const FLOOR_ALTITUDES = [0, 0, 50, 150, 300, 450, 650, 850, 1100, 1350, 1650];
export const floorAt = (altitude: number): number => { const i = FLOOR_ALTITUDES.findIndex((v, i) => i > 1 && v > altitude); return i < 0 ? 10 : i - 1; };
const PERMANENT = [28800,28830,36000,36030,36060,43200,43230,43260,43310,43360];
export class Environment {
  altitude: number; rank = 1; peakRank = 1; rankSum = 0; rankFrames = 0; climb = 0;
  bonus = 0; totalBonus = 0; rankLockedUntil = 0; promotionFatigue = 0; promoted = false;
  fatigueFrame = 0; permanentRows = 0; receiveBonus = 0; splits = Array<number>(10).fill(0);
  gravity: number; attack: number; receive: number; lock: number;
  constructor(c: Config) { this.altitude = c.altitude ?? FLOOR_ALTITUDES[c.floor]; this.gravity = c.gravity; this.attack = c.attackMultiplier; this.receive = c.receiveMultiplier; this.lock = c.lockTime; }
  effective(c: Config): Config {
    return { ...c, altitude: this.altitude, floor: c.progression ? floorAt(this.altitude) : c.floor,
      gravity: this.gravity, attackMultiplier: this.attack, receiveMultiplier: this.receive + this.receiveBonus, lockTime: this.lock };
  }
  change(previous: Config, next: Config): void {
    if (previous.altitude !== next.altitude || previous.floor !== next.floor) this.altitude = next.altitude ?? FLOOR_ALTITUDES[next.floor];
    for (const [option, value] of [['gravity','gravity'],['attackMultiplier','attack'],['receiveMultiplier','receive'],['lockTime','lock']] as const) if (previous[option] !== next[option]) this[value] = next[option];
  }
  award(lines: number, sent: boolean, c: Config): void {
    if (!c.progression) return;
    let bonus = .25 * Math.floor(this.rank) * lines * (sent ? 1 : 0);
    const boundary = FLOOR_ALTITUDES.find(a => a > this.altitude) ?? Infinity;
    const left = boundary - this.altitude - bonus - this.bonus;
    if (left >= 0 && left <= 2) bonus += 3;
    this.bonus += bonus; this.totalBonus += bonus; this.climb += lines + .05;
  }
  tick(frame: number, c: Config): number {
    if (c.gravityIncrease) this.gravity = Math.min(1000, this.gravity + c.gravityRate / 60);
    if (c.attackIncrease) this.attack = Math.min(100, this.attack + c.attackRate / 60);
    if (c.receiveIncrease) this.receive = Math.min(100, this.receive + c.receiveRate / 60);
    if (c.lockDecrease) this.lock = Math.max(Math.min(c.lockMinimum,c.lockTime), this.lock - c.lockRate / 60);
    if (c.progression) {
      const before = floorAt(this.altitude); let rank = Math.floor(this.rank);
      if (frame >= this.rankLockedUntil) this.climb -= 5 * (rank * rank + rank) / 3600;
      if (this.climb < 0) {
        if (rank <= 1) this.climb = 0;
        else { this.climb += 4 * (rank - 1); rank--; this.promoted = false; }
      } else if (this.climb >= 4 * rank) {
        this.climb -= 4 * rank; this.promoted = true;
        this.rankLockedUntil = frame + Math.max(60,60 * (5 - this.promotionFatigue)); this.promotionFatigue++; rank++;
      }
      if (this.promoted && this.climb >= 2 * (rank - 1)) this.promotionFatigue = 0;
      this.rank = rank + this.climb / (4 * rank); this.peakRank = Math.max(this.rank,this.peakRank);
      this.rankSum += this.rank; this.rankFrames++;
      const boundary = FLOOR_ALTITUDES.find(a => a > this.altitude) ?? Infinity;
      this.altitude += .25 * rank / 60 * Math.max(0,Math.min(1,(boundary-this.altitude)/5-.2));
      const used = this.bonus <= .05 ? this.bonus : Math.min(10,.1*this.bonus);
      this.altitude += used; this.bonus -= used;
      const after = floorAt(this.altitude);
      for (let i = before; i < after; i++) if (!this.splits[i]) this.splits[i] = frame / 60;
    }
    if (!c.fatigue) return 0;
    this.fatigueFrame++;
    if (this.fatigueFrame === 32400 || this.fatigueFrame === 39600) this.receiveBonus += .25;
    if (PERMANENT.includes(this.fatigueFrame)) { this.permanentRows++; return 1; }
    return 0;
  }
  snapshot() { return structuredClone({ ...this }); }
  restore(snapshot: ReturnType<Environment['snapshot']>): void { Object.assign(this,structuredClone(snapshot)); }
}
