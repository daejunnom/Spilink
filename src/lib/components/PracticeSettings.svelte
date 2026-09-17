<script lang="ts">
  import { DEFAULT_CONFIG, type Bindings, type Config } from '../config';
  export let config: Config;
  export let disabled = false;
  let capture: keyof Bindings | null = null;
  let keyError = '';
  const actions: [keyof Bindings, string][] = [['moveLeft','왼쪽'],['moveRight','오른쪽'],['softDrop','소프트드롭'],['hardDrop','하드드롭'],['rotateCW','시계 회전'],['rotateCCW','반시계 회전'],['rotate180','180° 회전'],['hold','홀드'],['retry','다시 시작'],['pause','일시정지']];
  function captureKey(event: KeyboardEvent) {
    if (!capture || disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.code === 'Escape') { capture = null; return; }
    const owner = Object.entries(config.bindings).find(([key, code]) => key !== capture && code === event.code);
    if (owner) { keyError = '다른 동작에 지정된 키입니다. 먼저 해당 키를 변경하세요.'; return; }
    config = { ...config, bindings: { ...config.bindings, [capture]: event.code } };
    capture = null; keyError = '';
  }
</script>
<svelte:window on:keydown|capture={captureKey} />
<div class="panel settings-panel">
  <div class="panel-heading"><span class="eyebrow">PRACTICE SETUP</span><h2>내 연습 환경</h2></div>
  <fieldset {disabled}>
    <label class="toggle featured"><input data-testid="continue-toggle" type="checkbox" bind:checked={config.continueAfter400} /><span>400개 이후 계속 플레이<small>기본은 400번째 배치 후 종료</small></span></label>
    <div class="fields">
      <label>중력 <span>G</span><input data-testid="gravity" type="number" min="0" max="1000" step="0.001" bind:value={config.gravity} /></label>
      <label>기준 층<input type="number" min="1" max="10" step="1" bind:value={config.floor} /></label>
    </div>
    <label class="toggle"><input type="checkbox" bind:checked={config.gravityIncrease} /><span>시간에 따라 중력 증가</span></label>
    {#if config.gravityIncrease}<label>중력 증가율<input type="number" min="0" step="0.0001" bind:value={config.gravityRate} /></label>{/if}
    <div class="fields">
      <label>공격 수준 <span>APM</span><input data-testid="incoming-apm" type="number" min="0" max="2000" step="1" bind:value={config.incomingApm} /></label>
      <label>최대 생성 공격<input type="number" min="1" max="1000" step="1" bind:value={config.maxAttack} /></label>
      <label>시작 방해줄<input type="number" min="0" max="19" step="1" bind:value={config.initialGarbage} /></label>
      <label>시작 시드<input data-testid="seed" type="number" min="1" max="2147483646" step="1" bind:value={config.seed} /></label>
    </div>
    <label class="toggle"><input type="checkbox" bind:checked={config.pressureAssist} /><span>위험할 때 신규 공격 완화<small>이미 도착한 공격과 탑아웃은 그대로</small></span></label>
    <details>
      <summary>핸들링과 키 설정</summary>
      <div class="fields">
        <label>ARR <span>프레임</span><input type="number" min="0" max="5" step="0.1" bind:value={config.arr} /></label>
        <label>DAS <span>프레임</span><input type="number" min="1" max="20" step="0.1" bind:value={config.das} /></label>
        <label>DCD <span>프레임</span><input type="number" min="0" max="20" step="0.1" bind:value={config.dcd} /></label>
        <label>SDF <span>41 = 즉시</span><input type="number" min="5" max="41" step="1" bind:value={config.sdf} /></label>
        <label>락 딜레이 <span>프레임</span><input type="number" min="0" max="3600" step="1" bind:value={config.lockTime} /></label>
        <label>IRS<select bind:value={config.irs}><option value="off">OFF</option><option value="hold">HOLD</option><option value="tap">TAP</option></select></label>
        <label>IHS<select bind:value={config.ihs}><option value="off">OFF</option><option value="hold">HOLD</option><option value="tap">TAP</option></select></label>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={config.safelock} /><span>Safe Lock</span></label>
      <label class="toggle"><input type="checkbox" bind:checked={config.cancel} /><span>DAS 취소</span></label>
      <label class="toggle"><input type="checkbox" bind:checked={config.may20g} /><span>즉시 소프트드롭 이동 허용</span></label>
      <div class="key-grid">
        {#each actions as [key, label]}
          <button type="button" class="keybind" on:click={() => { capture = key; keyError = ''; }}><span>{label}</span><kbd>{capture === key ? '키 입력…' : config.bindings[key].replace('Key','').replace('Arrow','')}</kbd></button>
        {/each}
      </div>
      {#if capture}<p class="muted">변경할 키를 누르세요. Esc로 취소합니다.</p>{/if}
      {#if keyError}<p class="error-text" role="alert">{keyError}</p>{/if}
      <button type="button" class="quiet full" on:click={() => { config = { ...config, bindings: { ...DEFAULT_CONFIG.bindings } }; capture = null; }}>기본 키로 복원</button>
    </details>
    <details>
      <summary>고급 연습 설정</summary>
      <div class="fields">
        <label>첫 공격 대기 <span>프레임</span><input type="number" min="0" max="36000" step="1" bind:value={config.firstAttackFrames} /></label>
        <label>한 번의 상승 상한<input type="number" min="1" max="40" step="1" bind:value={config.garbageCap} /></label>
        <label>공격 배율<input type="number" min="0" max="100" step="0.1" bind:value={config.attackMultiplier} /></label>
        <label>수신 배율<input type="number" min="0" max="100" step="0.1" bind:value={config.receiveMultiplier} /></label>
        <label>상쇄 배율<input type="number" min="1" max="100" step="0.1" bind:value={config.cancelMultiplier} /></label>
        <label>서지 충전 기준<input type="number" min="0" max="10" step="1" bind:value={config.chargeAt} /></label>
        <label>서지 기본 보너스<input type="number" min="0" max="10" step="1" bind:value={config.chargeBase} /></label>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={config.specialBonus} /><span>방해줄 특수 클리어 보너스</span></label>
    </details>
    <label class="toggle"><input data-testid="ttrx-toggle" type="checkbox" bind:checked={config.ttrx} /><span>.ttrx 내보내기 허용<small>기본 .ttr 저장은 항상 제공</small></span></label>
  </fieldset>
  <p class="settings-note">설정은 새 연습을 시작할 때 적용됩니다. 이 미리보기는 7-bag와 합성 공격을 사용합니다.</p>
</div>
