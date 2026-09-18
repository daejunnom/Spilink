import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, validateConfig, type Config } from '../src/lib/config.ts';
import { Session } from '../src/lib/session.ts';
import { AttackRules } from '../src/lib/rules.ts';
import { Receiver } from '../src/lib/garbage.ts';
import { Environment } from '../src/lib/environment.ts';
import { nativeOptions } from '../src/lib/ttr.ts';
import { inspectJson } from '../src/lib/replay.ts';
import { captureReplayEnd, validReplayEnd } from '../src/lib/replay-state.ts';
import { CLIENT_TIMING_DEFAULTS, expertPhase, REPLAY_VERSION } from '../src/lib/rule-defaults.ts';
import { fallingPositionLegal, pushFallingOneRow, garbageCeilingFull } from '../src/lib/survival.ts';
import { encode_ttr, decode_ttrx } from 'tetr-ttrx';
import type { ClearEvent, GameKey, KeyFrame, Tile } from '../src/lib/port.ts';
const config=(patch:Partial<Config>={}):Config=>validateConfig({...DEFAULT_CONFIG,gravity:0,incomingApm:0,safelock:false,...patch});
const empty=():Tile[][]=>Array.from({length:40},()=>Array(10).fill(null));
const map=(cells:[number,number][],height=40)=>{const b=Array.from({length:height},()=>Array(10).fill('.'));for(const[x,y]of cells)b[y][x]='G';return b.reverse().map(r=>r.join('')).join('\n');};
const key=(s:Session,name:GameKey,type:'keydown'|'keyup'='keydown',subframe=0):KeyFrame=>({frame:s.frame,type,data:{key:name,subframe}});
const tap=(s:Session,name:GameKey)=>s.tick([key(s,name),key(s,name,'keyup',.1)]);
const clear=(lines:number,spin:ClearEvent['spin'],pc:boolean):ClearEvent=>({lines,spin,pc,garbageCleared:0,hard:true,mino:'t'});
function replay(s:Session){const out=s.exportReplay(),parsed=inspectJson(new TextEncoder().encode(JSON.stringify(out)));assert.ok(parsed.session);const r=new Session(parsed.session.config,parsed.session.source);r.start();for(let n=0;n<=s.ticks&&r.status==='running';n++)r.tick();assert.equal(r.replayMismatch,false);assert.deepEqual(captureReplayEnd(r),captureReplayEnd(s));return r;}

test('season-two non-spin PC contributes exactly one B2B without discharging a surge',()=>{
  const r=new AttackRules();r.btb=10;r.combo=8;const attacks=r.resolve(clear(2,'none',true),config());
  assert.equal(r.btb,11);assert.equal(r.topBtb,11);assert.ok(attacks.every(a=>a.kind!=='surge'));assert.deepEqual(attacks.map(a=>a.kind),['clear','allclear']);
});
test('spin PC and quad PC never double-count their B2B contribution',()=>{
  for(const [lines,spin]of [[2,'normal'],[1,'mini'],[4,'none']] as const){const r=new AttackRules();r.btb=6;r.resolve(clear(lines,spin,true),config());assert.equal(r.btb,7);}
});
test('a non-PC ordinary clear still releases a charged surge',()=>{
  const r=new AttackRules();r.btb=10;assert.equal(r.resolve(clear(2,'none',false),config()).filter(x=>x.kind==='surge').reduce((a,b)=>a+b.amount,0),6);assert.equal(r.btb,0);
});
test('real 400th PC preserves B2B and records its final attack before stopping',()=>{
  const s=new Session(config({initialQueue:'O'}));s.measure.pieces=399;s.rules.btb=10;
  for(let y=0;y<2;y++)s.engine.board.state[y]=Array.from({length:10},(_,x)=>x===4||x===5?null:{mino:'gb'});
  s.start();tap(s,'hardDrop');assert.equal(s.status,'completed');assert.equal(s.rules.btb,11);assert.equal(s.allClears,1);assert.equal(s.lastAttack,12);assert.equal(s.measure.checkpoint?.attack,12);
});
test('generic timing defaults and expert floor phases are distinct and explicit',()=>{
  assert.deepEqual(CLIENT_TIMING_DEFAULTS,{garbageSpeed:20,garbagePhase:0,garbageQueue:false,garbageAre:5,garbageAreBump:12});
  assert.equal(DEFAULT_CONFIG.garbagePhase,null);for(const[f,phase]of [[1,60],[5,36],[10,6]])assert.equal(expertPhase(f),phase);
  assert.equal(nativeOptions(config()).garbagespeed,20);assert.equal(nativeOptions(config()).garbagephase,60);
});
test('normal attack arrival includes flight and both floor-dependent warning stages',()=>{
  for(const floor of [1,5,10]){const c=config({floor,targetingGrace:false,cancelCorrection:false}),r=new Receiver(c);r.receive(3,0);const phase=expertPhase(floor);
    r.advance(19);assert.equal(r.pending[0].active,false);r.advance(20);assert.equal(r.pending[0].status,'caution');
    r.advance(20+phase);assert.equal(r.pending[0].status,'danger');r.advance(20+2*phase-1);assert.equal(r.pending[0].status,'danger');r.advance(20+2*phase);assert.equal(r.pending[0].status,'spawn');
  }
});
test('explicit timing overrides survive validation and floor progression',()=>{
  const c=config({garbageSpeed:75,garbagePhase:17,garbageAre:4,garbageAreBump:4,garbageQueue:true,progression:true});const env=new Environment(c);env.altitude=1700;const effective=env.effective(c);
  assert.equal(effective.garbageSpeed,75);assert.equal(effective.garbagePhase,17);assert.equal(effective.garbageAre,4);assert.equal(effective.garbageAreBump,4);assert.equal(effective.garbageQueue,true);
});
test('native options explicitly preserve hold and survival policy instead of implicit defaults',()=>{
  const o=nativeOptions(config());assert.equal(o.infinite_hold,false);assert.equal(o.display_hold,true);assert.equal(o.nolockout,true);assert.equal(o.clutch,true);assert.equal(o.allclear_b2b,1);assert.equal(o.allclear_b2b_dupes,false);assert.equal(o.allclear_b2b_sends,true);
});
test('hold locks until next spawn in live and replay, including ARE',()=>{
  const s=new Session(config({initialQueue:'IOT',are:5}));s.start();tap(s,'hold');assert.equal(s.engine.holdLocked,true);assert.equal(s.holds,1);assert.equal(s.engine.held,'i');
  tap(s,'hold');assert.equal(s.holds,1);assert.equal(replay(s).engine.holdLocked,true);
  tap(s,'hardDrop');assert.equal(s.sleeping,true);assert.equal(s.engine.holdLocked,true);
  for(let i=0;i<6;i++)s.tick();assert.equal(s.engine.holdLocked,false);s.stop();replay(s);
});
test('holding into an obstructed spawn dies immediately and cannot move out afterwards',()=>{
  const s=new Session(config({initialQueue:'IOI',initialBoard:map([[4,22]])}));assert.equal(s.engine.toppedOut,false);s.start();
  s.tick([key(s,'hold'),key(s,'moveRight','keydown',.2),key(s,'hardDrop','keydown',.5)]);
  assert.equal(s.status,'topout');assert.equal(s.measure.pieces,0);assert.equal(s.holds,1);assert.equal(s.events.filter(e=>e.type==='keydown').length,1);replay(s);
});
test('clutch rescues spawn collisions only following a line clear',()=>{
  for(const clutch of [false,true]){const s=new Session(config({clutch,initialQueue:'I',initialBoard:map([[4,22]])}));s.start();s.engine.lastWasClear=true;s.engine.initiatePiece('o');
    assert.equal(s.status,clutch?'running':'topout');if(clutch){assert.ok(s.engine.falling.location[1]>22.04);assert.equal(fallingPositionLegal(s.engine),true);}
  }
});
test('clutch cannot spawn beyond the finite buffer ceiling',()=>{
  const cells:[number,number][]=[];for(let y=22;y<40;y++)cells.push([4,y]);const s=new Session(config({initialQueue:'I',initialBoard:map(cells)}));s.start();s.engine.lastWasClear=true;s.engine.initiatePiece('o');assert.equal(s.status,'topout');
});
test('a piece wholly above the visible field respects the explicit lockout policy',()=>{
  for(const noLockout of [true,false]){const s=new Session(config({noLockout,initialQueue:'OI',initialBoard:map([[4,20],[5,20]]),are:5}));s.start();tap(s,'hardDrop');assert.equal(s.status,noLockout?'running':'topout');}
});
test('clutch forgives whole-piece lockout only when a line was cleared',()=>{
  const cells:[number,number][]=[];for(let x=0;x<10;x++){if(x<3||x>6)cells.push([x,21]);else cells.push([x,20]);}
  for(const clutch of [true,false]){const s=new Session(config({noLockout:false,clutch,initialQueue:'I',initialBoard:map(cells),lineClearAre:5}));s.start();tap(s,'hardDrop');assert.equal(s.lines,1);assert.equal(s.status,clutch?'running':'topout');}
});
test('garbage ceiling matches full-row semantics, not highest occupied-cell height',()=>{
  const b=empty();b[39][0]={mino:'gb'};assert.equal(garbageCeilingFull(b),false);const r=new Receiver(config({targetingGrace:false,garbageSpeed:0,garbagePhase:0}));r.receive(1,0);assert.equal(r.take(b,0).overflow,false);assert.equal(r.risen,1);
  const full=empty();full[39]=Array.from({length:10},()=>({mino:'gb'}));const before=structuredClone(full),r2=new Receiver(config({targetingGrace:false,garbageSpeed:0,garbagePhase:0}));r2.receive(1,0);assert.equal(r2.take(full,0).overflow,true);assert.deepEqual(full,before);
});
test('rising garbage may move the active piece by one row, never rescue through several rows',()=>{
  const s=new Session(config({initialQueue:'O'}));for(const [x,y]of s.engine.falling.absoluteBlocks)s.engine.board.state[y][x]={mino:'gb'};
  const before=s.engine.falling.location[1];assert.equal(pushFallingOneRow(s.engine),false);assert.equal(s.engine.falling.location[1],before);
  s.engine.board.state=empty();for(const[x,y]of s.engine.falling.absoluteBlocks.filter(([,y])=>y===21))s.engine.board.state[y][x]={mino:'gb'};
  assert.equal(pushFallingOneRow(s.engine),true);assert.equal(s.engine.falling.location[1],before+1);
});
test('incoming attacks including initial pending are recorded as native interactions with finite ids',()=>{
  const s=new Session(config({incomingApm:90,firstAttackFrames:0,initialPending:3,garbageSpeed:0,garbagePhase:0,targetingGrace:false}));s.start();for(let i=0;i<500;i++)s.tick();s.stop();
  const f=s.exportReplay(),ige=f.replay.events.filter(e=>e.type==='ige'&&(e.data as any).type==='interaction');
  assert.equal(ige.length,s.incoming.filter(x=>x.amount>0).length+1);const ids=ige.map(e=>(e.data as any).id);assert.equal(new Set(ids).size,ids.length);
  for(const e of ige){const d=(e.data as any).data;assert.ok(Number.isInteger(d.iid)&&Number.isInteger(d.ackiid));assert.notEqual(d.gameid,1);assert.equal(d.active,false);assert.equal(d.frame,e.frame);assert.ok(d.amt>0);}
  assert.equal((ige[0].data as any).data.amt,3);assert.equal((ige[0].data as any).data.gameid,0);
  const r=replay(s);assert.equal(r.receiver.received,s.receiver.received);
});
test('live, exported, and TTRX-restored sessions agree with incoming garbage and hold actions',()=>{
  for(let seed=1;seed<=12;seed++){
    const s=new Session(config({seed,incomingApm:80,maxAttack:24,firstAttackFrames:0,garbageSpeed:3,garbagePhase:2,floor:5}));s.start();
    for(let n=0;n<800&&s.status==='running';n++){
      if(n===37){s.pause();const frame=s.frame;s.tick();assert.equal(s.frame,frame);s.applySettings({...s.config,garbageSpeed:7});s.start();}
      if(n%37===0)tap(s,'hold');else if(n%17===0)tap(s,'hardDrop');else if(n%13===0)tap(s,n%26?'moveLeft':'moveRight');else s.tick();
    }
    s.stop();assert.ok(s.incoming.length>0);replay(s);
    const bytes=new TextEncoder().encode(JSON.stringify(s.exportReplay()));assert.deepEqual(JSON.parse(new TextDecoder().decode(decode_ttrx(encode_ttr(bytes)))),JSON.parse(new TextDecoder().decode(bytes)));
  }
});
test('divergent replay end is labelled as mismatch rather than an unqualified death result',()=>{
  const s=new Session(config());s.start();tap(s,'hardDrop');s.stop();const source=s.replaySource();source.expectedEnd!.board[0][0]='gb';const r=new Session(s.config,source);r.start();for(let i=0;i<=source.ticks&&r.status==='running';i++)r.tick();assert.equal(r.replayMismatch,true);
});
test('legacy and unknown rule revisions remain byte-preserved instead of silently using new rules',()=>{
  const s=new Session(config());s.start();tap(s,'hardDrop');s.stop();const file=s.exportReplay();assert.equal(file.spilink.version,REPLAY_VERSION);
  for(const patch of [{version:2,profile:'practice-2'},{ruleRevision:'unknown-future'}]){const f={...file,spilink:{...file.spilink,...patch}},bytes=new TextEncoder().encode(JSON.stringify(f)),parsed=inspectJson(bytes);assert.equal(parsed.session,undefined);assert.deepEqual(parsed.bytes,bytes);}
});
test('malformed expected state is rejected before starting replay',()=>{
  const s=new Session(config()),end=captureReplayEnd(s);assert.equal(validReplayEnd(end),true);assert.equal(validReplayEnd({...end,board:[]}),false);assert.equal(validReplayEnd({...end,y:Infinity}),false);
  const file=s.exportReplay();file.spilink.expectedEnd!.board=[];assert.throws(()=>inspectJson(new TextEncoder().encode(JSON.stringify(file))));
});

test('a replay that is already topped out at initialization still verifies its final state',()=>{
  const s=new Session(config({initialQueue:'O',initialBoard:map([[4,22]])}));assert.equal(s.status,'topout');
  const source=s.replaySource(),r=new Session(s.config,source);assert.equal(r.replayMismatch,false);
  source.expectedEnd!.pieces=1;const bad=new Session(s.config,source);assert.equal(bad.replayMismatch,true);
});

test('pre-flight inactive state is preserved in native events even with zero warning phase',()=>{
  const s=new Session(config({initialPending:3,garbagePhase:0,garbageSpeed:20,targetingGrace:false,cancelCorrection:false}));
  const e=s.exportReplay().replay.events.find(e=>e.type==='ige')!;assert.equal((e.data as any).data.active,false);assert.equal(s.receiver.pending[0].active,false);
  assert.equal(s.receiver.take(s.engine.board.state,0).rows,0);s.receiver.advance(19);assert.equal(s.receiver.take(s.engine.board.state,19).rows,0);s.receiver.advance(20);assert.equal(s.receiver.take(s.engine.board.state,20).rows,3);
});
