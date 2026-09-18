import test from 'node:test';
import assert from 'node:assert/strict';
import { RollingAttackBudget, ATTACK_WINDOW_FRAMES } from '../src/lib/attack-budget.ts';
import { AttackSource, ATTACK_PACING } from '../src/lib/attack-source.ts';
import { DEFAULT_CONFIG, type Config } from '../src/lib/config.ts';
import { Session } from '../src/lib/session.ts';
import { inspectJson } from '../src/lib/replay.ts';
const config=(values:Partial<Config>={}):Config=>({...DEFAULT_CONFIG,...values});
function sample(c:Config,frames=36000) {
  const source=new AttackSource(c),events:{frame:number;amount:number}[]=[];
  for(let f=0;f<frames;f++){const e=source.next(f,c,0);if(e?.amount)events.push({frame:f,amount:e.amount});}
  return events;
}
test('rolling spend expires per event, not at 60-second clock boundaries',()=>{
  const b=new RollingAttackBudget();b.spend(3400,8,60);b.spend(3550,12,60);
  b.advance(3600);assert.equal(b.spent,20);assert.equal(b.available(60),40);
  b.advance(6999);assert.equal(b.spent,20);b.advance(7000);assert.equal(b.spent,12);
  b.advance(7149);assert.equal(b.spent,12);b.advance(7150);assert.equal(b.spent,0);
});
test('rolling budget counts raw emission, independently of later receipt and cancellation',()=>{
  const b=new RollingAttackBudget();b.spend(100,10,60);assert.equal(b.available(60),50);
  b.advance(101);assert.equal(b.available(60),50);assert.throws(()=>b.spend(101,51,60));
  assert.equal(b.available(5),0);assert.equal(b.available(80),70);
});
test('budget snapshot restores are deep and cannot change a saved timeline',()=>{
  const b=new RollingAttackBudget();b.spend(10,4,60);const s=b.snapshot();b.spend(11,8,60);assert.equal(s.length,1);
  b.restore(s);s[0].amount=999;assert.equal(b.spent,4);assert.equal(b.snapshot()[0].amount,4);
});
for(const rate of [2,6,10,20,60,60.7,600,2000])test(`every trailing minute obeys the integer budget at ${rate} APM`,()=>{
  const c=config({incomingApm:rate});
  for(let seed=1;seed<=8;seed++){
    const events=sample({...c,seed:seed*19777});let start=0,total=0;
    for(const e of events){total+=e.amount;while(events[start].frame<=e.frame-ATTACK_WINDOW_FRAMES)total-=events[start++].amount;
      assert.ok(total<=Math.ceil(rate),`${rate}: ${total} at ${e.frame}`);assert.ok(e.amount<=c.maxAttack);
    }
  }
});
for(const rate of [6,10,20])test(`low ${rate} APM groups lines instead of producing only single damage`,()=>{
  for(let seed=1;seed<=12;seed++){
    const events=sample(config({incomingApm:rate,seed:seed*13711}));
    assert.ok(events.some(e=>e.amount>=2));assert.ok(new Set(events.map(e=>e.amount)).size>=2);
    assert.ok(events.filter(e=>e.amount===1).length<events.length*.6);
    assert.ok(events.some((e,i)=>i>0&&e.frame-events[i-1].frame>300));
  }
});
test('lowering rate or changing packet cap retains actual recent spending',()=>{
  let c=config({incomingApm:600}),s=new AttackSource(c);
  for(let f=0;f<600;f++)s.next(f,c,0);
  const before=s.snapshot().recent;assert.ok(before.reduce((n,e)=>n+e.amount,0)>6);
  c={...c,incomingApm:6,maxAttack:5};assert.equal(s.next(600,c,0),null);
  assert.deepEqual(s.snapshot().recent,before);
  const release=before[0].frame+3600;
  for(let f=601;f<release;f++)assert.equal(s.next(f,c,0),null);
});
test('APM zero and relief never forgive recent spending or charge suppressed time',()=>{
  let c=config({incomingApm:60,pressureAssist:true}),s=new AttackSource(c);
  for(let f=0;f<1800;f++)s.next(f,c,0);
  const before=s.snapshot().recent;assert.deepEqual(s.next(1800,c,20),{amount:0,assisted:true});assert.deepEqual(s.snapshot().recent,before);
  for(let f=1801;f<7200;f++)assert.equal(s.next(f,c,20),null);
  assert.deepEqual(s.next(7200,c,0),{amount:0,assisted:false});assert.equal(s.snapshot().credit,0);
  let sum=0;for(let f=7201;f<10800;f++){sum+=s.next(f,c,0)?.amount??0;assert.ok(sum<=(f-7200)/60+1+1e-7);}
  const saved=s.snapshot().recent;c={...c,incomingApm:0};s.next(10800,c,0);
  assert.deepEqual(s.snapshot().recent,saved.filter(e=>e.frame>7200));
});
test('source snapshot restores a partially spent rolling minute and in-progress group',()=>{
  const c=config({incomingApm:60.7}),s=new AttackSource(c);for(let f=0;f<3599;f++)s.next(f,c,0);
  const saved=s.snapshot(),frozen=structuredClone(s.snapshot()),expected=[];for(let f=3599;f<7900;f++)expected.push(s.next(f,c,0));
  s.restore(saved);const actual=[];for(let f=3599;f<7900;f++)actual.push(s.next(f,c,0));assert.deepEqual(actual,expected);
  assert.deepEqual(saved,frozen);
});
test('repeated calls at the same game frame cannot spend twice or redraw probability',()=>{
  const c=config({incomingApm:2000,maxAttack:1}),s=new AttackSource(c);
  for(let f=0;f<400;f++){s.next(f,c,0);const saved=s.snapshot();for(let n=0;n<8;n++)assert.equal(s.next(f,c,0),null);assert.deepEqual(s.snapshot(),saved);}
});
test('sub-one budgets keep integer damage and conserve fractional overshoot',()=>{
  const c=config({incomingApm:.1}),s=new AttackSource(c);let sum=0;
  for(let f=0;f<60000;f++){const e=s.next(f,c,0);if(e?.amount){assert.equal(e.amount,1);sum++;}assert.ok(sum<=f*c.incomingApm/3600+1+1e-7);}
  assert.ok(sum>0);assert.equal(ATTACK_PACING.version,'rolling-split-1');
});
test('budget readout uses recorded attacks, so live and replay match without sender simulation',()=>{
  const c=config({incomingApm:20,gravity:0,cancelCorrection:false,targetingGrace:false}),s=new Session(c);s.start();
  for(let i=0;i<7200&&s.status==='running';i++)s.tick();s.stop();
  const recent=s.incoming.filter(e=>e.frame>s.frame-3600&&e.frame<=s.frame).reduce((n,e)=>n+e.amount,0);
  assert.equal(s.summary().recentGenerated,recent);assert.equal(s.summary().remainingBudget,Math.max(0,20-recent));
  const file=s.exportReplay();assert.equal(file.spilink.attackSource.virtualSenders,false);assert.equal(file.spilink.attackSource.windowFrames,3600);
  const data=inspectJson(new TextEncoder().encode(JSON.stringify(file)));assert.ok(data.session);
  const replay=new Session(data.session.config,data.session.source);replay.start();for(let i=0;i<s.ticks+1&&replay.status==='running';i++)replay.tick();
  assert.equal(replay.replayMismatch,false);assert.equal(replay.summary().recentGenerated,recent);
  assert.ok(file.replay.events.filter(e=>e.type==='ige').every(e=>(e.data as any).type!=='targeted'));
});
test('previous paced-source v3 replays still run only their actual recorded integer attacks',()=>{
  const s=new Session(config({incomingApm:0,initialPending:8}));s.start();for(let i=0;i<40;i++)s.tick();s.stop();
  const file:any=s.exportReplay();file.spilink.attackSource={version:'paced-1',rateUnit:'raw-damage-per-minute'};
  const parsed=inspectJson(new TextEncoder().encode(JSON.stringify(file)));assert.ok(parsed.session);
  const r=new Session(parsed.session.config,parsed.session.source);r.start();for(let i=0;i<s.ticks;i++)r.tick();assert.equal(r.replayMismatch,false);
});
