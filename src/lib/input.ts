import { InputOwners } from './touch/owners.ts';
import type { Bindings, Command } from './config.ts';
import type { GameKey, KeyFrame } from './port.ts';
const STEP=1000/60;
export function bindingCode(e:Pick<KeyboardEvent,'code'|'ctrlKey'|'altKey'|'shiftKey'|'metaKey'>):string{
  return [e.ctrlKey&&!e.code.startsWith('Control')?'Control':'',e.altKey&&!e.code.startsWith('Alt')?'Alt':'',e.shiftKey&&!e.code.startsWith('Shift')?'Shift':'',e.metaKey&&!e.code.startsWith('Meta')?'Meta':'',e.code].filter(Boolean).join('+');
}
export class Keyboard {
  private owners=new InputOwners();
  pressed=new Map<string,GameKey>();queued:KeyFrame[]=[];physical=new Set<string>();
  private bindings:Bindings;private clock:()=>{frame:number;origin:number;active:boolean};private command:(key:Command)=>void;
  constructor(bindings:Bindings,clock:Keyboard['clock'],command:Keyboard['command']){this.bindings=bindings;this.clock=clock;this.command=command;}
  private stamp(type:KeyFrame['type'],key:GameKey,timestamp:number):KeyFrame{
    const c=this.clock(),time=Math.max(0,Math.floor((Math.min(performance.now(),timestamp)-c.origin)/STEP*10));
    return{frame:c.frame+Math.floor(time/10),type,data:{key,subframe:time%10/10}};
  }
  down=(e:KeyboardEvent):void=>{
    if(e.target instanceof Element&&e.target.closest('input,select,textarea,button,dialog,[contenteditable=true],[role=dialog]'))return;
    if(e.repeat||this.physical.has(e.code))return;
    const chord=bindingCode(e);
    const entry=Object.entries(this.bindings).find(([,code])=>code===chord)??(!e.ctrlKey&&!e.altKey&&!e.metaKey?Object.entries(this.bindings).find(([,code])=>code===e.code):undefined);
    if(!entry)return;this.physical.add(e.code);const key=entry[0] as keyof Bindings;
    if(key==='pause'||key==='retry'||key==='undo'||key==='redo'){e.preventDefault();this.command(key);return;}
    if(!this.clock().active)return;e.preventDefault();this.pressed.set(e.code,key);if(this.owners.press('keyboard:'+e.code,key))this.queued.push(this.stamp('keydown',key,e.timeStamp));
  };
  up=(e:KeyboardEvent):void=>{this.physical.delete(e.code);const key=this.pressed.get(e.code);if(!key)return;this.pressed.delete(e.code);e.preventDefault();const released=this.owners.release('keyboard:'+e.code);if(released)this.queued.push(this.stamp('keyup',released,e.timeStamp));};
  hoist():void{const {frame,active}=this.clock();if(!active)return;for(const code of this.physical){const entry=Object.entries(this.bindings).find(([,v])=>v===code);if(entry&& !['pause','retry','undo','redo'].includes(entry[0])){const key=entry[0] as GameKey;this.pressed.set(code,key);if(this.owners.press('keyboard:'+code,key))this.queued.push({frame,type:'keydown',data:{key,subframe:0,hoisted:true}});}}}
  release():void{const {frame}=this.clock();this.queued=[];for(const key of this.owners.clear())this.queued.push({frame,type:'keyup',data:{key,subframe:0}});this.pressed.clear();this.physical.clear();}
  virtualDown(key:GameKey,owner:string,timestamp=performance.now()):void{if(this.clock().active&&this.owners.press('pointer:'+owner,key))this.queued.push(this.stamp('keydown',key,timestamp));}
  virtualUp(owner:string,timestamp=performance.now()):void{const key=this.owners.release('pointer:'+owner);if(key)this.queued.push(this.stamp('keyup',key,timestamp));}
  pull(frame:number):KeyFrame[]{const out=this.queued.filter(e=>e.frame<=frame).map(e=>e.frame<frame?{...e,frame,data:{...e.data,subframe:0}}:e);this.queued=this.queued.filter(e=>e.frame>frame);return out.sort((a,b)=>a.data.subframe-b.data.subframe);}
  attach():()=>void{window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);return()=>{window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);};}
}
