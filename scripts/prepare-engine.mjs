import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const revision = '7837ee5bde8de2719472e0de3458abe6708593f5';
const root = resolve('.cache/triangle');
await mkdir(root, { recursive: true });
try { await access(resolve(root, '.git')); } catch {
  execFileSync('git', ['init', root], { stdio: 'inherit' });
}
let head = '';
try { head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
if (head !== revision) {
  execFileSync('git', ['-C', root, 'fetch', '--depth=1', 'https://github.com/halp1/triangle.git', revision], { stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
  execFileSync('git', ['-C', root, 'checkout', '--detach', '--force', 'FETCH_HEAD'], { stdio: 'inherit', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
}
const originalPath = resolve(root, 'src/engine/index.ts');
const original = execFileSync('git', ['-C', root, 'show', 'HEAD:src/engine/index.ts']);
const hash = createHash('sha1').update(`blob ${original.length}\0`).update(original).digest('hex');
if (hash !== 'e917c8cc8330d424bdbc421b7f43c0c75571536b') throw new Error('Unexpected engine source.');
let source = original.toString('utf8');
function replaceOnce(before, after) {
  if (source.split(before).length !== 2) throw new Error('Engine integration point changed: ' + before);
  source = source.replace(before, after);
}
replaceOnce('    const pc = this.board.perfectClear;', `    const pc = this.board.perfectClear;
    if (this.spilinkHooks) return this.spilinkHooks.clear({
      lines, garbageCleared, pc, hard,
      mino: this.falling.symbol, spin: this.lastSpin || 'none'
    });`);
replaceOnce('  #run(frames: Game.Replay.Frame[]) {', `  #run(frames: Game.Replay.Frame[]) {` + '\n    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;');
replaceOnce('      const frame = frames[i];', `      if (this.spilinkHooks && !this.spilinkHooks.canTick()) break;
      const frame = frames[i];`);
replaceOnce('  #processSubframe(subframe: number) {', `  #processSubframe(subframe: number) {
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;`);
source = source.replaceAll('    this.#processSubframe(event.subframe);', '    this.#processSubframe(event.subframe);\n    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;');
replaceOnce('    if (frames.length > 0) this.#run(frames);', `    if (frames.length > 0) this.#run(frames);
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return this.#flushRes();`);
await writeFile(originalPath, source);
await mkdir('src/lib/vendor', { recursive: true });
await mkdir('static/licenses', { recursive: true });
await copyFile(resolve(root, 'LICENSE.md'), 'static/licenses/triangle.txt');
const license = await readFile(resolve(root, 'LICENSE.md'), 'utf8');
await build({
  entryPoints: [originalPath], outfile: 'src/lib/vendor/engine.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  legalComments: 'inline', sourcemap: false,
  banner: { js: `/*! Triangle.js ${revision}\n${license}\n*/` },
  plugins: [{ name: 'console-colors', setup(b) {
    b.onResolve({ filter: /^chalk$/ }, () => ({ path: 'chalk', namespace: 'console-colors' }));
    b.onLoad({ filter: /.*/, namespace: 'console-colors' }, () => ({ contents: `const identity = value => value;
const chalk = new Proxy(identity, { get: (_, key) => key === 'bgHex' || key === 'hex' ? () => identity : identity });
export default chalk;`, loader: 'js' }));
  } }]
});
console.log('Prepared pinned browser engine:', revision);
