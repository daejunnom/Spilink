import type { Config } from './config.ts';
import { Random } from './rules.ts';

/** Synthetic practice pacing, not a sampled multiplayer population. */
export const ATTACK_PACING = Object.freeze({
  version: 'paced-1', framesPerMinute: 3600, cadenceFrames: 240,
  minimumJitter: .75, maximumJitter: 1.25, assistHeight: 16
});
export type GeneratedAttack = { amount: number; assisted: boolean };
export function stochasticDamage(expected: number, draw: () => number): number {
  if (!Number.isFinite(expected) || expected < 0) throw new Error('Invalid damage budget.');
  const whole = Math.floor(expected), fraction = expected - whole;
  return whole + (fraction > 0 && draw() < fraction ? 1 : 0);
}
export class AttackSource {
  random: Random;
  nextFrame: number;
  private lastFrame = 0;
  private credit = 0;
  private rate: number;
  private cap: number;
  private suppressed = false;
  constructor(c: Config) {
    this.random = new Random((c.seed + 97) % 2147483646 + 1);
    this.nextFrame = c.firstAttackFrames; this.rate = c.incomingApm; this.cap = c.maxAttack;
  }
  private interval(c: Config): number {
    const p = ATTACK_PACING;
    const jitter = p.minimumJitter + this.random.next() * (p.maximumJitter - p.minimumJitter);
    // A small packet cap changes cadence, not the requested long-run rate.
    const capFrames = c.incomingApm > 0 ? c.maxAttack * p.framesPerMinute / c.incomingApm : Infinity;
    return Math.max(1, Math.floor(Math.min(p.cadenceFrames * jitter, capFrames)));
  }
  next(frame: number, c: Config, pressure: number): GeneratedAttack | null {
    if (!Number.isSafeInteger(frame) || frame < this.lastFrame) throw new Error('Invalid attack clock.');
    let elapsed = frame - this.lastFrame; this.lastFrame = frame;
    if (c.incomingApm !== this.rate || c.maxAttack !== this.cap) {
      // Do not charge a new rate for old time or dump an old high-rate budget.
      this.rate = c.incomingApm; this.cap = c.maxAttack; this.credit = 0;
      this.nextFrame = frame + this.interval(c); elapsed = 0;
    }
    const suppress = c.incomingApm > 0 && c.pressureAssist && pressure >= ATTACK_PACING.assistHeight;
    if (suppress !== this.suppressed) {
      this.suppressed = suppress; this.credit = 0;
      this.nextFrame = Math.max(this.nextFrame, frame + this.interval(c));
      return { amount: 0, assisted: suppress };
    }
    if (!c.incomingApm || suppress) { this.credit = 0; return null; }
    const maxWindow = ATTACK_PACING.cadenceFrames * ATTACK_PACING.maximumJitter;
    // Preparation delays and skipped time cannot bank a large catch-up attack.
    const maximumCredit = Math.min(c.maxAttack, c.incomingApm * maxWindow / ATTACK_PACING.framesPerMinute);
    this.credit = Math.min(maximumCredit, this.credit + elapsed * c.incomingApm / ATTACK_PACING.framesPerMinute);
    if (frame < this.nextFrame) return null;
    const amount = stochasticDamage(this.credit, () => this.random.next());
    this.credit = 0; this.nextFrame = frame + this.interval(c);
    return amount > 0 ? { amount, assisted: false } : null;
  }
  snapshot() {
    return { randomState: this.random.state, nextFrame: this.nextFrame, lastFrame: this.lastFrame,
      credit: this.credit, rate: this.rate, cap: this.cap, suppressed: this.suppressed };
  }
  restore(value: ReturnType<AttackSource['snapshot']>): void {
    const { randomState, ...rest } = value;
    Object.assign(this, rest); this.random.state = randomState;
  }
}
