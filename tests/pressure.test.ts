import test from 'node:test';
import assert from 'node:assert/strict';
import { AttackSource, ATTACK_PACING, stochasticDamage } from '../src/lib/attack-source.ts';
import { DEFAULT_CONFIG, validateConfig, type Config } from '../src/lib/config.ts';
import { incomingPacketLimit } from '../src/lib/attack-packets.ts';
import { Receiver } from '../src/lib/garbage.ts';
import { WINDUP, WINDUP_STAGES, windupView, windupEnd } from '../src/lib/windup.ts';
import { Session } from '../src/lib/session.ts';
import { captureReplayEnd } from '../src/lib/replay-state.ts';
import { inspectJson } from '../src/lib/replay.ts';
import { encode_ttr, decode_ttrx } from 'tetr-ttrx';
const cfg=(patch:Partial<Config>={})=>validateConfig({...DEFAULT_CONFIG,gravity:0,lockTime:3600,cancelCorrection:false,targetingGrace:false,...patch});
function sample(c:Config,seconds=600){const source=new AttackSource(c),events:{frame:number;amount:number}[]=[];for(let frame=0;frame<seconds*60;frame++){const e=source.next(frame,c,0);if(e?.amount)events.push({frame,amount:e.amount});}return events;}
test('incoming APM accepts exactly one decimal place without truncating saved values',()=>{
  for(const n of [0,.1,.9,45.7,1999.9,2000])assert.equal(cfg({incomingApm:n}).incomingApm,n);
  for(const n of [-.1,.11,45.71,NaN,Infinity,2000.1])assert.throws(()=>cfg({incomingApm:n}));
  assert.equal(validateConfig({incomingApm:45}).incomingApm,45);
});
test('fractional funded budgets become a probability of exactly one additional damage',()=>{
  assert.equal(stochasticDamage(2.25,()=>.249),3);assert.equal(stochasticDamage(2.25,()=>.25),2);
  assert.equal(stochasticDamage(0,()=>{throw new Error('unexpected draw');}),0);
  assert.equal(stochasticDamage(3,()=>{throw new Error('unexpected draw');}),3);
  for(const fraction of [.1,.5,.9]){let sum=0;for(let i=0;i<1000;i++)sum+=stochasticDamage(fraction,()=>i/1000);assert.equal(sum,fraction*1000);}
  assert.throws(()=>stochasticDamage(NaN,()=>0));
});
test('startup spends earned time while allowing varied multi-line packets',()=>{
  const c=cfg({seed:1,incomingApm:45}),events=sample(c);
  assert.ok(events.every(e=>Number.isInteger(e.amount)&&e.amount>0&&e.amount<=c.maxAttack));
  let sum=0;for(const e of events){sum+=e.amount;assert.ok(sum<=(e.frame-c.firstAttackFrames)*c.incomingApm/3600+1+1e-7);}
  assert.ok(events.every(e=>e.amount<=incomingPacketLimit(c)));assert.ok(events.some(e=>e.amount===incomingPacketLimit(c)));assert.ok(new Set(events.map(e=>e.amount)).size>=4);
  assert.ok(Math.abs(events.reduce((s,e)=>s+e.amount,0)/10-45)<3);
});
test('long preparation cannot bank a minute of damage',()=>{
  const c=cfg({incomingApm:45,firstAttackFrames:3600}),s=new AttackSource(c);
  for(let f=0;f<3600;f++)assert.equal(s.next(f,c,0),null);
  assert.ok((s.next(3600,c,0)?.amount??0)<=4);
});
test('small packet caps adapt cadence rather than suppressing the configured APM',()=>{
  for(const rate of [45.7,600,2000]){const e=sample(cfg({incomingApm:rate,maxAttack:1}));const average=e.reduce((s,n)=>s+n.amount,0)/10;assert.ok(Math.abs(average-rate)<Math.max(1,rate*.01));assert.ok(e.every(n=>n.amount===1));}
});
test('decimal rates remain statistically close across independent seeded runs',()=>{
  for(const rate of [1.7,45.7,120.5]){let total=0;const count=40;for(let seed=1;seed<=count;seed++)total+=sample(cfg({seed:seed*13711,incomingApm:rate}),1200).reduce((s,n)=>s+n.amount,0);
    assert.ok(Math.abs(total/(count*20)-rate)<Math.max(.3,rate*.06),`${rate}: ${total/(count*20)}`);
  }
});
test('sub-one APM still produces only occasional integer damage, not zero forever',()=>{
  let total=0;for(let seed=1;seed<=128;seed++){const events=sample(cfg({seed:seed*19777,incomingApm:.1}));assert.ok(events.every(e=>e.amount===1));total+=events.length;}
  assert.ok(total>70&&total<190,`observed ${total} lines over 1280 minutes`);
});
test('changing APM discards unspent preparation, and zero never builds repayment',()=>{
  let c=cfg({incomingApm:600}),s=new AttackSource(c);for(let f=0;f<100;f++)s.next(f,c,0);
  c={...c,incomingApm:0};for(let f=100;f<3700;f++)assert.equal(s.next(f,c,0),null);
  c={...c,incomingApm:6.1};assert.equal(s.next(3700,c,0),null);
  let sum=0;for(let f=3701;f<7300;f++){sum+=s.next(f,c,0)?.amount??0;assert.ok(sum<=Math.ceil(c.incomingApm));}
});
test('assist drops unsent budgets and never schedules repayment after release',()=>{
  const c=cfg({pressureAssist:true,incomingApm:45}),s=new AttackSource(c);assert.deepEqual(s.next(0,c,18),{amount:0,assisted:true});
  for(let f=1;f<10000;f++)assert.equal(s.next(f,c,18),null);
  assert.deepEqual(s.next(10000,c,0),{amount:0,assisted:false});
  let sum=0;for(let f=10001;f<13000;f++){sum+=s.next(f,c,0)?.amount??0;assert.ok(sum<=(f-10000)*c.incomingApm/3600+1+1e-7);}
});
test('without assist the player stack does not alter the generated rate',()=>{
  const c=cfg(),a=new AttackSource(c),b=new AttackSource(c);for(let f=0;f<7200;f++)assert.deepEqual(a.next(f,c,0),b.next(f,c,39));
});
test('source snapshot restores random phase, fractional budget and next deadline',()=>{
  const c=cfg({incomingApm:45.7}),s=new AttackSource(c);for(let f=0;f<183;f++)s.next(f,c,0);const saved=s.snapshot();
  const first=[];for(let f=183;f<4000;f++)first.push(s.next(f,c,0));s.restore(saved);const second=[];for(let f=183;f<4000;f++)second.push(s.next(f,c,0));assert.deepEqual(first,second);
});
test('a skipped frame interval does not create a catch-up burst',()=>{
  const c=cfg(),s=new AttackSource(c);s.next(0,c,0);assert.ok((s.next(36000,c,0)?.amount??0)<=4);assert.throws(()=>s.next(0,c,0));
});
test('concentrated-attack warning starts with its actual split reservation',()=>{
  const r=new Receiver(cfg());r.receive(7,0);assert.equal(r.windups.length,0);
  r.receive(8,10);r.receive(9,11);r.receive(13,12);
  assert.deepEqual(r.windups.map(n=>[n.start,n.parts,n.amount]),[[10,2,8],[190,3,9],[400,4,13]]);
  assert.equal(windupView(r.windups,189),null);assert.equal(windupView(r.windups,190)?.level,1);
});
test('windup uses the original stage timing but the requested bold text palette',()=>{
  const notices=[{id:1,start:100,parts:4,amount:16,source:1}];
  for(const [offset,level]of [[0,1],[20,1],[21,2],[32,2],[33,3],[44,3],[45,4]])assert.equal(windupView(notices,100+offset)?.level,level);
  assert.deepEqual(WINDUP.stageMilliseconds,[0,345,545,745]);assert.deepEqual(WINDUP_STAGES.map(x=>x.glyph),['!','!','!!','!!']);
  assert.equal(windupView(notices,279)?.fading,false);assert.equal(windupView(notices,280)?.fading,true);assert.equal(windupEnd(notices[0]),310);assert.equal(windupView(notices,310),null);
});
test('low altitude warnings finish at level two for eight damage and four at thirteen',()=>{
  for(const [amount,level]of [[8,2],[9,3],[12,3],[13,4],[24,4]]){const r=new Receiver(cfg());r.receive(amount,0);assert.equal(windupView(r.windups,45)?.level,level);}
  assert.equal(windupView([{id:1,start:0,parts:1,amount:8,source:1}],60)?.level,1);
});
test('windup presentation leaves receiver and random state unchanged and restores with undo',()=>{
  const r=new Receiver(cfg());r.receive(13,0);r.receive(16,60);const saved=r.snapshot();for(let f=0;f<500;f++)windupView(r.windups,f);assert.deepEqual(r.snapshot(),saved);
  r.advance(211);assert.equal(r.windups.length,1);r.restore(saved);assert.deepEqual(r.snapshot(),saved);assert.equal(windupView(r.windups,45)?.glyph,'!!');
});
test('TTR and TTRX preserve actual emitted amounts and windup playback without regenerating attacks',()=>{
  const s=new Session(cfg({incomingApm:240.7,initialPending:13,maxAttack:16}));s.start();
  const expected=[];for(let f=0;f<1400&&s.status==='running';f++){s.tick();expected.push(windupView(s.receiver.windups,s.frame));}s.stop();
  const file=s.exportReplay();assert.equal(file.spilink.attackSource.version,ATTACK_PACING.version);
  const outgoing=file.replay.events.filter(e=>e.type==='ige'&&(e.data as any).type==='interaction');
  assert.equal(outgoing.length,s.incoming.filter(e=>e.amount>0).length+1);
  assert.equal(outgoing.reduce((sum,e)=>sum+(e.data as any).data.amt,0),13+s.incoming.reduce((sum,e)=>sum+e.amount,0));
  assert.ok(outgoing.every(e=>Number.isInteger((e.data as any).data.amt)));
  const bytes=new TextEncoder().encode(JSON.stringify(file)),restored=decode_ttrx(encode_ttr(bytes));assert.deepEqual(JSON.parse(new TextDecoder().decode(restored)),file);
  const parsed=inspectJson(restored);assert.ok(parsed.session);const playback=new Session(parsed.session.config,parsed.session.source);playback.start();
  for(let i=0;i<expected.length;i++){playback.tick();assert.deepEqual(windupView(playback.receiver.windups,playback.frame),expected[i]);}
  assert.equal(playback.replayMismatch,false);assert.deepEqual(captureReplayEnd(playback),captureReplayEnd(s));
});
test('previous v3 records replay their recorded attacks without requiring new source metadata',()=>{
  const s=new Session(cfg({incomingApm:0,initialPending:13}));s.start();for(let i=0;i<20;i++)s.tick();s.stop();const file:any=s.exportReplay();delete file.spilink.attackSource;
  assert.ok(inspectJson(new TextEncoder().encode(JSON.stringify(file))).session);
});
