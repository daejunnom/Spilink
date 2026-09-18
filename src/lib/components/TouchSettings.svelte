<script lang="ts">
  import {locale,translation} from '../i18n/store';
  import type {MessageKey} from '../i18n/index';
  import {touchTranslator} from '../touch/messages';
  import {TOUCH_ACTIONS,TOUCH_LIMITS,buttonPoint,defaultTouchPreferences,type TouchPreferences,type TouchAction,type Orientation} from '../touch/model';
  export let preferences:TouchPreferences;
  export let onChange:(next:TouchPreferences)=>void;
  export let onEdit:()=>void;
  export let orientation:Orientation='portrait';
  let editOrientation:Orientation=orientation;
  $: tt=touchTranslator($locale);
  function update(key:'mode'|'size'|'opacity',value:string|number){onChange({...preferences,[key]:value});}
  function move(action:TouchAction,axis:'x'|'y',value:number){if(!Number.isFinite(value)||value<0||value>100)return;const next=structuredClone(preferences);const current=point(action);next.layouts[editOrientation][action]={...current,[axis]:value/100};onChange(next);}
  function point(action:TouchAction){return buttonPoint(action,preferences,editOrientation,editOrientation==='portrait'?360:760,editOrientation==='portrait'?132:240,preferences.size);}
  function reset(){const next=structuredClone(preferences);next.layouts[editOrientation]=defaultTouchPreferences().layouts[editOrientation];onChange(next);}
</script>
<details class="touch-settings" data-testid="touch-settings">
  <summary>{tt('title')}</summary>
  <p>{tt('info')}</p>
  <label>{tt('mode')}<select data-testid="touch-mode" value={preferences.mode} on:change={e=>update('mode',e.currentTarget.value)}><option value="auto">{tt('auto')}</option><option value="on">{tt('on')}</option><option value="off">{tt('off')}</option></select></label>
  <label>{tt('size')} · {preferences.size}px<input data-testid="touch-size" type="range" min={TOUCH_LIMITS.minSize} max={TOUCH_LIMITS.maxSize} step="1" value={preferences.size} on:input={e=>update('size',Number(e.currentTarget.value))}/></label>
  <label>{tt('opacity')} · {Math.round(preferences.opacity*100)}%<input data-testid="touch-opacity" type="range" min="35" max="100" step="5" value={preferences.opacity*100} on:input={e=>update('opacity',Number(e.currentTarget.value)/100)}/></label>
  <button type="button" data-testid="touch-edit" on:click={onEdit}>{tt('edit')}</button>
  <details><summary>{tt('positions')}</summary>
    <label><select data-testid="touch-orientation" bind:value={editOrientation} aria-label={tt('positions')}><option value="portrait">{tt('portrait')}</option><option value="landscape">{tt('landscape')}</option></select></label>
    {#each TOUCH_ACTIONS as action}{@const position=buttonPoint(action,preferences,editOrientation,editOrientation==='portrait'?360:760,editOrientation==='portrait'?132:240,preferences.size)}
      <fieldset><legend>{$translation(('action.'+action) as MessageKey)}</legend><div class="position-fields">
        <label>{tt('x')}<input type="number" min="0" max="100" step="1" value={Math.round(position.x*100)} on:change={e=>move(action,'x',e.currentTarget.valueAsNumber)}/></label>
        <label>{tt('y')}<input type="number" min="0" max="100" step="1" value={Math.round(position.y*100)} on:change={e=>move(action,'y',e.currentTarget.valueAsNumber)}/></label>
      </div></fieldset>
    {/each}<button type="button" data-testid="touch-reset" on:click={reset}>{tt('reset')}</button>
  </details><p>{tt('saved')} {tt('fitted')}</p>
</details>
<style>.touch-settings{margin:14px 0}.position-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}fieldset{border:1px solid #354653;border-radius:5px;margin:8px 0;min-width:0}legend{font-size:12px}summary{cursor:pointer;padding:10px 0}label{display:grid;gap:6px;margin:10px 0}input,select{min-width:0;width:100%}</style>
