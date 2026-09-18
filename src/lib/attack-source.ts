import type { Config } from './config.ts';
import { Random } from './rules.ts';
import { ATTACK_WINDOW_FRAMES, RollingAttackBudget } from './attack-budget.ts';
import { incomingPacketLimit, splitAttackGroup, splitGapFrames } from './attack-packets.ts';

/** Synthetic size/gap distribution. Receiver windup rules are a separate, native contract. */
export const ATTACK_PACING = Object.freeze({
  version: 'rolling-split-1', framesPerMinute: ATTACK_WINDOW_FRAMES,
  minimumJitter: .7, maximumJitter: 1.3, assistHeight: 16,
  smallChance: .2, mediumChance: .65, smallMax: 2, mediumMax: 7, largeMin: 8,
  packetBudgetShare: .5, minimumGapFrames: 12, maximumClockGap: 300
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
  private budget = new RollingAttackBudget();
  private splitRandom: Random;
  private pendingParts: number[] = [];
  private packetCap: number | null;
  private lastFrame = 0;
  private processedFrame = -1;
  private credit = 0;
  private planned = 1;
  private rate: number;
  private cap: number;
  private suppressed = false;
  constructor(c: Config) {
    this.random = new Random((c.seed + 97) % 2147483646 + 1);
    this.rate = c.incomingApm; this.cap = c.maxAttack;
    this.packetCap = c.attackPacketCap;
    this.splitRandom = new Random((c.seed + 193) % 2147483646 + 1);
    this.nextFrame = c.firstAttackFrames;
    this.plan(c.firstAttackFrames, c);
  }
  private integer(min: number, max: number): number { return min + Math.floor(this.random.next() * (max - min + 1)); }
  private plan(frame: number, c: Config): void {
    if (!c.incomingApm) { this.nextFrame = frame; return; }
    const p = ATTACK_PACING, choice = this.random.next();
    const desired = choice < p.smallChance ? this.integer(1, p.smallMax)
      : choice < p.smallChance + p.mediumChance ? this.integer(2, p.mediumMax)
      : this.integer(p.largeMin, Math.max(p.largeMin, c.maxAttack));
    // Low rates wait for a multi-line group instead of flushing a sub-one credit every few seconds.
    this.planned = Math.min(desired, c.maxAttack, Math.ceil(c.incomingApm), Math.max(2, Math.ceil(c.incomingApm * p.packetBudgetShare)));
    const jitter = p.minimumJitter + this.random.next() * (p.maximumJitter - p.minimumJitter);
    const fundingTime = Math.max(0, this.planned - this.credit) * p.framesPerMinute / c.incomingApm;
    const minimumGap = Math.min(p.minimumGapFrames, p.framesPerMinute / c.incomingApm / 2);
    this.nextFrame = frame + Math.max(1, Math.ceil(Math.max(minimumGap, Math.min(p.framesPerMinute, fundingTime * jitter))));
  }
  next(frame: number, c: Config, pressure: number): GeneratedAttack | null {
    if (!Number.isSafeInteger(frame) || frame < this.lastFrame) throw new Error('Invalid attack clock.');
    if (frame === this.processedFrame) return null;
    this.processedFrame = frame;
    const previous = this.lastFrame, elapsed = frame - previous; this.lastFrame = frame;
    this.budget.advance(frame);
    const changed = c.incomingApm !== this.rate || c.maxAttack !== this.cap || c.attackPacketCap !== this.packetCap;
    const suppress = c.incomingApm > 0 && c.pressureAssist && pressure >= ATTACK_PACING.assistHeight;
    const suppressionChanged = suppress !== this.suppressed;
    this.rate = c.incomingApm; this.cap = c.maxAttack; this.packetCap = c.attackPacketCap; this.suppressed = suppress;
    if (changed || suppressionChanged || elapsed > ATTACK_PACING.maximumClockGap) {
      // Keep actual last-minute spend through edits and relief; only unspent preparation is discarded.
      this.credit = 0; this.pendingParts = []; this.plan(Math.max(frame, c.firstAttackFrames), c);
      return suppressionChanged ? { amount: 0, assisted: suppress } : null;
    }
    if (!c.incomingApm || suppress || frame < c.firstAttackFrames) return null;
    const eligible = Math.max(0, frame - Math.max(previous, c.firstAttackFrames));
    // Bounded preparation prevents an upfront minute or post-relief repayment, but is not the rolling cap.
    const creditCap = Math.min(c.maxAttack, Math.max(1, Math.ceil(c.incomingApm))) + 1;
    this.credit = Math.min(creditCap, this.credit + eligible * c.incomingApm / ATTACK_PACING.framesPerMinute);
    if (frame < this.nextFrame) return null;
    if (this.pendingParts.length) return this.deliver(frame, c);
    const available = this.budget.available(c.incomingApm);
    const minimumGroup = Math.min(this.planned, 2);
    if (available < minimumGroup) {
      // Do not repeatedly shave an intended group down to one line or reroll a failed probability each frame.
      this.nextFrame = Math.max(frame + 1, this.budget.nextRelease() ?? frame + ATTACK_WINDOW_FRAMES);
      return null;
    }
    const amount = stochasticDamage(Math.max(0, Math.min(this.credit, this.planned, available)), () => this.random.next());
    if (amount) {
      // Funding is allocated once for the whole group, but the rolling budget is charged only on delivery.
      this.credit -= amount;
      this.pendingParts = splitAttackGroup(amount, incomingPacketLimit(c), () => this.splitRandom.next());
      return this.deliver(frame, c);
    }
    this.plan(frame, c);
    return null;
  }
  private deliver(frame: number, c: Config): GeneratedAttack | null {
    const amount = this.pendingParts[0];
    if (amount > this.budget.available(c.incomingApm)) {
      this.nextFrame = Math.max(frame + 1, this.budget.nextRelease() ?? frame + ATTACK_WINDOW_FRAMES);
      return null;
    }
    this.budget.spend(frame, amount, c.incomingApm);
    this.pendingParts.shift();
    if (this.pendingParts.length) {
      this.nextFrame = frame + splitGapFrames(amount, c.incomingApm, ATTACK_PACING.framesPerMinute, () => this.splitRandom.next());
    } else this.plan(frame, c);
    return { amount, assisted: false };
  }
  snapshot() {
    return { randomState: this.random.state, nextFrame: this.nextFrame, lastFrame: this.lastFrame,
      processedFrame: this.processedFrame, credit: this.credit, planned: this.planned,
      rate: this.rate, cap: this.cap, packetCap: this.packetCap, suppressed: this.suppressed, recent: this.budget.snapshot(),
      splitRandomState: this.splitRandom.state, pendingParts: [...this.pendingParts] };
  }
  restore(value: ReturnType<AttackSource['snapshot']>): void {
    const { randomState, splitRandomState, pendingParts, recent, ...rest } = value;
    Object.assign(this, rest); this.random.state = randomState; this.budget.restore(recent);
    this.splitRandom.state = splitRandomState; this.pendingParts = [...pendingParts];
  }
}
