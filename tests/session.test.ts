import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/lib/session.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import type { KeyFrame } from '../src/lib/port.ts';
function key(s: Session, type: 'keydown' | 'keyup', action: 'hardDrop' | 'softDrop', subframe = 0): KeyFrame { return { frame: s.frame, type, data: { key: action, subframe } }; }
const config = { ...structuredClone(DEFAULT_CONFIG), gravity: 0, incomingApm: 0, safelock: false };
test('engine integrates one hard drop and a restartable deterministic queue', () => {
  const a = new Session(config), b = new Session(config); a.start(); b.start();
  a.tick([key(a, 'keydown', 'hardDrop')]); b.tick([key(b, 'keydown', 'hardDrop')]);
  assert.equal(a.measure.pieces, 1); assert.deepEqual(a.engine.board.state, b.engine.board.state);
});
test('instant soft drop at zero gravity does not immediately hard lock', () => {
  const s = new Session({ ...config, sdf: 41 }); s.start(); s.tick([key(s, 'keydown', 'softDrop')]);
  assert.equal(s.measure.pieces, 0); assert.ok(s.engine.falling.y < 5);
});
test('a second hard drop in the finishing frame cannot place 401', () => {
  const s = new Session(config); s.measure.pieces = 399; s.measure.first400Attack = 4; s.measure.attack = 4; s.start();
  s.tick([key(s, 'keydown', 'hardDrop', 0), key(s, 'keyup', 'hardDrop', .2), key(s, 'keydown', 'hardDrop', .4)]);
  assert.equal(s.measure.pieces, 400); assert.equal(s.status, 'completed'); assert.equal(s.measure.checkpoint?.attack, 4);
});
test('continuation can place 401, checkpoint unchanged', () => {
  const s = new Session({ ...config, continueAfter400: true }); s.measure.pieces = 399; s.start();
  s.tick([key(s, 'keydown', 'hardDrop')]); const result = structuredClone(s.measure.checkpoint);
  s.tick([key(s, 'keyup', 'hardDrop')]); s.tick([key(s, 'keydown', 'hardDrop')]);
  assert.equal(s.measure.pieces, 401); assert.deepEqual(s.measure.checkpoint, result);
});
test('pause freezes every frame and incoming schedule', () => {
  const s = new Session(DEFAULT_CONFIG); s.start(); for (let i = 0; i < 40; i++) s.tick(); s.pause();
  const frame = s.frame, amount = s.receiver.size + s.receiver.reserved;
  for (let i = 0; i < 300; i++) s.tick();
  assert.equal(s.frame, frame); assert.equal(s.receiver.size + s.receiver.reserved, amount);
});
test('recorded input and incoming events replay to the same result', () => {
  const s = new Session({ ...config, incomingApm: 45 }); s.start();
  for (let i = 0; i < 360 && s.status === 'running'; i++) s.tick(i % 60 === 30 ? [key(s, 'keydown', 'hardDrop')] : i % 60 === 31 ? [key(s, 'keyup', 'hardDrop')] : []);
  const replay = new Session(s.config, s.replaySource()); replay.start();
  for (let i = 0; i < s.frame + 1 && replay.status === 'running'; i++) replay.tick();
  assert.deepEqual(replay.engine.board.state, s.engine.board.state);
  assert.equal(replay.measure.pieces, s.measure.pieces); assert.equal(replay.measure.attack, s.measure.attack);
  assert.equal(replay.receiver.size, s.receiver.size);
  assert.equal(s.exportReplay().spilink.officialPlayback, false);
});
