import { Engine } from './vendor/engine.js';
import { validateConfig, type Config } from './config.ts';
import type { ClearEvent, EnginePort, KeyFrame } from './port.ts';
import { AttackRules, Measurement, Random } from './rules.ts';
import { AttackSource, Receiver } from './garbage.ts';
export type Status = 'ready' | 'running' | 'paused' | 'completed' | 'topout' | 'stopped';
export type IncomingEvent = { frame: number; amount: number; source: number; assisted: boolean };
export type ReplaySource = { keys: KeyFrame[]; attacks: IncomingEvent[]; endFrame: number; ticks: number };
export class Session {
  engine: EnginePort; config: Config; status: Status = 'ready';
  ticks = 0;
  rules = new AttackRules(); measure = new Measurement(); receiver: Receiver; source: AttackSource;
  events: KeyFrame[] = []; incoming: IncomingEvent[] = [];
  inputs = 0; holds = 0; lines = 0; clearedGarbage = 0; sent = 0; spins = 0; allClears = 0;
  lastAction = 'READY'; lastAttack = 0; assistActive = false;
  playback: ReplaySource | null; private keyCursor = 0; private attackCursor = 0;
  constructor(input: Config, playback: ReplaySource | null = null) {
    this.config = validateConfig(input); this.playback = playback;
    const c = this.config;
    const constant = (value: number) => ({ value, increase: 0, marginTime: 0 });
    this.receiver = new Receiver(c); this.source = new AttackSource(c);
    this.engine = new Engine({
      queue: { type: '7-bag', minLength: 14, seed: c.seed },
      board: { width: 10, height: 20, buffer: 20 }, kickTable: 'SRS+',
      options: { spinBonuses: 'all-mini+', comboTable: 'multiplier', garbageTargetBonus: 'none', clutch: true, garbageBlocking: 'combo blocking', stock: 0 },
      gravity: { value: c.gravity, increase: c.gravityIncrease ? c.gravityRate : 0, marginTime: 0 },
      garbage: {
        cap: { ...constant(c.garbageCap), absolute: 0, max: 40 },
        messiness: { change: 1, within: 0.3, nosame: false, timeout: 0, center: false },
        garbage: { speed: 20, holeSize: 1 }, multiplier: constant(c.attackMultiplier),
        bombs: false, seed: c.seed, boardWidth: 10, rounding: 'down', openerPhase: 0, specialBonus: c.specialBonus
      },
      handling: { arr: c.arr, das: c.das, dcd: c.dcd, sdf: c.sdf, safelock: c.safelock, cancel: c.cancel, may20g: c.may20g, irs: c.irs, ihs: c.ihs },
      pc: { garbage: 10, b2b: 0 }, b2b: { chaining: false, charging: { at: c.chargeAt, base: c.chargeBase } },
      misc: { movement: { infinite: false, lockResets: 15, lockTime: c.lockTime, may20G: true }, allowed: { spin180: true, hardDrop: true, hold: true, undo: false, retry: false }, infiniteHold: false, stride: false, date: new Date('2026-09-12T00:45:01Z') }
    });
    const random = new Random((c.seed + 271) % 2147483646 + 1);
    for (let y = 0; y < c.initialGarbage; y++) {
      const hole = Math.floor(random.next() * 10);
      this.engine.board.state[y] = Array.from({ length: 10 }, (_, x) => x === hole ? null : { mino: 'gb' });
    }
    this.engine.spilinkHooks = { canTick: () => this.status === 'running', clear: e => this.finishClear(e) };
  }
  get frame(): number { return this.engine.frame; }
  get height(): number {
    for (let y = this.engine.board.state.length - 1; y >= 0; y--) if (this.engine.board.state[y].some(Boolean)) return y + 1;
    return 0;
  }
  start(): void { if (this.status === 'ready' || this.status === 'paused') this.status = this.engine.toppedOut ? 'topout' : 'running'; }
  pause(): void { if (this.status === 'running') this.status = 'paused'; }
  stop(): void { if (['ready', 'running', 'paused'].includes(this.status)) this.status = 'stopped'; }
  tick(input: KeyFrame[] = []): void {
    if (this.status !== 'running') return;
    if (this.playback && this.ticks >= this.playback.ticks) { this.stop(); return; }
    const frame = this.frame;
    if (frame > 216000 || this.events.length > 500000 || this.incoming.length > 100000) { this.stop(); return; }
    let keys = input;
    if (this.playback) {
      keys = [];
      while (this.keyCursor < this.playback.keys.length && this.playback.keys[this.keyCursor].frame === frame) keys.push(this.playback.keys[this.keyCursor++]);
      while (this.attackCursor < this.playback.attacks.length && this.playback.attacks[this.attackCursor].frame === frame) {
        const event = this.playback.attacks[this.attackCursor++];
        this.incoming.push(structuredClone(event)); this.assistActive = event.assisted;
        if (event.amount) this.receiver.receive(event.amount, frame, event.source);
      }
    } else {
      const next = this.source.next(frame, this.config, Math.max(this.height, this.receiver.size + this.receiver.reserved));
      if (next) {
        this.assistActive = next.assisted;
        this.incoming.push({ frame, amount: next.amount, source: 1, assisted: next.assisted });
        if (next.amount) this.receiver.receive(next.amount, frame, 1);
      }
    }
    for (const event of keys) {
      if (event.frame !== frame || !Number.isFinite(event.data.subframe) || event.data.subframe < 0 || event.data.subframe >= 1) throw new Error('Invalid input time.');
      this.events.push(structuredClone(event));
      if (event.type === 'keydown') { this.inputs++; if (event.data.key === 'hold' && !this.engine.holdLocked) this.holds++; }
    }
    this.engine.tick(keys);
    this.ticks++;
    if (this.status === 'running') this.receiver.advance(this.frame);
    if (this.playback && this.ticks >= this.playback.ticks && this.status === 'running') this.stop();
  }
  private finishClear(e: ClearEvent): unknown {
    const frame = this.frame + this.engine.subframe;
    const attacks = this.rules.resolve(e, this.config);
    let total = 0, sent = 0;
    for (const attack of attacks) { total += attack.amount; sent += this.receiver.cancel(attack.amount, this.engine.board.state, this.frame); }
    this.sent += sent; this.lines += e.lines; this.clearedGarbage += e.garbageCleared;
    if (e.spin !== 'none') this.spins++;
    if (e.pc) this.allClears++;
    this.lastAttack = total;
    this.lastAction = attacks.some(a => a.kind === 'surge') ? 'B2B SURGE' : e.pc ? 'ALL CLEAR' : e.spin !== 'none' ? `${e.mino.toUpperCase()} ${e.spin === 'mini' ? 'MINI ' : ''}SPIN` : ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][e.lines] || 'PLACED';
    const rise = e.lines === 0 && total === 0 ? this.receiver.take(this.engine.board.state, this.frame) : { rows: 0, overflow: false };
    const completed = this.measure.record(total, frame, this.config.continueAfter400);
    Object.assign(this.engine.stats, { combo: this.rules.combo - 1, b2b: this.rules.btb - 1, pieces: this.measure.pieces, lines: this.lines });
    Object.assign(this.engine.stats.garbage, { attack: this.measure.attack, sent: this.sent, receive: this.receiver.received, cleared: this.clearedGarbage });
    this.engine.lastWasClear = e.lines > 0;
    this.engine.resCache.lastLock = frame;
    this.engine.resCache.pieces++;
    this.engine.resCache.garbage.sent.push(sent);
    if (rise.overflow) this.status = 'topout';
    else if (completed) this.status = 'completed';
    else { this.engine.nextPiece(); if (this.engine.toppedOut) this.status = 'topout'; }
    this.engine.lastSpin = null;
    return { mino: e.mino, lines: e.lines, spin: e.spin, garbageCleared: e.garbageCleared, garbage: sent ? [sent] : [], rawGarbage: attacks.map(a => a.amount), surge: attacks.filter(a => a.kind === 'surge').reduce((n, a) => n + a.amount, 0), stats: this.engine.stats, garbageAdded: false, topout: this.status === 'topout', keysPresses: [], pieceTime: 0 };
  }
  ghost(): [number, number][] {
    const blocks = this.engine.falling.absoluteBlocks.map(([x, y]) => [x, y] as [number, number]);
    let drop = 0;
    while (drop < 40 && blocks.every(([x, y]) => y - drop - 1 >= 0 && this.engine.board.state[y - drop - 1]?.[x] === null)) drop++;
    return blocks.map(([x, y]) => [x, y - drop]);
  }
  summary() {
    const seconds = this.frame / 60;
    return { pieces: this.measure.pieces, attack: this.measure.attack, first400Attack: this.measure.first400Attack,
      checkpoint: this.measure.checkpoint, sent: this.sent, received: this.receiver.received, risen: this.receiver.risen,
      cancelled: this.receiver.cancelled, lines: this.lines, spins: this.spins, allClears: this.allClears, inputs: this.inputs, holds: this.holds,
      combo: Math.max(0, this.rules.combo - 1), btb: Math.max(0, this.rules.btb - 1), maxCombo: Math.max(0, this.rules.topCombo - 1), maxBtb: Math.max(0, this.rules.topBtb - 1),
      app: this.measure.attack / (this.measure.pieces || 1), apm: this.measure.attack / (this.frame / 3600 || 1), pps: this.measure.pieces / (seconds || 1), time: seconds };
  }
  exportReplay() {
    const c = this.config, s = this.summary();
    return { version: 1, id: null, gamemode: 'zenith', ts: new Date().toISOString(), users: [{ id: null, username: 'SPILINK', avatar_revision: 0, banner_revision: 0, flags: 0, country: null }],
      replay: { frames: this.frame, events: [{ frame: 0, type: 'start', data: {} }, ...this.events, { frame: this.frame, type: 'end', data: { reason: null } }],
        options: { version: 19, seed: c.seed, seed_random: false, boardwidth: 10, boardheight: 20, bagtype: '7-bag', kickset: 'SRS+', spinbonuses: 'all-mini+', combotable: 'multiplier', hasgarbage: true, garbageblocking: 'combo blocking', g: c.gravity, gincrease: c.gravityIncrease ? c.gravityRate : 0, b2bcharging: true, b2bcharge_at: c.chargeAt, b2bcharge_base: c.chargeBase, garbagespecialbonus: c.specialBonus, handling: { arr: c.arr, das: c.das, dcd: c.dcd, sdf: c.sdf, safelock: c.safelock, cancel: c.cancel, may20g: c.may20g, irs: c.irs, ihs: c.ihs } },
        results: { stats: { piecesplaced: s.pieces, lines: s.lines, inputs: s.inputs, holds: s.holds, garbage: { attack: s.attack, sent: s.sent, received: s.received, cleared: this.clearedGarbage } }, aggregatestats: { apm: s.apm, pps: s.pps } } },
      spilink: { version: 1, profile: 'preview-1', ticks: this.ticks, settings: structuredClone(c), attacks: structuredClone(this.incoming), first400: structuredClone(this.measure.checkpoint), status: this.status, summary: s, officialPlayback: false } };
  }
  replaySource(): ReplaySource { return { keys: structuredClone(this.events), attacks: structuredClone(this.incoming), endFrame: this.frame, ticks: this.ticks }; }
}
