import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, validateConfig } from '../src/lib/config.ts';
import { Session } from '../src/lib/session.ts';
import { Supply } from '../src/lib/supply.ts';
import { Environment, floorAt } from '../src/lib/environment.ts';
import { Receiver } from '../src/lib/garbage.ts';
import { inspectJson, preflightTtrx } from '../src/lib/replay.ts';
import { encode_ttr, encode_ttrm, decode_ttrx, ttrx_source_extension } from 'tetr-ttrx';
import type { KeyFrame, ClearEvent, Tile, GameKey } from '../src/lib/port.ts';
const cfg = (v = {}) => validateConfig({ ...structuredClone(DEFAULT_CONFIG), gravity: 0, incomingApm: 0, safelock: false, ...v });
const key = (s: Session, action: GameKey, type: 'keydown'|'keyup' = 'keydown', subframe = 0):KeyFrame => ({ frame: s.frame, type, data: {key: action, subframe} });
const board = ():Tile[][] => Array.from({length:40},()=>Array(10).fill(null));
const bytes = (v:unknown) => new TextEncoder().encode(JSON.stringify(v));
const clear = (v:Partial<ClearEvent> = {}):ClearEvent => ({lines:0,garbageCleared:0,pc:false,hard:true,mino:'t',spin:'none',...v});
function replay(s:Session):Session { const r=new Session(s.initialConfig,s.replaySource());r.start();for(let i=0;i<s.ticks+2&&r.status==='running';i++)r.tick();return r; }

test('old settings hydrate new fields without changing previous values',()=>{
  const c=validateConfig({arr:0,das:7.1,dcd:1.2,sdf:41,gravity:20,continueAfter400:true,bindings:{hold:'KeyV'}});
  assert.equal(c.arr,0);assert.equal(c.das,7.1);assert.equal(c.gravity,20);assert.equal(c.bindings.hold,'KeyV');assert.equal(c.bindings.undo,'Control+KeyZ');
});
test('initial board, initial queue and original map ordering agree',()=>{
  const s=new Session(cfg({initialBoard:'..........\nGGGG.GGGGG',initialQueue:'T,I5,O',bagType:'zenith'}));
  assert.equal(s.engine.board.state[0][4],null);assert.equal(s.engine.board.state[0][3]?.mino,'gb');assert.equal(s.engine.falling.symbol,'t');
  assert.equal(s.exportReplay().replay.options.map.slice(390),'####_#####?t,i5,o');
});
test('special supply is seeded, restorable, and emits one initial I5',()=>{
  const c=cfg({bagType:'zenith'}),s=new Supply(1);assert.equal(s.pull(c,40),'i5');const snap=s.snapshot();
  const a=Array.from({length:80},()=>s.pull(c,60));assert.equal(a.filter(x=>x==='i5').length,0);s.restore(snap);
  assert.deepEqual(Array.from({length:80},()=>s.pull(c,60)),a);
});
test('I5 is a playable five-cell piece, not silently substituted',()=>{
  const s=new Session(cfg({bagType:'zenith',initialQueue:'I5'}));assert.equal(s.engine.falling.absoluteBlocks.length,5);s.start();s.tick([key(s,'hardDrop')]);
  assert.equal(s.measure.pieces,1);assert.equal(s.engine.board.state.flat().filter(c=>c?.mino==='i5').length,5);
});
test('increasing settings freeze and restart at their current values',()=>{
  const c=cfg({gravity:1,gravityIncrease:true,gravityRate:6,attackIncrease:true,attackRate:6,receiveIncrease:true,receiveRate:6,lockDecrease:true,lockRate:6}),e=new Environment(c);
  for(let n=1;n<=60;n++)e.tick(n,c);assert.ok(Math.abs(e.gravity-7)<1e-8);
  const off=cfg({...c,gravityIncrease:false,attackIncrease:false,receiveIncrease:false,lockDecrease:false});e.change(c,off);const frozen=e.snapshot();
  for(let n=61;n<=600;n++)e.tick(n,off);assert.deepEqual(e.snapshot(),frozen);e.change(off,c);e.tick(601,c);assert.ok(Math.abs(e.gravity-7.1)<1e-8);
});
test('manual garbage overrides survive floor progression',()=>{
  const c=cfg({altitude:49,progression:true,messinessInner:.12,garbagePhase:17,garbageFavor:-8}),e=new Environment(c);e.altitude=51;
  assert.equal(e.effective(c).floor,2);assert.equal(e.effective(c).messinessInner,.12);assert.equal(e.effective(c).garbagePhase,17);assert.equal(floorAt(1650),10);
});
test('fatigue is opt-in, freezes while off and uses its own active clock',()=>{
  const c=cfg({fatigue:true}),e=new Environment(c);e.fatigueFrame=28799;assert.equal(e.tick(10,c),1);assert.equal(e.permanentRows,1);
  e.tick(11,cfg());assert.equal(e.fatigueFrame,28800);e.fatigueFrame=32399;e.tick(12,c);assert.equal(e.receiveBonus,.25);
});
test('delayed arrival cannot rise before flight and both phase delays finish',()=>{
  const r=new Receiver(cfg({garbageSpeed:2,garbagePhase:3,targetingGrace:false}));r.receive(3,0);assert.equal(r.take(board(),0).rows,0);
  r.advance(2);assert.equal(r.pending[0].active,true);assert.equal(r.pending[0].status,'caution');r.advance(5);assert.equal(r.pending[0].status,'danger');r.advance(8);assert.equal(r.pending[0].status,'spawn');
  assert.equal(r.take(board(),8).rows,3);
});
test('cancel correction respects its bonus ceiling without clipping raw large attacks',()=>{
  const r=new Receiver(cfg({targetingGrace:false,garbageSpeed:0,garbagePhase:0}));r.cancelStreak=100;r.receive(1,10);assert.equal(r.size,4);
  const b=new Receiver(cfg({targetingGrace:false}));b.cancelStreak=100;b.receive(20,10);assert.equal(b.reserved,16);
});
test('sender altitude and targeting grace affect receiver independently',()=>{
  const low=new Receiver(cfg({altitude:1000,senderAltitude:0,targetingGrace:false,cancelCorrection:false,garbageSpeed:0,garbagePhase:0}));low.receive(1,1);assert.equal(low.size,5);
  const grace=new Receiver(cfg({targetingGrace:true,cancelCorrection:false,garbageSpeed:0,garbagePhase:0}));grace.targetingGrace=18;grace.receive(6,1);assert.equal(grace.size,3);
});
test('only matching senders in the same batch are merged',()=>{
  const c=cfg({targetingGrace:false,garbageSpeed:0,garbagePhase:0}),a=new Receiver(c),b=new Receiver(c);
  a.receiveBatch([{amount:4,source:1},{amount:4,source:1}],1);assert.equal(a.reserved,8);assert.equal(a.pending.length,0);
  b.receiveBatch([{amount:4,source:1},{amount:4,source:2}],1);assert.equal(b.reserved,0);assert.equal(b.pending.length,2);
});
test('duplicate interactions are not injected twice',()=>{
  const r=new Receiver(cfg({garbageSpeed:0,garbagePhase:0,targetingGrace:false}));r.receiveBatch([{amount:3,source:4,iid:7},{amount:3,source:4,iid:7}],1);assert.equal(r.received,3);
});
test('continuous reservations cancel before pending attacks',()=>{
  const r=new Receiver(cfg({garbageEntry:'continuous',garbageSpeed:0,garbagePhase:0,targetingGrace:false})),b=board();r.receive(3,0);r.take(b,0);assert.equal(r.continuous.length,3);assert.equal(r.risen,0);
  r.receive(3,1);r.cancel(4,b,1);assert.equal(r.continuous.length,0);assert.equal(r.pending[0].amount,2);assert.equal(r.cancelled,4);
});
test('delayed rises wait for their deadlines and survive snapshot restoration',()=>{
  const c=cfg({garbageEntry:'delayed',garbageAre:4,garbageSpeed:0,garbagePhase:0,targetingGrace:false}),r=new Receiver(c),b=board();r.receive(3,0);r.take(b,0);const snap=r.snapshot();
  assert.equal(r.applyScheduled(b,3,true).rows,0);assert.equal(r.applyScheduled(b,4,true).rows,1);r.restore(snap);assert.equal(r.delayed.length,3);assert.equal(r.applyScheduled(board(),4,true).rows,1);
});
test('timer references still address the restored pending packets',()=>{
  const r=new Receiver(cfg({garbageSpeed:2,garbagePhase:3}));r.receive(3,0);const snap=r.snapshot();r.advance(2);r.restore(snap);r.advance(2);assert.equal(r.pending[0].active,true);
});
test('garbage smashes a completely filled top buffer without dropping it',()=>{
  const r=new Receiver(cfg({garbageSpeed:0,garbagePhase:0,targetingGrace:false})),b=board();b[39]=Array.from({length:10},()=>({mino:'t'}));r.receive(1,0);assert.equal(r.take(b,0).overflow,true);
});
test('S/Z and L/J spin-column history are separate',()=>{
  const r=new Receiver(cfg());r.cancelStreak=20;r.beforeClear(clear({mino:'s',spin:'mini',lines:1}),1,0);r.beforeClear(clear({mino:'l',spin:'mini',lines:1}),2,1);r.beforeClear(clear({mino:'z',spin:'mini',lines:1}),3,2);
  assert.equal(r.cancelStreak,20);r.beforeClear(clear({mino:'s',spin:'mini',lines:1}),4,4);assert.equal(r.cancelStreak,18);
});
test('ARE blocks hard drops but buffers an initial hold',()=>{
  const s=new Session(cfg({are:5,ihs:'tap'}));s.start();s.tick([key(s,'hardDrop')]);assert.equal(s.sleeping,true);const firstHold=s.holds;
  s.tick([key(s,'hardDrop'),key(s,'hold','keydown',.5)]);assert.equal(s.measure.pieces,1);
  for(let i=0;i<5;i++)s.tick();assert.equal(s.sleeping,false);assert.equal(s.holds,firstHold+1);
});
test('horizontal movement clears a prior spin classification',()=>{
  const s=new Session(cfg());s.start();s.engine.lastSpin='normal';s.tick([key(s,'moveLeft')]);assert.equal(s.engine.lastSpin,null);
});
test('drop scoring is recorded and hold counts successful swaps only',()=>{
  const s=new Session(cfg());s.start();s.tick([key(s,'hold')]);s.tick([key(s,'hold')]);assert.equal(s.holds,1);
  s.tick([key(s,'hardDrop')]);assert.ok(s.score>0);assert.equal(replay(s).score,s.score);
});
test('permanent rows remain and new garbage rises above them',()=>{
  const s=new Session(cfg({initialBoard:'XXXXXXXXXX'}));s.start();s.tick([key(s,'hardDrop')]);assert.equal(s.lines,0);assert.ok(s.engine.board.state[0].every(c=>c?.mino==='gbd'));
  const r=new Receiver(cfg({garbageSpeed:0,garbagePhase:0,targetingGrace:false}));r.receive(1,0);r.take(s.engine.board.state,0);assert.ok(s.engine.board.state[0].every(c=>c?.mino==='gbd'));
});
test('undo and redo restore receiver, source, supply and totals together',()=>{
  const s=new Session(cfg({incomingApm:50,firstAttackFrames:0,are:4}));s.start();s.tick([key(s,'hardDrop')]);const saved=s.snapshot();s.tick();s.tick();s.tick();s.tick();s.tick([key(s,'hardDrop')]);
  assert.equal(s.undo(),true);assert.deepEqual(s.receiver.snapshot(),saved.receiver);assert.deepEqual(s.source.snapshot(),saved.source);assert.deepEqual(s.supply.snapshot(),saved.supply);assert.equal(s.score,saved.score);assert.equal(s.redo(),true);assert.equal(s.measure.pieces,2);
});
test('a branch after undo exports only the selected timeline and replays exactly',()=>{
  const s=new Session(cfg({incomingApm:45}));s.start();s.tick([key(s,'hardDrop')]);for(let i=0;i<40;i++)s.tick();s.tick([key(s,'hardDrop')]);s.undo();s.start();s.tick([key(s,'moveLeft')]);s.tick([key(s,'hardDrop')]);
  assert.equal(s.canRedo,false);const r=replay(s);assert.deepEqual(r.engine.board.state,s.engine.board.state);assert.deepEqual(r.receiver.snapshot(),s.receiver.snapshot());assert.equal(r.score,s.score);
});
test('settings changes survive export, import and replay',()=>{
  const s=new Session(cfg());s.start();s.tick([key(s,'hardDrop')]);s.pause();s.applySettings(cfg({gravity:1,gravityIncrease:true,gravityRate:.5,arr:0}));s.start();for(let i=0;i<6;i++)s.tick();s.tick([key(s,'hardDrop')]);
  const file=inspectJson(bytes(s.exportReplay()));assert.ok(file.session);const r=new Session(file.session.config,file.session.source);r.start();for(let i=0;i<s.ticks+2;i++)r.tick();assert.deepEqual(r.engine.board.state,s.engine.board.state);assert.equal(r.environment.gravity,s.environment.gravity);assert.equal(r.score,s.score);
});
test('export contains required result families and native unique IGE ids',()=>{
  const s=new Session(cfg({incomingApm:200,firstAttackFrames:0}));s.start();for(let i=0;i<360;i++)s.tick();s.tick([key(s,'hardDrop')]);const out=s.exportReplay(),stats=out.replay.results.stats;
  assert.equal(out.version,1);assert.equal(out.replay.options.version,19);assert.ok(out.users[0].username);assert.ok(stats.clears);assert.ok(stats.zenith);assert.ok(Number.isFinite(stats.finaltime));assert.ok(Number.isFinite(out.replay.results.aggregatestats.vsscore));
  const ids=out.replay.events.filter(e=>e.type==='ige').map((e:any)=>e.data.id);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>0);
});
test('TTRX preserves the entire new exported replay',()=>{
  const s=new Session(cfg());s.start();s.tick([key(s,'hardDrop')]);const raw=bytes(s.exportReplay()),encoded=encode_ttr(raw);preflightTtrx(encoded);assert.deepEqual(JSON.parse(new TextDecoder().decode(decode_ttrx(encoded))),JSON.parse(new TextDecoder().decode(raw)));
});
test('external single and multiplayer source bytes remain unchanged',()=>{
  const raw=new TextEncoder().encode('{"version":1,"users":[{"username":"fixture"}],"extra":-0,"extra":1.00,"replay":{"frames":1,"options":{},"events":[{"frame":0,"type":"start","data":{}}]}}');
  const file=inspectJson(raw);assert.equal(file.session,undefined);assert.deepEqual(file.bytes,raw);assert.match(new TextDecoder().decode(decode_ttrx(encode_ttr(file.bytes))),/"extra":-0,"extra":1.00/);
  const multi={version:1,users:[{username:'one'},{username:'two'}],replay:{leaderboard:[],rounds:[[{replay:{frames:1,options:{},events:[{frame:0,type:'start',data:{}}]}},{replay:{frames:1,options:{},events:[{frame:0,type:'start',data:{}}]}}]]}};
  const f=inspectJson(bytes(multi),'fixture.ttrm');assert.equal(f.kind,'ttrm');assert.equal(f.streams,2);assert.equal(ttrx_source_extension(encode_ttrm(f.bytes)),'ttrm');
});
test('malformed imports reject before replacing any active session',()=>{
  const s=new Session(cfg());const before=s.snapshot();assert.throws(()=>inspectJson(bytes({version:999,replay:{events:[]}})));assert.throws(()=>inspectJson(new TextEncoder().encode('['.repeat(81))));assert.throws(()=>preflightTtrx(new Uint8Array(71)));assert.deepEqual(s.snapshot(),before);
  const raw=bytes(s.exportReplay()),encoded=encode_ttr(raw),bad=new Uint8Array(encoded);new DataView(bad.buffer).setBigUint64(16,64n*1024n*1024n,true);assert.throws(()=>preflightTtrx(bad));
});

test('a paused setting change at the final tick survives replay without an extra gameplay tick',()=>{
  const s=new Session(cfg());s.start();s.tick([key(s,'hardDrop')]);s.pause();
  s.applySettings(cfg({gravity:3,arr:0}));const r=replay(s);
  assert.equal(r.ticks,s.ticks);assert.equal(r.config.arr,0);assert.equal(r.environment.gravity,3);
  assert.deepEqual(r.engine.board.state,s.engine.board.state);assert.deepEqual(r.changes,s.changes);
});
test('rank-point export retains accumulated rank points, not the display average',()=>{
  const s=new Session(cfg({progression:true}));s.start();for(let i=0;i<60;i++)s.tick();
  assert.equal(s.exportReplay().replay.results.stats.zenith.avgrankpts,s.environment.rankSum);
  assert.ok(s.environment.rankSum>=60);
});
