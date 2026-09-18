export const MAX_SEED = 2147483646;
/** UI-only entropy: replay execution continues to use its recorded seed. */
export function newSeed(previous: number, random: () => number = () => {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}): number {
  const value = random();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid seed entropy');
  const next = value % MAX_SEED + 1;
  return next === previous ? previous % MAX_SEED + 1 : next;
}
