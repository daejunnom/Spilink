import type { Config } from './config.ts';

/** Practice delivery policy, not a change to native garbage caps or windup rules. */
export const ATTACK_PACKETS = Object.freeze({
  version: 'apm-split-1', lowApm: 10, lowCap: 5, referenceApm: 150, referenceCap: 8,
  minimumGapFrames: 45, maximumGapFrames: 75, fundingGapShare: .5
});
export function incomingPacketLimit(c: Pick<Config, 'incomingApm' | 'maxAttack' | 'attackPacketCap'>): number {
  const p = ATTACK_PACKETS;
  const ratio = Math.min(1, Math.max(0, (c.incomingApm - p.lowApm) / (p.referenceApm - p.lowApm)));
  const automatic = Math.round(p.lowCap + (p.referenceCap - p.lowCap) * ratio);
  return Math.max(1, Math.min(c.maxAttack, Math.max(1, Math.ceil(c.incomingApm)), c.attackPacketCap ?? automatic));
}
/** Preserve every line while avoiding one-line tails when a balanced split is possible. */
export function splitAttackGroup(total: number, cap: number, draw: () => number): number[] {
  if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(cap) || cap < 1) throw new Error('Invalid attack split.');
  if (total <= cap) return [total];
  let remaining = total, count = Math.ceil(total / cap);
  const minimum = remaining >= count * 2 ? 2 : 1, parts: number[] = [];
  while (count > 1) {
    const low = Math.max(minimum, Math.ceil(remaining / count));
    const high = Math.min(cap, remaining - minimum * (count - 1));
    const fraction = high > low ? draw() : 0;
    if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) throw new Error('Invalid split random draw.');
    const part = low + Math.floor(fraction * (high - low + 1));
    parts.push(part); remaining -= part; count--;
  }
  parts.push(remaining);
  return parts;
}
export function splitGapFrames(amount: number, apm: number, framesPerMinute: number, draw: () => number): number {
  const p = ATTACK_PACKETS;
  const jitter = p.minimumGapFrames + draw() * (p.maximumGapFrames - p.minimumGapFrames);
  // Very high APM needs shorter spacing; the gap must not throttle the configured rate.
  return Math.max(1, Math.ceil(Math.min(jitter, amount * framesPerMinute / apm * p.fundingGapShare)));
}
