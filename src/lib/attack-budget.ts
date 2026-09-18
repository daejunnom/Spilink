/** A rolling window of actual raw attacks; never reset on a minute boundary. */
export const ATTACK_WINDOW_FRAMES = 3600;
export type BudgetEntry = { frame: number; amount: number };
export class RollingAttackBudget {
  private entries: BudgetEntry[] = [];
  private total = 0;
  advance(frame: number): void {
    let count = 0;
    while (count < this.entries.length && this.entries[count].frame <= frame - ATTACK_WINDOW_FRAMES) {
      this.total -= this.entries[count++].amount;
    }
    if (count) this.entries.splice(0, count);
  }
  get spent(): number { return this.total; }
  available(rate: number): number { return Math.max(0, Math.ceil(rate) - this.total); }
  nextRelease(): number | null { return this.entries.length ? this.entries[0].frame + ATTACK_WINDOW_FRAMES : null; }
  spend(frame: number, amount: number, rate: number): void {
    if (!Number.isSafeInteger(frame) || !Number.isSafeInteger(amount) || amount <= 0 || amount > this.available(rate)) throw new Error('Invalid rolling attack spend.');
    this.entries.push({ frame, amount }); this.total += amount;
  }
  snapshot(): BudgetEntry[] { return this.entries.map(e => ({ ...e })); }
  restore(entries: readonly BudgetEntry[]): void {
    this.entries = entries.map(e => ({ ...e })); this.total = this.entries.reduce((sum, e) => sum + e.amount, 0);
  }
}
