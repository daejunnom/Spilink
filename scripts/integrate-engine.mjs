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
// Keep collision checks in the unrounded coordinate space until bounds are checked.
replace('    if (y >= boardHeight) return false;\n    if (board[y][x]) return false;', '    if (y > boardHeight - 1) return false;\n    if (board[Math.floor(y)][x]) return false;');
replace('    const baseY = floorPieceY - ao[1];', '    const baseY = pieceLocation[1] - ao[1];');
replace('testBlocks[j] = [movedBaseX + block[0], floorNewY - block[1]];', 'testBlocks[j] = [movedBaseX + block[0], newY - block[1]];');
replace('Math.floor(options.boardWidth / 2 - tetromino.matrix.w / 2)', 'Math.ceil(options.boardWidth / 2) - 1 - tetromino.matrix.dx');
replace('options.boardHeight + 2.04', 'options.boardHeight + 1.04 + tetromino.matrix.dy');
replace('this.highestY = options.boardHeight + 2;', 'this.highestY = options.boardHeight + 1 + tetromino.matrix.dy;');
output += '\nexport { legal as rotationPositionIsLegal, performKick as attemptRotation, kicks as rotationTables, tetrominoes as pieceDefinitions };\n';
writeFileSync(new URL('../src/lib/vendor/integrated.js', import.meta.url), output);
writeFileSync(new URL('../src/lib/vendor/integrated.d.ts', import.meta.url), `export const Engine: new (options: unknown) => import('../port.ts').EnginePort;
export const rotationPositionIsLegal: (blocks: number[][], board: unknown[][]) => boolean;
export const rotationTables: Record<string, Record<string, Record<string, number[][]>>>;
export const pieceDefinitions: Record<string, {matrix: {dx: number; dy: number; data: number[][][]}}>;
export const attemptRotation: (table: string, piece: string, location: number[], offset: number[], limited: boolean, blocks: number[][], from: number, to: number, board: unknown[][]) => boolean | {newLocation: number[]; kick: number[]; id: string; index: number};
`);
