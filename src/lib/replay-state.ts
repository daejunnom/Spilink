import type { Session } from './session.ts';
export type ReplayEndState = {
  frame:number; ticks:number; status:'topout'|'completed'|'stopped'; board:(string|null)[][];
  hold:string|null; holdLocked:boolean; piece:string; x:number; y:number; rotation:number;
  pieces:number; attack:number; received:number; risen:number; cancelled:number;
};
export function captureReplayEnd(s:Session):ReplayEndState {
  return {frame:s.frame,ticks:s.ticks,status:s.status==='topout'?'topout':s.status==='completed'?'completed':'stopped',
    board:s.engine.board.state.map(row=>row.map(cell=>cell?.mino??null)),hold:s.engine.held,holdLocked:s.engine.holdLocked,
    piece:s.engine.falling.symbol,x:s.engine.falling.x,y:s.engine.falling.location[1],rotation:s.engine.falling.rotation,
    pieces:s.measure.pieces,attack:s.measure.attack,received:s.receiver.received,risen:s.receiver.risen,cancelled:s.receiver.cancelled};
}
export function validReplayEnd(value:unknown):value is ReplayEndState {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>, pieces=['i','j','l','o','s','t','z','i5'];
  if(!['topout','completed','stopped'].includes(String(v.status))||typeof v.holdLocked!=='boolean'||(v.hold!==null&&!pieces.includes(String(v.hold)))||!pieces.includes(String(v.piece)))return false;
  if(!Array.isArray(v.board)||v.board.length!==40||v.board.some(row=>!Array.isArray(row)||row.length!==10||row.some(tile=>tile!==null&&!pieces.concat('gb','gbd').includes(tile))))return false;
  for(const k of ['frame','ticks','pieces','attack','received','risen','cancelled'])if(typeof v[k]!=='number'||!Number.isSafeInteger(v[k])||v[k]<0||v[k]>1e9)return false;
  for(const k of ['x','y','rotation'])if(typeof v[k]!=='number'||!Number.isFinite(v[k])||Math.abs(v[k])>100)return false;
  return Number.isInteger(v.rotation) && (v.rotation as number) >= 0 && (v.rotation as number) < 4;
}
export function sameReplayEnd(actual:ReplayEndState,expected:ReplayEndState):boolean {
  return (Object.keys(actual) as (keyof ReplayEndState)[]).every(key=>JSON.stringify(actual[key])===JSON.stringify(expected[key]));
}
