import test from 'node:test';
import assert from 'node:assert/strict';
import { newSeed, MAX_SEED } from '../src/lib/seed.ts';
import { DEFAULT_CONFIG, validateConfig } from '../src/lib/config.ts';
import { createTranslator, resolveLocale, errorMessage } from '../src/lib/i18n/index.ts';
import { messages } from '../src/lib/i18n/messages.ts';
import { Receiver, AttackSource } from '../src/lib/garbage.ts';
import { garbageSegments, urgency } from '../src/lib/garbage-view.ts';
import { Environment } from '../src/lib/environment.ts';
import { Session } from '../src/lib/session.ts';
import { KEY_ACTIONS, NUMERIC_FIELDS, TOGGLE_FIELDS } from '../src/lib/settings-schema.ts';
import { rotationPositionIsLegal, attemptRotation, rotationTables, pieceDefinitions } from '../src/lib/vendor/integrated.js';
const cfg=(extra={})=>({...structuredClone(DEFAULT_CONFIG),...extra});

test('locale defaults to English and recognizes regional browser languages',()=>{
  assert.equal(resolveLocale([]),'en'); assert.equal(resolveLocale(['de-DE']),'en');
  assert.equal(resolveLocale(['ja-JP','en-US']),'ja'); assert.equal(resolveLocale(['KO-kr']),'ko');
  assert.equal(resolveLocale(['en-US','ko-KR']),'en');
});
test('all locale messages exist with the same interpolation contract',()=>{
  const slots=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
  for(const entry of Object.values(messages))for(const lang of ['ko','ja'] as const){assert.ok(entry[lang].length);assert.deepEqual(slots(entry[lang]),slots(entry.en));}
});
test('language-neutral field descriptors all resolve and refer to config keys',()=>{
  for(const [key,label] of [...NUMERIC_FIELDS,...TOGGLE_FIELDS]){assert.ok(key in DEFAULT_CONFIG);assert.ok(label in messages);}
  for(const [key,label] of KEY_ACTIONS){assert.ok(key in DEFAULT_CONFIG.bindings);assert.ok(label in messages);}
});
test('translated errors keep semantic code and interpolate safely',()=>{
  let error:unknown;try{validateConfig(cfg({gravity:-1}));}catch(e){error=e;}
  assert.match(errorMessage(error,'en'),/Gravity/);assert.match(errorMessage(error,'ja'),/重力/);
  assert.equal(createTranslator('ja')('garbage.cap',{cap:8}),'ガベージキャップ 8段');
});
test('seed restarts always change even when entropy repeats',()=>{
  assert.equal(newSeed(1,()=>0),2);assert.equal(newSeed(MAX_SEED,()=>MAX_SEED-1),1);
  for(const entropy of [0,1,2147483647,4294967295]){const next=newSeed(1,()=>entropy);assert.ok(next>=1&&next<=MAX_SEED);assert.notEqual(next,1);}
});
test('invalid entropy is not stored as a seed',()=>{assert.throws(()=>newSeed(1,()=>NaN));assert.throws(()=>newSeed(1,()=>-1));});
for(const floor of [1,5,10])test(`floor ${floor} drives garbage warnings and remaining frames`,()=>{
  const r=new Receiver(cfg({floor,targetingGrace:false,cancelCorrection:false,garbageSpeed:20}));r.receive(3,0);
  const phase=66-6*floor;assert.equal(r.phase,phase);
  assert.equal(garbageSegments(r,0)[0].remainingFrames,20+2*phase);
  r.advance(20);assert.equal(garbageSegments(r,20)[0].urgency,'waiting');
  r.advance(20+phase);assert.equal(garbageSegments(r,20+phase)[0].urgency,'warning');
  r.advance(20+2*phase);assert.equal(garbageSegments(r,20+2*phase)[0].urgency,'ready');
});
test('queued attacks do not promise an arrival time before predecessor resolution',()=>{
  const r=new Receiver(cfg({targetingGrace:false,cancelCorrection:false}));r.receive(3,0,1);r.receive(2,1,2);r.advance(21);
  const p=garbageSegments(r,21)[1];assert.equal(p.urgency,'waiting');assert.equal(p.remainingFrames,null);
});
test('warning presentation does not mutate receiver timers or RNG',()=>{
  const r=new Receiver(cfg());r.receive(3,0);const before=r.snapshot();garbageSegments(r,5);garbageSegments(r,15);assert.deepEqual(r.snapshot(),before);
});
test('manual phase wins over floor and progression selects current floor',()=>{
  const c=cfg({progression:true,garbagePhase:17}),env=new Environment(c);env.altitude=450;
  const effective=env.effective(c);assert.equal(effective.floor,5);assert.equal(new Receiver(effective).phase,17);
  assert.equal(new Receiver({...effective,garbagePhase:null}).phase,36);
});
test('rotation bounds reject fractional coordinates outside the top before rounding',()=>{
  const board=Array.from({length:40},()=>Array(10).fill(null));
  assert.equal(rotationPositionIsLegal([[4,39]],board),true);assert.equal(rotationPositionIsLegal([[4,39.04]],board),false);
  assert.equal(rotationPositionIsLegal([[4,.4]],board),true);assert.equal(rotationPositionIsLegal([[4,-.01]],board),false);
});
test('SRS+ I and 180 kick candidate order is retained',()=>{
  assert.deepEqual(rotationTables['SRS+'].i_kicks['01'],[[1,0],[-2,0],[-2,1],[1,-2]]);
  assert.deepEqual(rotationTables['SRS+'].kicks['02'],[[0,-1],[1,-1],[-1,-1],[1,0],[-1,0]]);
});
test('I5 spawn is anchored to its own matrix origin',()=>{
  const s=new Session(cfg({initialQueue:'I5',gravity:0,incomingApm:0}));assert.equal(s.engine.falling.symbol,'i5');
  assert.equal(s.engine.falling.x,2);assert.equal(s.engine.falling.location[1],23.04);
});
test('a pending queue keeps its warning time through snapshot restoration',()=>{
  const r=new Receiver(cfg({floor:5}));r.receive(3,0);r.advance(20);const snapshot=r.snapshot();r.advance(56);r.restore(snapshot);
  assert.equal(garbageSegments(r,20)[0].urgency,'waiting');r.advance(56);assert.equal(garbageSegments(r,56)[0].urgency,'warning');
});
test('language formatting has no influence on deterministic session output',()=>{
  const a=new Session(cfg({incomingApm:0})),b=new Session(cfg({incomingApm:0}));a.start();b.start();
  for(let i=0;i<60;i++){createTranslator(i%2?'ja':'ko')('status.running');a.tick();b.tick();}assert.deepEqual(a.summary(),b.summary());
});
test('attack source has no special early-session size multiplier',()=>{
  const c=cfg({firstAttackFrames:0}),a=new AttackSource(c),b=new AttackSource(c);b.nextFrame=10000;
  assert.deepEqual(a.next(0,c,0),b.next(10000,c,0));assert.equal(b.nextFrame-a.nextFrame,10000);
});
