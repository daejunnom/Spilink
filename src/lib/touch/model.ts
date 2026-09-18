import type { GameKey } from '../port.ts';
export const TOUCH_ACTIONS = ['moveLeft','softDrop','moveRight','hardDrop','rotateCCW','rotate180','rotateCW','hold'] as const satisfies readonly GameKey[];
export type TouchAction = typeof TOUCH_ACTIONS[number];
export type Orientation = 'portrait' | 'landscape';
export type Point = { x:number; y:number };
export type TouchMode = 'auto' | 'on' | 'off';
export type TouchPreferences = { version:1; mode:TouchMode; size:number; opacity:number; layouts:Record<Orientation,Partial<Record<TouchAction,Point>>> };
export const TOUCH_STORAGE_KEY = 'spilink.touch.v1';
export const TOUCH_LIMITS = { minSize:44, maxSize:80, minOpacity:0.35, maxOpacity:1 } as const;
export const TOUCH_GLYPHS:Record<TouchAction,string>={moveLeft:'←',moveRight:'→',softDrop:'↓',hardDrop:'⇓',rotateCCW:'↶',rotateCW:'↷',rotate180:'180°',hold:'H'};
export function defaultTouchPreferences():TouchPreferences { return {version:1,mode:'auto',size:56,opacity:0.85,layouts:{portrait:{},landscape:{}}}; }
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateTouchPreferences(value:unknown):TouchPreferences {
  if(!record(value)||value.version!==1||!['auto','on','off'].includes(String(value.mode)))throw new Error('Invalid touch preferences');
  const {size,opacity,layouts}=value;
  if(typeof size!=='number'||!Number.isInteger(size)||size<TOUCH_LIMITS.minSize||size>TOUCH_LIMITS.maxSize||typeof opacity!=='number'||!Number.isFinite(opacity)||opacity<TOUCH_LIMITS.minOpacity||opacity>1||!record(layouts))throw new Error('Invalid touch preferences');
  const out=defaultTouchPreferences();out.mode=value.mode as TouchMode;out.size=size;out.opacity=opacity;
  for(const orientation of ['portrait','landscape'] as const){
    const source=layouts[orientation];if(!record(source))throw new Error('Invalid touch layout');
    for(const action of TOUCH_ACTIONS){const point=source[action];if(point===undefined)continue;
      if(!record(point)||typeof point.x!=='number'||typeof point.y!=='number'||!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>1||point.y<0||point.y>1)throw new Error('Invalid touch position');
      out.layouts[orientation][action]={x:point.x,y:point.y};
    }
  }
  return out;
}
export function touchDetected(maxTouchPoints:number,coarsePointer:boolean):boolean { return maxTouchPoints>0&&coarsePointer; }
export function touchVisible(mode:TouchMode,detected:boolean):boolean { return mode==='on'||mode==='auto'&&detected; }
export function orientationOf(width:number,height:number):Orientation { return width>height?'landscape':'portrait'; }
export function effectiveButtonSize(size:number,width:number,height:number):number {
  return Math.max(TOUCH_LIMITS.minSize,Math.min(size,Math.floor((width-24)/4),Math.floor((height-12)/2)));
}
export function buttonPoint(action:TouchAction,preferences:TouchPreferences,orientation:Orientation,width:number,height:number,size:number):Point {
  const stored=preferences.layouts[orientation][action];if(stored)return stored;
  const i=TOUCH_ACTIONS.indexOf(action),column=i%4,row=Math.floor(i/4);
  if(orientation==='portrait')return{x:column/3,y:row};
  // Keep the board's centre clear; each side has two columns and two rows.
  const edge=(size+10)/Math.max(1,width-size);
  return{x:[0,Math.min(.45,edge),Math.max(.55,1-edge),1][column],y:row===0?.2:.8};
}
export function normalizePoint(x:number,y:number,width:number,height:number,size:number):Point {
  return{x:Math.min(1,Math.max(0,x/Math.max(1,width-size))),y:Math.min(1,Math.max(0,y/Math.max(1,height-size)))};
}
