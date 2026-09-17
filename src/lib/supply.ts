import type { Config } from './config.ts';
import type { Mino } from './port.ts';
import { Random } from './rules.ts';
const PIECES: Mino[] = ['z','l','o','s','i','j','t'];
export class Supply {
  random: Random; values: Mino[] = []; seenI5 = false;
  constructor(seed: number, initial = '') { this.random = new Random(seed); this.values = (initial.match(/i5|[ijlostz]/gi) ?? []).map(p => p.toLowerCase() as Mino); }
  private shuffle<T>(values: T[]): T[] { for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(this.random.next() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; } return values; }
  pull(config: Config, cancelStreak: number): Mino {
    while (this.values.length < (config.bagType === 'zenith' ? 6 : 14)) {
      const bag = this.shuffle([...PIECES]);
      if (config.bagType === 'zenith') {
        const extra: Mino[] = [];
        const pair = (a: Mino, b: Mino) => this.random.next() < 0.5 ? a : b;
        if (cancelStreak >= 20) extra.push('o');
        if (cancelStreak >= 30) extra.push(pair('l','j'));
        if (cancelStreak >= 40) extra.push(pair('s','z'));
        if (cancelStreak >= 50) extra.push(pair('l','j'),pair('t','i'));
        if (cancelStreak >= 60) extra.push(pair('s','z'));
        if (extra.length) bag.push(...this.shuffle(extra));
        if (cancelStreak >= 40 && !this.seenI5) { this.seenI5 = true; bag.unshift('i5'); }
      }
      this.values.push(...bag);
    }
    return this.values.shift()!;
  }
  snapshot() { return { state: this.random.state, values: [...this.values], seenI5: this.seenI5 }; }
  restore(s: ReturnType<Supply['snapshot']>) { this.random.state = s.state; this.values = [...s.values]; this.seenI5 = s.seenI5; }
}
