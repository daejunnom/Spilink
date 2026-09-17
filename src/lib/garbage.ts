import type { Config } from './config.ts';
import type { Tile } from './port.ts';
import { Random, splitLargeAttack } from './rules.ts';
export type Packet = { id: number; source: number; amount: number; status: 'sleeping' | 'caution' | 'danger' | 'spawn'; first: boolean; delay: number; active: boolean; hardened: boolean };
type Timer = { at: number; kind: 'enter' | 'hit' | 'phase'; packet: Packet };
export const FLOOR_ALTITUDES = [0, 0, 50, 150, 300, 450, 650, 850, 1100, 1350, 1650];
export class Receiver {
  pending: Packet[] = [];
  timers: Timer[] = [];
  received = 0; risen = 0; cancelled = 0; nextId = 0; windupUntil = 0;
  lastColumn: number | null = null; changedColumn = false;
  random: Random; config: Config;
  constructor(config: Config) { this.config = config; this.random = new Random((config.seed + 17) % 2147483646 + 1); }
  get size(): number { return this.pending.reduce((n, p) => n + p.amount, 0); }
  get reserved(): number { return this.timers.filter(t => t.kind === 'enter').reduce((n, t) => n + t.packet.amount, 0); }
  receive(raw: number, frame: number, source = 1): void {
    if (!Number.isInteger(raw) || raw < 0 || raw > 10000) throw new Error('Invalid incoming attack.');
    const amount = Math.floor(raw * this.config.receiveMultiplier);
    if (!amount) return;
    const delay = 66 - 6 * this.config.floor;
    const status = this.pending.length ? 'sleeping' : 'caution';
    const portions = splitLargeAttack(amount, FLOOR_ALTITUDES[this.config.floor]);
    if (amount >= 8) {
      const start = Math.max(frame, this.windupUntil);
      this.windupUntil = start + 120 + 30 * portions.length;
      portions.forEach((n, i) => this.timers.push({ at: start + 60 + 30 * i, kind: 'enter', packet: { id: ++this.nextId, source, amount: n, status, first: false, delay, active: true, hardened: false } }));
    } else this.enter({ id: ++this.nextId, source, amount, status, first: false, delay, active: true, hardened: false }, frame);
  }
  private enter(packet: Packet, frame: number): void {
    this.pending.push(packet); this.received += packet.amount;
    this.timers.push({ at: frame + 20, kind: 'hit', packet });
  }
  private progress(packet: Packet, frame: number): void {
    if (!this.pending.includes(packet)) return;
    if (packet.status === 'sleeping') {
      if (this.pending[0] !== packet) return;
      packet.status = packet.delay > 0 ? 'caution' : 'spawn';
      if (packet.delay > 0) this.timers.push({ at: frame + packet.delay, kind: 'phase', packet });
    } else if (packet.status === 'caution') {
      if (packet.first) packet.status = 'danger';
      this.timers.push({ at: frame + packet.delay, kind: 'phase', packet });
    } else if (packet.status === 'danger') packet.status = 'spawn';
    packet.first = true;
  }
  advance(frame: number): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.at > frame) continue;
      this.timers.splice(i, 1);
      if (t.kind === 'enter') this.enter(t.packet, frame);
      else if (this.pending.includes(t.packet)) this.progress(t.packet, frame);
    }
  }
  cancel(attack: number, board: Tile[][], frame: number): number {
    let outgoing = attack;
    let defense = Math.floor(attack * this.config.cancelMultiplier - attack);
    for (let i = 0; i < this.pending.length && outgoing + defense > 0;) {
      const p = this.pending[i];
      if (p.hardened) { i++; continue; }
      const n = Math.min(p.amount, outgoing + defense);
      const usedAttack = Math.min(outgoing, n);
      outgoing -= usedAttack; defense -= n - usedAttack; p.amount -= n; this.cancelled += n;
      if (p.amount === 0) {
        this.pending.splice(i, 1);
        if (this.pending[0]) this.progress(this.pending[0], frame);
        if (this.random.next() < 2.5 * (0.05 * this.config.floor + 0.25)) {
          this.chooseColumn(board); this.changedColumn = true;
        }
      } else i++;
    }
    return outgoing;
  }
  chooseColumn(board: Tile[][]): number {
    let bottomHole = -1;
    for (let y = 0; y < board.length; y++) {
      const hole = board[y].findIndex(v => v === null);
      if (hole !== -1) {
        if (board[y].some(v => v?.mino === 'gb')) bottomHole = hole;
        break;
      }
    }
    const ranking = Array.from({ length: 10 }, (_, x) => {
      let height = 0;
      for (let y = board.length - 1; y >= 0; y--) if (board[y][x]) { height = y + 1; break; }
      return { x, score: height ? height + (bottomHole < 0 ? 0 : 5 * Math.abs(x - bottomHole)) + 0.1 * this.random.next() : 0.1 * this.random.next(), weight: 0 };
    }).sort((a, b) => a.score - b.score);
    const favor = -3 * this.config.floor - 25;
    let sum = 0;
    ranking.forEach((r, i) => { sum += Math.max(0, 10 + favor + i * ((20 - 2 * (10 + favor)) / 9)); r.weight = sum; });
    const roll = this.random.next() * sum;
    this.lastColumn = (ranking.find(r => r.weight !== 0 && roll <= r.weight) ?? ranking[0]).x;
    return this.lastColumn;
  }
  take(board: Tile[][], frame: number): { rows: number; overflow: boolean } {
    const deferred = this.pending.filter(p => !(p.active && p.status === 'spawn'));
    this.pending = this.pending.filter(p => p.active && p.status === 'spawn');
    let rows = 0, overflow = false, completed = false;
    while (rows < this.config.garbageCap && this.pending.length) {
      const packet = this.pending[0]; packet.amount--;
      if (this.lastColumn === null || this.random.next() < 0.05 * this.config.floor + 0.25) {
        if (!this.changedColumn) { this.chooseColumn(board); this.changedColumn = true; }
      }
      const top = board.pop();
      overflow ||= Boolean(top?.some(Boolean));
      board.unshift(Array.from({ length: 10 }, (_, x) => x === this.lastColumn ? null : { mino: 'gb' }));
      rows++; this.changedColumn = false;
      if (!packet.amount) {
        this.pending.shift(); completed = true;
        if (this.random.next() < 2.5 * (0.05 * this.config.floor + 0.25)) { this.chooseColumn(board); this.changedColumn = true; }
      }
    }
    this.pending.push(...deferred);
    if (completed && this.pending[0]) this.progress(this.pending[0], frame);
    this.risen += rows;
    return { rows, overflow };
  }
}
export class AttackSource {
  random: Random; nextFrame: number; burst = 0;
  constructor(config: Config) { this.random = new Random((config.seed + 97) % 2147483646 + 1); this.nextFrame = config.firstAttackFrames; }
  next(frame: number, config: Config, pressure: number): { amount: number; assisted: boolean } | null {
    if (!config.incomingApm || frame < this.nextFrame) return null;
    if (config.pressureAssist && pressure >= 16) { this.nextFrame = frame + 120; return { amount: 0, assisted: true }; }
    const big = this.burst > 0 || this.random.next() < 0.25;
    const amount = Math.min(config.maxAttack, big ? 8 + Math.floor(this.random.next() * Math.max(1, config.maxAttack - 7)) : 1 + Math.floor(this.random.next() * 7));
    if (this.burst > 0) this.burst--;
    else if (big) this.burst = Math.floor(this.random.next() * 3);
    const interval = this.burst ? 45 + this.random.next() * 75 : amount * 3600 / config.incomingApm * (0.5 + this.random.next());
    this.nextFrame = frame + Math.max(6, Math.round(interval));
    return { amount, assisted: false };
  }
}
