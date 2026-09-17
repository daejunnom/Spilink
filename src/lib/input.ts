import type { Bindings } from './config.ts';
import type { GameKey, KeyFrame } from './port.ts';
const STEP = 1000 / 60;
export class Keyboard {
  pressed = new Map<string, GameKey>();
  queued: KeyFrame[] = [];
  private bindings: Bindings;
  private clock: () => { frame: number; origin: number; active: boolean };
  private command: (key: 'pause' | 'retry') => void;
  constructor(bindings: Bindings, clock: Keyboard['clock'], command: Keyboard['command']) { this.bindings = bindings; this.clock = clock; this.command = command; }
  private stamp(type: KeyFrame['type'], key: GameKey, timestamp: number): KeyFrame {
    const clock = this.clock();
    const elapsed = Math.max(0, Math.floor((Math.min(performance.now(), timestamp) - clock.origin) / STEP * 10));
    return { frame: clock.frame + Math.floor(elapsed / 10), type, data: { key, subframe: (elapsed % 10) / 10 } };
  }
  down = (e: KeyboardEvent): void => {
    const target = e.target;
    if (target instanceof Element && target.closest('input,select,textarea,button,[contenteditable=true]')) return;
    const entry = Object.entries(this.bindings).find(([, code]) => code === e.code);
    if (!entry || e.repeat || this.pressed.has(e.code)) return;
    const key = entry[0] as keyof Bindings;
    if (key === 'pause' || key === 'retry') { e.preventDefault(); this.command(key); return; }
    if (!this.clock().active) return;
    e.preventDefault(); this.pressed.set(e.code, key); this.queued.push(this.stamp('keydown', key, e.timeStamp));
  };
  up = (e: KeyboardEvent): void => {
    const key = this.pressed.get(e.code); if (!key) return;
    this.pressed.delete(e.code); e.preventDefault();
    this.queued.push(this.stamp('keyup', key, e.timeStamp));
  };
  release(): void {
    const { frame } = this.clock();
    this.queued = this.queued.filter(e => e.frame < frame);
    for (const key of this.pressed.values()) this.queued.push({ frame, type: 'keyup', data: { key, subframe: 0 } });
    this.pressed.clear();
  }
  pull(frame: number): KeyFrame[] {
    const ready = this.queued.filter(e => e.frame <= frame).map(e => e.frame < frame ? { ...e, frame, data: { ...e.data, subframe: 0 } } : e);
    this.queued = this.queued.filter(e => e.frame > frame);
    return ready.sort((a, b) => a.data.subframe - b.data.subframe);
  }
  attach(): () => void { window.addEventListener('keydown', this.down); window.addEventListener('keyup', this.up); return () => { window.removeEventListener('keydown', this.down); window.removeEventListener('keyup', this.up); }; }
}
