import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, validateConfig } from '../src/lib/config.ts';
import { AttackRules, Measurement, splitLargeAttack, Random } from '../src/lib/rules.ts';
import { Receiver, AttackSource } from '../src/lib/garbage.ts';
import type { ClearEvent, Tile } from '../src/lib/port.ts';
const c = structuredClone(DEFAULT_CONFIG);
const clear = (lines: number, spin: ClearEvent['spin'] = 'none', pc = false): ClearEvent => ({ lines, spin, pc, garbageCleared: 0, hard: true, mino: 't' });
const board = (): Tile[][] => Array.from({ length: 40 }, () => Array(10).fill(null));
test('400 is the default and freezes after all attacks of that placement', () => {
  assert.equal(c.continueAfter400, false);
  const m = new Measurement();
  for (let i = 1; i < 400; i++) assert.equal(m.record(1, i, false), false);
  assert.equal(m.record(17, 400, false), true);
  assert.deepEqual(m.checkpoint, { pieces: 400, attack: 416, frame: 400 });
});
test('continuation leaves the first-400 result unchanged', () => {
  const m = new Measurement();
  for (let i = 1; i <= 401; i++) assert.equal(m.record(i === 401 ? 20 : 1, i, true), false);
  assert.equal(m.first400Attack, 400); assert.equal(m.attack, 420); assert.equal(m.checkpoint?.attack, 400);
});
test('zero attack on placement 400 still completes', () => {
  const m = new Measurement();
  for (let i = 0; i < 400; i++) m.record(0, i, false);
  assert.equal(m.checkpoint?.attack, 0); assert.equal(m.pieces, 400);
});
test('basic attacks and combo lower bound', () => {
  assert.deepEqual(new AttackRules().resolve(clear(1), c), []);
  assert.equal(new AttackRules().resolve(clear(2), c)[0].amount, 1);
  assert.equal(new AttackRules().resolve(clear(4), c)[0].amount, 4);
  assert.equal(new AttackRules().resolve(clear(1, 'normal'), c)[0].amount, 2);
  const rules = new AttackRules(); rules.resolve(clear(1), c); rules.resolve(clear(1), c);
  assert.equal(rules.resolve(clear(1), c)[0].amount, 1);
});
test('surge precedes ordinary and all-clear attacks; no combo multiplier on surge', () => {
  const rules = new AttackRules(); rules.btb = 10; rules.combo = 8;
  const attacks = rules.resolve(clear(2, 'none', true), c);
  assert.deepEqual(attacks.slice(0, 3), [{ kind: 'surge', amount: 2 }, { kind: 'surge', amount: 2 }, { kind: 'surge', amount: 2 }]);
  assert.equal(attacks[3].kind, 'clear'); assert.equal(attacks[4].kind, 'allclear');
  assert.equal(rules.btb, 0);
});
test('no-clear breaks combo, not b2b', () => {
  const r = new AttackRules(); r.combo = 4; r.btb = 7; r.resolve(clear(0), c);
  assert.equal(r.combo, 0); assert.equal(r.btb, 7);
});
test('large attacks are not restricted to 4; capacity and altitude boundary', () => {
  assert.deepEqual(splitLargeAttack(7, 0), [7]); assert.deepEqual(splitLargeAttack(8, 0), [4,4]);
  assert.deepEqual(splitLargeAttack(100, 3999), [4,4,4,4]); assert.deepEqual(splitLargeAttack(100, 4000), [4,4,4,5]);
});
test('cancellation does not bank future defense, and preserves hardened packets', () => {
  const r = new Receiver(c), b = board();
  assert.equal(r.cancel(10, b, 0), 10); r.receive(7, 0); r.pending[0].hardened = true; r.receive(3, 0);
  assert.equal(r.cancel(5, b, 0), 2); assert.equal(r.size, 7); assert.equal(r.cancelled, 3);
});
test('rise cap retains normal queue remainder', () => {
  const r = new Receiver({ ...c, garbageCap: 3 }), b = board(); r.receive(7, 0);
  r.pending[0].status = 'spawn'; r.pending[0].active = true; const result = r.take(b, 0);
  assert.equal(result.rows, 3); assert.equal(r.size, 4); assert.equal(r.received, 7);
});
test('weighted holes and sources are reproducible', () => {
  const a = new Receiver(c), b = new Receiver(c), field = board();
  assert.deepEqual(Array.from({ length: 30 }, () => a.chooseColumn(field)), Array.from({ length: 30 }, () => b.chooseColumn(field)));
  const rng = new Random(1); assert.equal(rng.state, 1); assert.ok(rng.next() >= 0 && rng.next() < 1);
});
test('assist changes future supply, not queued attacks', () => {
  const source = new AttackSource(c), receiver = new Receiver(c); receiver.receive(7, 0);
  assert.deepEqual(source.next(30, { ...c, pressureAssist: true }, 18), { amount: 0, assisted: true });
  assert.equal(receiver.size, 7);
});
test('handling boundaries reject invalid data without silent coercion', () => {
  assert.equal(validateConfig({ ...c, sdf: 41 }).sdf, 41);
  for (const change of [{ sdf: Infinity }, { sdf: 4 }, { arr: .15 }, { gravity: NaN }, { continueAfter400: 'yes' }]) assert.throws(() => validateConfig({ ...c, ...change }));
  assert.throws(() => validateConfig({ ...c, bindings: { ...c.bindings, hold: 'Space' } }));
});
