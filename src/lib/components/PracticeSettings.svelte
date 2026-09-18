<script lang="ts">
  import GarbageTiming from './GarbageTiming.svelte';
  import { SEASON_TWO_PC } from '../rule-defaults';
  import { translation } from '../i18n/store';
  import { createTranslator } from '../i18n/index';
  import { KEY_ACTIONS, TOGGLE_FIELDS, NUMERIC_FIELDS } from '../settings-schema';
  let t=createTranslator('en');
  $: t=$translation;
  import { bindingCode } from '../input';
  import { DEFAULT_CONFIG, type Bindings, type Config } from '../config';
  export let config: Config;
  export let disabled = false;
  let capture: keyof Bindings | null = null;
  let keyError = '';

  function captureKey(event: KeyboardEvent) {
    if (!capture || disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.code === 'Escape') { capture = null; return; }
    if (/^(Control|Alt|Meta)(Left|Right)$/.test(event.code)) return;
    const code = bindingCode(event);
    const owner = Object.entries(config.bindings).find(([key, code]) => key !== capture && code === bindingCode(event));
    if (owner) { keyError = t('keys.duplicate'); return; }
    config = { ...config, bindings: { ...config.bindings, [capture]: code } };
    capture = null; keyError = '';
  }
</script>
<svelte:window on:keydown|capture={captureKey} />
<div class="panel settings-panel">
  <div class="panel-heading"><span class="eyebrow">PRACTICE SETUP</span><h2>{t('setup.title')}</h2></div>
  <fieldset {disabled}>
    <label class="toggle featured"><input data-testid="continue-toggle" type="checkbox" bind:checked={config.continueAfter400} /><span>{t('setup.continue')}<small>{t('setup.continueHint')}</small></span></label>
    <div class="fields">
      <label>{t('setup.gravity')} <span>G</span><input data-testid="gravity" type="number" min="0" max="1000" step="0.001" bind:value={config.gravity} /></label>
      <label>{t('setup.floor')}<input type="number" min="1" max="10" step="1" bind:value={config.floor} /></label>
    </div>
    <label class="toggle"><input type="checkbox" bind:checked={config.gravityIncrease} /><span>{t('setup.gravityIncrease')}</span></label>
    {#if config.gravityIncrease}<label>{t('setup.gravityRate')}<input type="number" min="0" step="0.0001" bind:value={config.gravityRate} /></label>{/if}
    <div class="fields">
      <label>{t('setup.incomingApm')} <span>APM</span><input data-testid="incoming-apm" type="number" min="0" max="2000" step="0.1" bind:value={config.incomingApm} /></label>
      <label>{t('setup.maxAttack')}<input type="number" min="1" max="1000" step="1" bind:value={config.maxAttack} /></label>
      <label>{t('setup.initialGarbage')}<input type="number" min="0" max="19" step="1" bind:value={config.initialGarbage} /></label>
      <label>{t('setup.seed')}<input data-testid="seed" readonly type="number" min="1" max="2147483646" step="1" bind:value={config.seed} /></label>
    </div>
    <p class="muted">{t('pressure.pacingHint')}</p>
    <label class="toggle"><input type="checkbox" bind:checked={config.pressureAssist} /><span>{t('setup.assist')}<small>{t('setup.assistHint')}</small></span></label>
    <GarbageTiming bind:config />
    <details>
      <summary>{t('setup.handling')}</summary>
      <div class="fields">
        <label>ARR <span>{t('unit.frames')}</span><input type="number" min="0" max="5" step="0.1" bind:value={config.arr} /></label>
        <label>DAS <span>{t('unit.frames')}</span><input type="number" min="1" max="20" step="0.1" bind:value={config.das} /></label>
        <label>DCD <span>{t('unit.frames')}</span><input type="number" min="0" max="20" step="0.1" bind:value={config.dcd} /></label>
        <label>SDF <span>{t('setup.instantSdf')}</span><input type="number" min="5" max="41" step="1" bind:value={config.sdf} /></label>
        <label>{t('setup.lockTime')} <span>{t('unit.frames')}</span><input type="number" min="0" max="3600" step="1" bind:value={config.lockTime} /></label>
        <label>IRS<select bind:value={config.irs}><option value="off">OFF</option><option value="hold">HOLD</option><option value="tap">TAP</option></select></label>
        <label>IHS<select bind:value={config.ihs}><option value="off">OFF</option><option value="hold">HOLD</option><option value="tap">TAP</option></select></label>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={config.safelock} /><span>Safe Lock</span></label>
      <label class="toggle"><input type="checkbox" bind:checked={config.cancel} /><span>{t('setup.cancel')}</span></label>
      <label class="toggle"><input type="checkbox" bind:checked={config.may20g} /><span>{t('setup.may20g')}</span></label>
      <div class="key-grid">
        {#each KEY_ACTIONS as [key, label]}
          <button type="button" class="keybind" on:click={() => { capture = key; keyError = ''; }}><span>{t(label)}</span><kbd>{capture === key ? t('keys.capture') : config.bindings[key].replace('Key','').replace('Arrow','')}</kbd></button>
        {/each}
      </div>
      {#if capture}<p class="muted">{t('keys.hint')}</p>{/if}
      {#if keyError}<p class="error-text" role="alert">{keyError}</p>{/if}
      <button type="button" class="quiet full" on:click={() => { config = { ...config, bindings: { ...DEFAULT_CONFIG.bindings } }; capture = null; }}>{t('keys.defaults')}</button>
    </details>
    <details>
      <summary>{t('setup.advanced')}</summary>
      <div class="fields">
        <label>{t('setup.firstAttackFrames')} <span>{t('unit.frames')}</span><input type="number" min="0" max="36000" step="1" bind:value={config.firstAttackFrames} /></label>
        <label>{t('setup.garbageCap')}<input data-testid="garbage-cap" type="number" min="1" max="40" step="1" bind:value={config.garbageCap} /></label>
        <label>{t('setup.attackMultiplier')}<input type="number" min="0" max="100" step="0.1" bind:value={config.attackMultiplier} /></label>
        <label>{t('setup.receiveMultiplier')}<input type="number" min="0" max="100" step="0.1" bind:value={config.receiveMultiplier} /></label>
        <label>{t('setup.cancelMultiplier')}<input type="number" min="1" max="100" step="0.1" bind:value={config.cancelMultiplier} /></label>
        <label>{t('setup.chargeAt')}<input type="number" min="0" max="10" step="1" bind:value={config.chargeAt} /></label>
        <label>{t('setup.chargeBase')}<input type="number" min="0" max="10" step="1" bind:value={config.chargeBase} /></label>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={config.specialBonus} /><span>{t('setup.specialBonus')}</span></label>
    </details>
    <details><summary>{t('setup.progressionGroup')}</summary>
      <label class="toggle"><input type="checkbox" bind:checked={config.clutch}/><span>{t('setup.clutch')}</span></label>
      <label class="toggle"><input type="checkbox" bind:checked={config.noLockout}/><span>{t('setup.noLockout')}</span></label>
      <p>{t('setup.noLockoutHint')}</p>
      <button type="button" data-testid="pc-rule" on:click={()=>config={...config,allClearB2B:SEASON_TWO_PC.allClearB2B}}>{t('setup.pcRule')}</button>
      <label>{t('setup.playerName')}<input data-testid="player-name" maxlength="32" bind:value={config.playerName} /></label>
      <div class="fields">
        <label>{t('setup.bagType')}<select bind:value={config.bagType}><option value="7-bag">7-bag</option><option value="zenith">{t('option.zenith')}</option></select></label>
        <label>{t('setup.spinBonuses')}<select bind:value={config.spinBonuses}>{#each ['all-mini+','all+','all','all-mini','T-spins','T-spins+'] as value}<option {value}>{value}</option>{/each}</select></label>
        <label>{t('setup.garbageEntry')}<select bind:value={config.garbageEntry}><option value="instant">{t('option.instant')}</option><option value="delayed">{t('option.delayed')}</option><option value="continuous">{t('option.continuous')}</option></select></label>
        <label>{t('setup.roundMode')}<select bind:value={config.roundMode}><option value="down">{t('option.down')}</option><option value="rng">{t('option.rng')}</option></select></label>
      </div>
      {#each TOGGLE_FIELDS as [key,label]}<label class="toggle"><input type="checkbox" checked={Boolean(config[key as keyof Config])} on:change={e=>config={...config,[key]:e.currentTarget.checked}} /><span>{t(label)}</span></label>{/each}
      <div class="fields">
        {#each NUMERIC_FIELDS as [key,label,min,max,step]}
          <label>{t(label)}<input type="number" min={Number(min)} max={Number(max)} step={Number(step)} value={config[key as keyof Config] as number ?? ''} on:input={e=>config={...config,[key]:e.currentTarget.value===''?null:e.currentTarget.valueAsNumber}} /></label>
        {/each}
      </div>
      <label>{t('setup.initialQueue')}<input data-testid="initial-queue" bind:value={config.initialQueue} /></label>
      <label>{t('setup.initialBoard')}<textarea rows="5" placeholder="..........&#10;GGGG.GGGGG" bind:value={config.initialBoard}></textarea></label>
      <p class="muted">{t('setup.boardHint')}</p>
    </details>
    <label class="toggle"><input data-testid="ttrx-toggle" type="checkbox" bind:checked={config.ttrx} /><span>{t('setup.ttrx')}<small>{t('setup.ttrxHint')}</small></span></label>
  </fieldset>
  <p class="settings-note">{t('setup.note')}</p>
</div>
