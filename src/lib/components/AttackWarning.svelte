<script lang="ts">
  import { translation } from '../i18n/store';
  import { windupView, type WindupNotice } from '../windup';
  export let notices: WindupNotice[] = [];
  export let frame = 0;
  export let visible = true;
  $: warning = visible ? windupView(notices, frame) : null;
</script>
<div class="attack-warning-slot" data-testid="attack-warning-slot" role="status" aria-live="polite" aria-atomic="true">
  {#if warning}
    <strong class="attack-warning" class:fading={warning.fading} data-testid="attack-warning" data-level={warning.level}
      data-notice={warning.id} style:color={warning.color}
      title={$translation('pressure.warning', { level: warning.level, amount: warning.amount })}>
      <span aria-hidden="true">{warning.glyph}</span>
      <span class="sr-only">{$translation('pressure.warning', { level: warning.level, amount: warning.amount })}</span>
    </strong>
  {/if}
</div>
<style>
  .attack-warning-slot{position:absolute;top:0;left:0;right:0;height:30px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:4}
  .attack-warning{font-family:Arial,sans-serif;font-size:28px;line-height:1;font-weight:900;letter-spacing:1px;text-shadow:0 1px 3px #000;opacity:1}
  .attack-warning.fading{opacity:.5}
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style>
