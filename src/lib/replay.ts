import { AppError } from './errors.ts';
import type { Session, ReplaySource } from './session.ts';
import { validateConfig, type Config } from './config.ts';
import type { KeyFrame } from './port.ts';
export type SavedReplay = ReturnType<Session['exportReplay']>;
export type ReplayFile = {kind:'ttr'|'ttrm';bytes:Uint8Array;name:string;streams:number;events:number;username:string;session?:{config:Config;source:ReplaySource}};
const LIMIT=32*1024*1024, EVENT_LIMIT=500000;
const keys=new Set(['moveLeft','moveRight','softDrop','hardDrop','rotateCW','rotateCCW','rotate180','hold']);
function record(v:unknown):v is Record<string,any>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
function integer(v:unknown,max:number):v is number{return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;}
export function inspectJson(bytes:Uint8Array,name='replay.ttr'):ReplayFile{
  if(bytes.byteLength>LIMIT)throw new AppError('error.fileSize');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
  // Bound nesting before JSON.parse, without evaluating user-controlled code.
  let depth=0,inString=false,escape=false;
  for(const c of text){if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;}else if(c==='"')inString=true;else if(c==='{'||c==='['){if(++depth>80)throw new AppError('error.depth');}else if(c==='}'||c===']')depth--;}
  const value:unknown=JSON.parse(text);if(!record(value)||!record(value.replay))throw new AppError('error.structure');
  if(value.version!==1)throw new AppError('error.version');
  let streams:Record<string,any>[]=[];
  if(Array.isArray(value.replay.events))streams=[value.replay];
  else if(Array.isArray(value.replay.rounds)){
    const stack:unknown[]=[...value.replay.rounds];let visited=0;
    while(stack.length){if(++visited>100000)throw new AppError('error.structureSize');const item=stack.pop();if(Array.isArray(item))stack.push(...item);else if(record(item)){if(Array.isArray(item.events))streams.push(item);else stack.push(...Object.values(item));}}
  }
  if(!streams.length)throw new AppError('error.streams');
  let events=0;
  for(const stream of streams){if((events+=stream.events.length)>EVENT_LIMIT)throw new AppError('error.eventsLimit');let previous=-1;
    for(const event of stream.events){if(!record(event)||!integer(event.frame,5184000)||event.frame<previous||typeof event.type!=='string'||!record(event.data))throw new AppError('error.events');previous=event.frame;
      if(event.type==='keydown'||event.type==='keyup'){if(!integer(Math.round(event.data.subframe*10),9)||!Number.isFinite(event.data.subframe)||event.data.subframe<0||event.data.subframe>=1||typeof event.data.key!=='string')throw new AppError('error.inputTime');}}
  }
  const result:ReplayFile={kind:streams.length===1&&!value.replay.rounds?'ttr':'ttrm',bytes:new Uint8Array(bytes),name,streams:streams.length,events,username:String(value.users?.[0]?.username??'—').slice(0,32)};
  if(result.kind==='ttr'&&record(value.spilink)&&value.spilink.version===2&&value.spilink.profile==='practice-2'){
    const m=value.spilink,config=validateConfig(m.settings);
    if(!integer(streams[0].frames,5184000)||!integer(m.ticks,5184000)||!Array.isArray(m.attacks)||m.attacks.length>100000||!Array.isArray(m.changes)||m.changes.length>10000)throw new AppError('error.metadata');
    const input=streams[0].events.filter((e:Record<string,any>)=>e.type==='keydown'||e.type==='keyup') as KeyFrame[];
    if(input.some(e=>!keys.has(e.data.key)||e.frame>streams[0].frames))throw new AppError('error.input');
    let frame=-1;
    for(const e of m.attacks){if(!record(e)||!integer(e.frame,5184000)||e.frame<frame||e.frame>streams[0].frames||!integer(e.amount,10000)||!integer(e.source,100000)||typeof e.assisted!=='boolean'||(e.altitude!==undefined&&(!Number.isFinite(e.altitude)||e.altitude<0||e.altitude>100000)))throw new AppError('error.attacks');frame=e.frame;}
    let tick=-1;
    for(const e of m.changes){if(!record(e)||!integer(e.tick,m.ticks)||!integer(e.frame,5184000)||e.tick<tick)throw new AppError('error.changes');e.config=validateConfig(e.config);tick=e.tick;}
    result.session={config,source:{keys:input,attacks:m.attacks,changes:m.changes,ticks:m.ticks,endFrame:streams[0].frames}};
  }
  return result;
}
export function preflightTtrx(input:Uint8Array):void {
  if(input.byteLength<72||input.byteLength>LIMIT)throw new AppError('error.ttrxSize');
  const view=new DataView(input.buffer,input.byteOffset,input.byteLength);
  if(new TextDecoder().decode(input.subarray(0,4))!=='TTRX'||input[4]!==1||input[5]!==0||input[6]!==1||view.getUint16(10,true)!==72)throw new AppError('error.ttrxFormat');
  if(view.getBigUint64(16,true)>BigInt(LIMIT)||view.getBigUint64(24,true)!==BigInt(input.byteLength-72)||view.getBigUint64(40,true)>1000000n||view.getBigUint64(48,true)>1000000n||view.getBigUint64(56,true)>2000000n||view.getUint32(64,true)>80)throw new AppError('error.ttrxLimits');
}
export async function readReplay(file:File):Promise<ReplayFile>{
  if(file.size>LIMIT)throw new AppError('error.fileSize');
  const input=new Uint8Array(await file.arrayBuffer());
  if(/\.ttrx$/i.test(file.name)){
    preflightTtrx(input);const codec=await import('tetr-ttrx');const source=codec.decode_ttrx(input);
    return inspectJson(source,file.name.replace(/\.ttrx$/i,'.'+codec.ttrx_source_extension(input)));
  }
  return inspectJson(input,file.name);
}
export function downloadBytes(bytes:Uint8Array,name:string):void{
  const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type:name.endsWith('.ttrx')?'application/octet-stream':'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function downloadReplay(replay:SavedReplay,format:'ttr'|'ttrx'):Promise<void>{
  const source=new TextEncoder().encode(JSON.stringify(replay));inspectJson(source);
  const bytes=format==='ttrx'?(await import('tetr-ttrx')).encode_ttr(source):source;
  downloadBytes(bytes,`spilink-${replay.spilink.settings.seed}-${replay.spilink.summary.pieces}.${format}`);
}
export async function convertImported(file:ReplayFile,format:'source'|'ttrx'):Promise<void>{
  const c=format==='ttrx'?await import('tetr-ttrx'):null;
  const bytes=c?(file.kind==='ttrm'?c.encode_ttrm(file.bytes):c.encode_ttr(file.bytes)):file.bytes;
  downloadBytes(bytes,file.name.replace(/\.(ttrx|ttrm|ttr|json)$/i,'')+'.'+(c?'ttrx':file.kind));
}
