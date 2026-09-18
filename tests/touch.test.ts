import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTouchPreferences,validateTouchPreferences,touchDetected,touchVisible,normalizePoint,buttonPoint,effectiveButtonSize,TOUCH_ACTIONS } from '../src/lib/touch/model.ts';
import { InputOwners } from '../src/lib/touch/owners.ts';
import { Keyboard } from '../src/lib/input.ts';
import { DEFAULT_CONFIG } from '../src/lib/config.ts';
import { Session } from '../src/lib/session.ts';
test('touch automatic detection and explicit mode are independent of keyboard capability',()=>{
  assert.equal(touchDetected(5,true),true);assert.equal(touchDetected(0,true),false);assert.equal(touchDetected(5,false),false);
  assert.equal(touchVisible('auto',true),true);assert.equal(touchVisible('auto',false),false);assert.equal(touchVisible('on',false),true);assert.equal(touchVisible('off',true),false);
});
test('touch layout validation copies only finite, bounded own coordinates',()=>{
  const value=defaultTouchPreferences();value.layouts.portrait.moveLeft={x:.2,y:.8};const copy=validateTouchPreferences(value);copy.layouts.portrait.moveLeft!.x=.7;assert.equal(value.layouts.portrait.moveLeft.x,.2);
  for(const x of [NaN,Infinity,-1,1.1])assert.throws(()=>validateTouchPreferences({...value,layouts:{portrait:{moveLeft:{x,y:0}},landscape:{}}}));
  for(const size of [43,81,NaN])assert.throws(()=>validateTouchPreferences({...value,size}));
  assert.throws(()=>validateTouchPreferences({...value,version:2}));
});
test('touch layout defaults fit portrait and landscape without overlap',()=>{
  for(const [w,h,o] of [[300,132,'portrait'],[647,233,'landscape'],[824,248,'landscape']] as const){const p=defaultTouchPreferences(),s=effectiveButtonSize(p.size,w,h);
    const rects=TOUCH_ACTIONS.map(a=>{const v=buttonPoint(a,p,o,w,h,s);return{x:v.x*(w-s),y:v.y*(h-s)};});
    for(const r of rects){assert.ok(r.x>=0&&r.y>=0&&r.x+s<=w&&r.y+s<=h);}
    for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++)assert.ok(Math.abs(rects[a].x-rects[b].x)>=s||Math.abs(rects[a].y-rects[b].y)>=s);
  }
});
test('layout drag stays inside viewport and preserves other orientation',()=>{
  assert.deepEqual(normalizePoint(-50,999,300,132,56),{x:0,y:1});const p=defaultTouchPreferences();p.layouts.portrait.moveLeft={x:.5,y:.3};assert.deepEqual(buttonPoint('moveLeft',p,'portrait',300,132,56),{x:.5,y:.3});assert.notDeepEqual(buttonPoint('moveLeft',p,'landscape',700,240,56),{x:.5,y:.3});
});
test('multiple fingers and keyboard share action ownership without duplicate or premature release',()=>{
  const o=new InputOwners();assert.equal(o.press('keyboard:left','moveLeft'),true);assert.equal(o.press('touch:1','moveLeft'),false);assert.equal(o.press('touch:2','rotateCW'),true);
  assert.equal(o.release('touch:1'),null);assert.equal(o.has('moveLeft'),true);assert.equal(o.release('keyboard:left'),'moveLeft');assert.equal(o.release('touch:2'),'rotateCW');assert.equal(o.release('touch:2'),null);
});
test('input cancellation releases each action once even with multiple owners',()=>{
  const o=new InputOwners();o.press('1','softDrop');o.press('2','softDrop');o.press('3','moveRight');assert.deepEqual(o.clear(),['softDrop','moveRight']);assert.deepEqual(o.clear(),[]);
});
test('virtual inputs produce frame/subframe key events, block paused presses, and clean release',()=>{
  let active=true;const k=new Keyboard(DEFAULT_CONFIG.bindings,()=>({frame:0,origin:performance.now(),active}),()=>{});
  k.virtualDown('moveLeft','1');k.virtualDown('moveLeft','2');k.virtualUp('1');let events=k.pull(0);assert.equal(events.length,1);assert.equal(events[0].type,'keydown');
  k.virtualUp('2');assert.equal(k.pull(0)[0].type,'keyup');active=false;k.virtualDown('hardDrop','3');assert.deepEqual(k.pull(0),[]);
  active=true;k.virtualDown('softDrop','4');k.pull(0);k.release();assert.equal(k.pull(0)[0].type,'keyup');k.virtualUp('4');assert.deepEqual(k.pull(0),[]);
});
test('touch actions recorded by the shared input path replay to the same board',()=>{
  const c={...DEFAULT_CONFIG,incomingApm:0,gravity:0,startGrace:0,safelock:false};const s=new Session(c);s.start();
  const k=new Keyboard(c.bindings,()=>({frame:s.frame,origin:performance.now(),active:s.status==='running'}),()=>{});
  k.virtualDown('moveLeft','a');s.tick(k.pull(s.frame));k.virtualUp('a');k.virtualDown('rotateCW','b');k.virtualUp('b');s.tick(k.pull(s.frame));k.virtualDown('hardDrop','c');k.virtualUp('c');s.tick(k.pull(s.frame));s.stop();
  assert.equal(s.measure.pieces,1);const r=new Session(c,s.replaySource());r.start();for(let i=0;i<s.ticks+1&&r.status==='running';i++)r.tick();assert.deepEqual(r.engine.board.state,s.engine.board.state);assert.equal(r.measure.pieces,s.measure.pieces);
});
