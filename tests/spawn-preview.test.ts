import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '../src/lib/session.ts';
import {DEFAULT_CONFIG,validateConfig,type Config} from '../src/lib/config.ts';
import {BOARD_VIEW,BOARD_ASPECT,boardScreenY} from '../src/lib/board-view.ts';
import {drawBoard} from '../src/lib/renderer.ts';
const config=(p:Partial<Config>={})=>validateConfig({...DEFAULT_CONFIG,gravity:0,incomingApm:0,safelock:false,lockTime:3600,...p});
const map=(cells:[number,number][])=>{const b=Array.from({length:40},()=>Array(10).fill('.'));for(const[x,y]of cells)b[y][x]='G';return b.reverse().map(r=>r.join('')).join('\n');};
const roof:[[number,number],[number,number]]=[[4,20],[5,20]];
test('display extension contains the whole spawn of every supported mino without changing the field',()=>{
  const s=new Session(config());assert.equal(s.engine.board.height,20);assert.equal(s.engine.board.fullHeight,40);assert.equal(BOARD_ASPECT,2.4);
  for(const p of ['i','j','l','o','s','t','z','i5'] as const){s.engine.initiatePiece(p);for(const[,y]of s.engine.falling.absoluteBlocks){assert.ok(y<BOARD_VIEW.rows);assert.ok(boardScreenY(y,10)>=0);}}
});
test('legal ghost placement over a roof warns on the next O spawn',()=>{
  const s=new Session(config({initialQueue:'OO',initialBoard:map(roof)}));s.start();assert.equal(s.engine.toppedOut,false);
  const p=s.spawnWarning()!;assert.equal(p.blocked,true);assert.deepEqual(p.overlap,s.ghost());assert.equal(p.overlap.length,4);
});
test('line clears remove disappearing ghost cells from the warning',()=>{
  const cells:[number,number][]=[];for(let x=0;x<10;x++){if(x<3||x>6)cells.push([x,21]);else cells.push([x,20]);}
  const s=new Session(config({initialQueue:'IO',initialBoard:map(cells)}));s.start();const p=s.spawnWarning()!;
  assert.deepEqual(p.clearedRows,[21]);assert.equal(p.blocked,false);assert.deepEqual(p.overlap,[]);
});
test('clutch rescue and projected coordinates do not create misleading crosses',()=>{
  const cells:[number,number][]=[...roof];for(let x=0;x<10;x++)if(x!==4&&x!==5)cells.push([x,21]);
  for(const clutch of [false,true]){const s=new Session(config({initialQueue:'OO',initialBoard:map(cells),clutch}));s.start();const p=s.spawnWarning()!;
    assert.equal(p.blocked,!clutch);assert.deepEqual(p.overlap,clutch?[]:[[4,22],[5,22]]);
  }
});
test('preview does not clear permanent rows',()=>{
  const s=new Session(config({initialQueue:'OO'}));s.engine.board.state[0]=Array.from({length:10},()=>({mino:'gbd'}));
  assert.deepEqual(s.spawnWarning()!.clearedRows,[]);assert.equal(s.engine.board.state[0][0]?.mino,'gbd');
});
test('repeated visual projection never mutates engine, gravity, hold, supply, receiver or replay',()=>{
  const s=new Session(config({ihs:'hold',irs:'hold'}));s.start();s.engine.input.keys.hold=true;s.engine.input.keys.rotateCW=true;s.engine.dynamic.gravity.set(3);
  const before=structuredClone({snapshot:s.snapshot(),supply:s.supply.snapshot(),events:s.events,changes:s.changes,gravity:s.engine.dynamic.gravity.get()});
  const board=s.engine.board.state,falling=s.engine.falling,input=s.engine.input;
  for(let i=0;i<100;i++)s.spawnWarning();
  assert.deepEqual({snapshot:s.snapshot(),supply:s.supply.snapshot(),events:s.events,changes:s.changes,gravity:s.engine.dynamic.gravity.get()},before);
  assert.equal(s.engine.board.state,board);assert.equal(s.engine.falling,falling);assert.equal(s.engine.input,input);
});
test('preview is hidden when sleeping or terminal and invalid geometry cannot be projected',()=>{
  const s=new Session(config({are:5}));s.start();s.tick([{frame:0,type:'keydown',data:{key:'hardDrop',subframe:0}}]);assert.equal(s.spawnWarning(),null);
  s.stop();assert.equal(s.spawnWarning(),null);
  const invalid=new Session(config());invalid.engine.falling.location[0]=-10;assert.equal(invalid.spawnWarning(),null);
});
test('red crosses are fully opaque and rendered after the active piece',()=>{
  const s=new Session(config({initialQueue:'OO',initialBoard:map(roof)}));s.start();
  const operations:{kind:string;style:string;alpha:number}[]=[];const stack:{alpha:number;style:string}[]=[];
  const ctx={globalAlpha:1,strokeStyle:'',fillStyle:'',lineWidth:1,lineCap:'butt',
    save(){stack.push({alpha:this.globalAlpha,style:this.strokeStyle});},restore(){const v=stack.pop()!;this.globalAlpha=v.alpha;this.strokeStyle=v.style;},
    fillRect(){operations.push({kind:'fill',style:this.fillStyle,alpha:this.globalAlpha});},strokeRect(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){operations.push({kind:'stroke',style:this.strokeStyle,alpha:this.globalAlpha});}};
  const canvas={width:0,height:0,clientWidth:200,dataset:{} as Record<string,string>,getContext:()=>ctx};
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:{devicePixelRatio:1},configurable:true});
  try{drawBoard(canvas as unknown as HTMLCanvasElement,s);}finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
  assert.equal(canvas.height,480);assert.equal(canvas.dataset.spawnWarningCells,'4');
  const crosses=operations.filter(o=>o.style==='#ff4040');assert.equal(crosses.length,4);assert.ok(crosses.every(o=>o.alpha===1));assert.deepEqual(operations.slice(-4),crosses);
});
