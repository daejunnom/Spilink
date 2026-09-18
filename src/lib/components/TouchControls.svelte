<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, translation } from '../i18n/store';
  import type { MessageKey } from '../i18n/index';
  import { touchTranslator } from '../touch/messages';
  import { TOUCH_ACTIONS, TOUCH_GLYPHS, buttonPoint, effectiveButtonSize, normalizePoint, type TouchPreferences, type TouchAction, type Orientation, type Point } from '../touch/model';
  export let preferences:TouchPreferences;
  export let orientation:Orientation='portrait';
  export let editing=false;
  export let active=false;
  export let onPress:(action:TouchAction,owner:string,time:number)=>void;
  export let onRelease:(owner:string,time:number)=>void;
  export let onMove:(action:TouchAction,point:Point)=>void;
  let area:HTMLDivElement,width=300,height=132;
  let held=new Map<number,TouchAction>();
  let drag:{id:number;action:TouchAction;dx:number;dy:number}|null=null;
  $: tt=touchTranslator($locale);
  $: size=effectiveButtonSize(preferences.size,width,height);
  $: if(!active||editing)releaseAll();
  function releaseAll(){for(const id of held.keys())onRelease(String(id),performance.now());held=new Map();}
  function down(event:PointerEvent,action:TouchAction){
    if(event.pointerType==='mouse'&&event.button!==0)return;event.preventDefault();
    const button=event.currentTarget as HTMLButtonElement;
    if(editing){if(drag)return;const box=button.getBoundingClientRect();drag={id:event.pointerId,action,dx:event.clientX-box.left,dy:event.clientY-box.top};}
    else{if(!active||held.has(event.pointerId))return;held.set(event.pointerId,action);held=new Map(held);onPress(action,String(event.pointerId),event.timeStamp);}
    try{button.setPointerCapture(event.pointerId);}catch{finish(event);}
  }
  function move(event:PointerEvent){if(!drag||drag.id!==event.pointerId)return;event.preventDefault();const box=area.getBoundingClientRect();onMove(drag.action,normalizePoint(event.clientX-box.left-drag.dx,event.clientY-box.top-drag.dy,width,height,size));}
  function finish(event:PointerEvent){if(drag?.id===event.pointerId)drag=null;if(held.has(event.pointerId)){held.delete(event.pointerId);held=new Map(held);onRelease(String(event.pointerId),event.timeStamp);}}
  function accessibilityClick(event:MouseEvent,action:TouchAction){if(event.detail!==0||editing||!active)return;const owner='accessible:'+action;onPress(action,owner,performance.now());onRelease(owner,performance.now());}
  onMount(()=>{const resize=()=>{releaseAll();drag=null;const box=area.getBoundingClientRect();width=box.width;height=box.height;};const observer=new ResizeObserver(resize);observer.observe(area);resize();return()=>{observer.disconnect();releaseAll();};});
</script>
<div class="touch-layer" class:editing bind:this={area} data-testid="touch-controls" role="group" aria-label={tt('title')}>
  {#each TOUCH_ACTIONS as action}
    {@const position=buttonPoint(action,preferences,orientation,width,height,size)}
    <button class="touch-key" class:held={[...held.values()].includes(action)} data-testid={`touch-${action}`} data-touch-control
      type="button" disabled={!active&&!editing} aria-label={$translation(('action.'+action) as MessageKey)} title={$translation(('action.'+action) as MessageKey)}
      style={`left:${position.x*Math.max(0,width-size)}px;top:${position.y*Math.max(0,height-size)}px;width:${size}px;height:${size}px;--touch-opacity:${preferences.opacity}`}
      on:pointerdown={e=>down(e,action)} on:pointermove={move} on:pointerup={finish} on:pointercancel={finish} on:lostpointercapture={finish}
      on:contextmenu|preventDefault on:click={e=>accessibilityClick(e,action)}>{TOUCH_GLYPHS[action]}</button>
  {/each}
</div>
<style>
  .touch-layer{min-width:0;min-height:0;position:relative;pointer-events:none;z-index:3;grid-column:1;grid-row:3;}
  .touch-key{position:absolute;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;padding:0;border:1px solid #9bb8c6;border-radius:12px;background:rgb(33 53 69 / var(--touch-opacity));color:#eff9ff;font-weight:650;font-size:22px;line-height:1;}
  .touch-key.held{background:rgb(91 152 136 / var(--touch-opacity));border-color:#bef6e1;}
  .touch-key:disabled{opacity:.5}.editing .touch-key{border-style:dashed;cursor:move;background:#3b514e;opacity:1;}
  :global(.touch-landscape) .touch-layer{grid-row:2;}
</style>
