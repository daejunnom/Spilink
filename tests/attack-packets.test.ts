import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ATTACK_PACKETS, incomingPacketLimit, splitAttackGroup, splitGapFrames } from '../src/lib/attack-packets.ts';
import { AttackSource } from '../src/lib/attack-source.ts';
import { Random } from '../src/lib/rules.ts';
import { DEFAULT_CONFIG, validateConfig, type Config } from '../src/lib/config.ts';
import { Receiver } from '../src/lib/garbage.ts';
import { Session } from '../src/lib/session.ts';
import { inspectJson } from '../src/lib/replay.ts';
import { captureReplayEnd } from '../src/lib/replay-state.ts';
import { encode_ttr, decode_ttrx } from 'tetr-ttrx';
const cfg=(patch:Partial<Config>={}):Config=>validateConfig({...DEFAULT_CONFIG,...patch});
function sample(c:Config,frames=36000){
  const s=new AttackSource(c),events:{frame:number;amount:number}[]=[];
  for(let f=0;f<frames;f++){const e=s.next(f,c,0);if(e?.amount)events.push({frame:f,amount:e.amount});}
  return events;
}
function fundedGroup(rate=150){
  const c=cfg({incomingApm:rate,firstAttackFrames:0,pressureAssist:true}),s=new AttackSource(c);
  // A fully funded group at an emission deadline isolates delivery from size sampling.
  s.restore({...s.snapshot(),credit:19,planned:19,nextFrame:0,splitRandomState:63891});
  return {s,c};
}
test('automatic delivery limits retain 10 APM and reach 8 at 150 APM',()=>{
  for(const [rate,cap] of [[.1,1],[1,1],[10,5],[60,6],[100,7],[150,8],[2000,8]])assert.equal(incomingPacketLimit(cfg({incomingApm:rate})),cap);
  assert.equal(incomingPacketLimit(cfg({incomingApm:150,maxAttack:3})),3);
  assert.equal(incomingPacketLimit(cfg({incomingApm:150,attackPacketCap:12})),12);
  assert.equal(incomingPacketLimit(cfg({incomingApm:150,maxAttack:4,attackPacketCap:12})),4);
});
test('packet overrides validate separately and old settings hydrate to automatic',()=>{
  assert.equal(validateConfig({incomingApm:10,maxAttack:24}).attackPacketCap,null);
  for(const v of [null,1,8,1000])assert.equal(cfg({attackPacketCap:v}).attackPacketCap,v);
  for(const v of [0,-1,1.5,1001,NaN,Infinity,'8'])assert.throws(()=>validateConfig({attackPacketCap:v}));
});
test('19 is split as 8/6/5 without discarding or duplicating any lines',()=>{
  const draws=[.999,0];assert.deepEqual(splitAttackGroup(19,8,()=>draws.shift()!),[8,6,5]);
  assert.deepEqual(splitAttackGroup(5,5,()=>{throw new Error('unsplit must not draw');}),[5]);
  assert.deepEqual(splitAttackGroup(9,8,()=>.999),[7,2]);
});
test('splits conserve sums and respect limits without avoidable one-line tails',()=>{
  for(const cap of [1,2,3,5,6,8,24,1000])for(let total=1;total<=1000;total++){
    const r=new Random(total*19777+cap),parts=splitAttackGroup(total,cap,()=>r.next());
    assert.equal(parts.reduce((n,a)=>n+a,0),total);
    assert.equal(parts.length,Math.ceil(total/cap));
    assert.ok(parts.every(a=>Number.isSafeInteger(a)&&a>=1&&a<=cap));
    if(parts.length>1&&total>=2*parts.length)assert.ok(parts.every(a=>a>=2));
  }
  for(const [total,cap] of [[0,8],[-1,8],[3.2,8],[19,0],[19,2.5],[NaN,8],[19,Infinity]])assert.throws(()=>splitAttackGroup(total,cap,()=>0));
  assert.throws(()=>splitAttackGroup(19,8,()=>1));
});
// Golden timelines captured from published rolling-1 (3e302bc), not this implementation.
for(const [seed,hash] of [[1,'0aa33370b7b21d53457783457281b0d72ed9c58b3a0088c8ed86a7c75b17bda4'],[13711,'a615089b8201d6d60800563e9c887a0aa7864e866b14e9a4484b11472c26ecf0'],[987654,'d13994a3b4b1acaeb17fea4862c28b6b1eed6a1c87bdc785b48d5d49a9169f29']] as const){
  test(`10 APM retains the entire published timeline at seed ${seed}`,()=>{
    assert.equal(createHash('sha256').update(JSON.stringify(sample(cfg({seed,incomingApm:10})))).digest('hex'),hash);
  });
}
for(const rate of [60,150,600,2000])test(`delivery and rolling limits both hold at ${rate} APM`,()=>{
  for(let seed=1;seed<=12;seed++){
    const c=cfg({incomingApm:rate,seed:seed*13711}),events=sample(c);let start=0,total=0;
    for(const e of events){assert.ok(e.amount<=incomingPacketLimit(c));total+=e.amount;
      while(events[start].frame<=e.frame-3600)total-=events[start++].amount;
      assert.ok(total<=Math.ceil(rate));
    }
    const average=events.reduce((n,e)=>n+e.amount,0)/10;assert.ok(average>rate*.90&&average<=rate);
  }
});
test('funded group is charged once per actual packet with gaps, not at reservation time',()=>{
  const {s,c}=fundedGroup();assert.deepEqual(s.next(0,c,0),{amount:8,assisted:false});
  assert.equal(s.snapshot().recent.reduce((n,e)=>n+e.amount,0),8);assert.deepEqual(s.snapshot().pendingParts,[6,5]);
  const events=[{frame:0,amount:8}];
  for(let f=1;s.snapshot().pendingParts.length;f++){
    assert.ok(f<200);const e=s.next(f,c,0);if(e?.amount)events.push({frame:f,amount:e.amount});
  }
  assert.deepEqual(events.map(e=>e.amount),[8,6,5]);assert.ok(events[1].frame>=45);assert.ok(events[2].frame>events[1].frame);
  assert.deepEqual(s.snapshot().recent,events);assert.equal(events.reduce((n,e)=>n+e.amount,0),19);
});
test('separated raw packets do not recombine into a single 19-line receiver attack',()=>{
  const {s,c}=fundedGroup();const r=new Receiver({...c,cancelCorrection:false,targetingGrace:false,garbageSpeed:0,garbagePhase:0});
  let delivered=0;
  for(let f=0;f<200;f++){const e=delivered<19?s.next(f,c,0):null;if(e?.amount){delivered+=e.amount;r.receiveBatch([{amount:e.amount,source:1}],f);}r.advance(f);}
  assert.equal(r.received,19);assert.equal(r.pending.reduce((n,e)=>n+e.amount,0),19);
  assert.ok(r.windups.every(w=>w.amount<=8));assert.deepEqual(r.pending.map(p=>p.amount).sort((a,b)=>a-b),[4,4,5,6]);
});
test('snapshot copies pending parts and splitting random state without mutating saved branches',()=>{
  const {s,c}=fundedGroup();s.next(0,c,0);const saved=s.snapshot(),frozen=structuredClone(saved),expected=[];
  for(let f=1;f<700;f++)expected.push(s.next(f,c,0));assert.deepEqual(saved,frozen);
  s.restore(saved);saved.pendingParts[0]=999;const actual=[];
  for(let f=1;f<700;f++)actual.push(s.next(f,c,0));assert.deepEqual(actual,expected);
});
test('APM zero, relief, and edits discard unsent parts but preserve spent history',()=>{
  for(const patch of [{incomingApm:0},{incomingApm:10},{maxAttack:5},{attackPacketCap:3},{}]){
    const {s,c}=fundedGroup();s.next(0,c,0);const before=s.snapshot().recent;
    s.next(1,{...c,...patch},Object.keys(patch).length?0:20);
    assert.deepEqual(s.snapshot().pendingParts,[]);assert.deepEqual(s.snapshot().recent,before);assert.equal(s.snapshot().credit,0);
  }
});
test('a clock gap cannot flush pending parts as an immediate catch-up burst',()=>{
  const {s,c}=fundedGroup();s.next(0,c,0);assert.equal(s.next(600,c,0),null);
  assert.deepEqual(s.snapshot().pendingParts,[]);assert.equal(s.snapshot().recent[0].amount,8);
});
test('subpacket gap cannot prevent high-APM throughput and never equals zero',()=>{
  for(const apm of [60,150,600,2000])for(const amount of [1,5,8]){
    const gap=splitGapFrames(amount,apm,3600,()=>.999);
    assert.ok(gap>=1&&gap<=ATTACK_PACKETS.maximumGapFrames);
    assert.ok(gap<=Math.ceil(amount*3600/apm*ATTACK_PACKETS.fundingGapShare));
  }
});
test('native replay stores each delivered subpacket once and TTRX preserves it',()=>{
  const c=cfg({incomingApm:150,gravity:0,lockTime:3600,garbageSpeed:36000,cancelCorrection:false,targetingGrace:false});
  const s=new Session(c);s.start();let splitObserved=false;
  for(let i=0;i<2400;i++){s.tick();splitObserved ||= s.source.snapshot().pendingParts.length>0;}s.stop();assert.ok(splitObserved);
  const file=s.exportReplay(),positive=file.spilink.attacks.filter(e=>e.amount>0);
  const native=file.replay.events.filter(e=>e.type==='ige'&&(e.data as any).type==='interaction');
  assert.ok(positive.every(e=>e.amount<=8));assert.equal(native.length,positive.length);
  assert.deepEqual(native.map(e=>({frame:e.frame,amount:(e.data as any).data.amt})),positive.map(e=>({frame:e.frame,amount:e.amount})));
  assert.equal(file.spilink.attackSource.initialPacketCap,8);
  const decoded=decode_ttrx(encode_ttr(new TextEncoder().encode(JSON.stringify(file))));const parsed=inspectJson(decoded);assert.ok(parsed.session);
  const r=new Session(parsed.session.config,parsed.session.source);r.start();for(let i=0;i<s.ticks;i++)r.tick();
  assert.equal(r.replayMismatch,false);assert.deepEqual(captureReplayEnd(r),captureReplayEnd(s));
});
test('ending during a split exports sent parts only, never the unsent reservation',()=>{
  const s=new Session(cfg({incomingApm:150,gravity:0,lockTime:3600,garbageSpeed:36000}));s.start();
  for(let f=0;f<7200&&!s.source.snapshot().pendingParts.length;f++)s.tick();
  assert.ok(s.source.snapshot().pendingParts.length);s.stop();const file=s.exportReplay();
  const emitted=s.incoming.reduce((n,e)=>n+e.amount,0);
  assert.equal(file.replay.events.filter(e=>e.type==='ige'&&(e.data as any).type==='interaction').reduce((n,e)=>n+(e.data as any).data.amt,0),emitted);
});
