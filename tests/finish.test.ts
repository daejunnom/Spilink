import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/lib/session.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';

test('400th real placement includes surge, regular and all-clear before stopping', () => {
  const s = new Session({ ...DEFAULT_CONFIG, gravity: 0, incomingApm: 0, safelock: false });
  assert.equal(s.engine.falling.symbol, 'o');
  s.measure.pieces = 399; s.measure.attack = 4; s.measure.first400Attack = 4;
  s.rules.combo = 8; s.rules.btb = 10;
  const columns = new Set(s.engine.falling.absoluteBlocks.map(([x]) => x));
  for (let y = 0; y < 2; y++) s.engine.board.state[y] = Array.from({ length: 10 }, (_, x) => columns.has(x) ? null : { mino: 'gb' });
  s.start(); s.tick([{ frame: 0, type: 'keydown', data: { key: 'hardDrop', subframe: 0 } }]);
  assert.equal(s.status, 'completed'); assert.equal(s.measure.pieces, 400);
  assert.equal(s.lastAttack, 19); assert.equal(s.measure.checkpoint?.attack, 23);
  assert.equal(s.allClears, 1); assert.equal(s.sent, 19);
  s.tick([{ frame: s.frame, type: 'keydown', data: { key: 'hardDrop', subframe: 0 } }]);
  assert.equal(s.measure.pieces, 400);
});

test('terminal tick is retained independently of the engine frame counter', () => {
  const s = new Session({ ...DEFAULT_CONFIG, gravity: 0, incomingApm: 0, safelock: false });
  s.start();
  for (let i = 0; i < 40 && s.status === 'running'; i++) {
    s.tick([{ frame: s.frame, type: 'keydown', data: { key: 'hardDrop', subframe: 0 } }]);
  }
  assert.equal(s.status, 'topout');
  const recorded = s.replaySource(); const replay = new Session(s.config, recorded); replay.start();
  for (let i = 0; i <= recorded.ticks && replay.status === 'running'; i++) replay.tick();
  assert.equal(replay.status, s.status); assert.equal(replay.ticks, s.ticks);
  assert.deepEqual(replay.engine.board.state, s.engine.board.state);
  assert.deepEqual(replay.summary(), s.summary());
});
