<script lang="ts">
  import type { Config } from '../config';
  import { translation as t } from '../i18n/store';
  import { PRACTICE_TIMING_DEFAULTS, expertPhase } from '../rule-defaults';
  export let config: Config;
  $: earliest = config.garbageSpeed + 2 * (config.garbagePhase ?? expertPhase(config.floor));
</script>
<details class="timing-settings" data-testid="garbage-timing">
  <summary>{$t('garbage.timing')}</summary>
  <div class="fields">
    <label>{$t('garbage.flight')}<input data-testid="flight-frames" type="number" min="0" max="36000" step="1" bind:value={config.garbageSpeed}/></label>
    <label>{$t('garbage.phase')}<input data-testid="phase-frames" type="number" min="0" max="36000" step="1" value={config.garbagePhase??''} placeholder={String(expertPhase(config.floor))} on:input={e=>config={...config,garbagePhase:e.currentTarget.value===''?null:e.currentTarget.valueAsNumber}}/></label>
    <label>{$t('setup.garbageAre')}<input data-testid="rise-frames" type="number" min="1" max="300" step="1" bind:value={config.garbageAre}/></label>
    <label>{$t('setup.garbageAreBump')}<input data-testid="clear-delay-frames" type="number" min="0" max="300" step="1" bind:value={config.garbageAreBump}/></label>
  </div>
  <label class="toggle"><input type="checkbox" bind:checked={config.garbageQueue}/><span>{$t('setup.garbageQueue')}</span></label>
  <output data-testid="travel-total">{$t('garbage.minimum',{frames:earliest,seconds:(earliest/60).toFixed(3)})}</output>
  <p>{$t('garbage.timingHint')}</p>
  <button type="button" data-testid="reset-timing" on:click={()=>config={...config,...PRACTICE_TIMING_DEFAULTS}}>{$t('garbage.resetTiming')}</button>
</details>
