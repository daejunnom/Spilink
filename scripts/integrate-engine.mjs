import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const input = readFileSync(new URL('../src/lib/vendor/engine.js', import.meta.url), 'utf8');
const expected = 'd8a57eb4d50c3f48aaf6dcbb6dda3bbd22b08346cd19cf0ae53b9f34411ff2f2';
if (createHash('sha256').update(input).digest('hex') !== expected) throw new Error('Vendored engine changed; review integration hooks before rebuilding.');
let output = input;
function replace(before, after, count = 1) {
  if (output.split(before).length - 1 !== count) throw new Error('Engine integration contract changed.');
  output = output.replaceAll(before, after);
}
replace('  nextPiece(ignoreBlockout = false, isHold = false) {', `  nextPiece(ignoreBlockout = false, isHold = false) {
    if (this.spilinkHooks?.next) {
      this.initiatePiece(this.spilinkHooks.next(), ignoreBlockout, isHold);
      return;
    }`);
replace('  #keydown({ data: event }) {', '  #keydown(frameEvent) {\n    const event = frameEvent.data;');
replace('  #keyup({ data: event }) {', '  #keyup(frameEvent) {\n    const event = frameEvent.data;');
replace('    this.#processSubframe(event.subframe);\n    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;', '    this.#processSubframe(event.subframe);\n    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;\n    this.spilinkHooks?.input?.(frameEvent);', 2);
replace('block === null || block.mino === "bomb" /* BOMB */', 'block === null || block.mino === "gbd" || block.mino === "bomb" /* BOMB */');
replace('  hardDrop() {\n    while', '  hardDrop() {\n    if (this.spilinkHooks && this.#isSleep()) return;\n    while');
replace('    this.holdLocked = !this.misc.infiniteHold;\n    return true;', '    this.holdLocked = !this.misc.infiniteHold;\n    this.spilinkHooks?.held?.();\n    return true;');
replace('  #clearFlags(e) {\n    this.state &= ~e;', '  #clearFlags(e) {\n    if ((e & constants.flags.ROTATION_ALL) && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;\n    this.state &= ~e;');
replace('this.dynamic.gravity.get() * this.handling.sdf > this.board.height', 'this.#getEffectiveGravity() * this.handling.sdf >= this.board.height');
replace('    while (this.#__internal_fall(1)) ;', '    while (this.#__internal_fall(1)) this.spilinkHooks?.score?.(2);');
replace('  #slamToFloor() {\n    while (this.#__internal_fall(1)) {', '  #slamToFloor() {\n    while (this.#__internal_fall(1)) {\n      if (this.input.keys.softDrop) this.spilinkHooks?.score?.(1);');
replace('      if (Math.floor(y) !== Math.floor(this.falling.location[1])) {', '      if (Math.floor(y) !== Math.floor(this.falling.location[1])) {\n        if (this.input.keys.softDrop) this.spilinkHooks?.score?.(1);');
writeFileSync(new URL('../src/lib/vendor/integrated.js', import.meta.url), output);
writeFileSync(new URL('../src/lib/vendor/integrated.d.ts', import.meta.url), "export const Engine: new (options: unknown) => import('../port.ts').EnginePort;\n");
