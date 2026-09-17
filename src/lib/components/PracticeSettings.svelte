<script lang="ts">
  import { bindingCode } from '../input';
  import { DEFAULT_CONFIG, type Bindings, type Config } from '../config';
  export let config: Config;
  export let disabled = false;
  let capture: keyof Bindings | null = null;
  let keyError = '';
  const actions: [keyof Bindings, string][] = [['moveLeft','왼쪽'],['moveRight','오른쪽'],['softDrop','소프트드롭'],['hardDrop','하드드롭'],['rotateCW','시계 회전'],['rotateCCW','반시계 회전'],['rotate180','180° 회전'],['hold','홀드'],['retry','다시 시작'],['pause','일시정지'],['undo','되돌리기'],['redo','다시 실행']];
  function captureKey(event: KeyboardEvent) {
    if (!capture || disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.code === 'Escape') { capture = null; return; }
    if (/^(Control|Alt|Meta)(Left|Right)$/.test(event.code)) return;
    const code = bindingCode(event);
    const owner = Object.entries(config.bindings).find(([key, code]) => key !== capture && code === bindingCode(event));
    if (owner) { keyError = '다른 동작에 지정된 키입니다. 먼저 해당 키를 변경하세요.'; return; }
    config = { ...config, bindings: { ...config.bindings, [capture]: code } };
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
        <label>가비지 캡<input data-testid="garbage-cap" type="number" min="1" max="40" step="1" bind:value={config.garbageCap} /></label>
        <label>공격 배율<input type="number" min="0" max="100" step="0.1" bind:value={config.attackMultiplier} /></label>
        <label>수신 배율<input type="number" min="0" max="100" step="0.1" bind:value={config.receiveMultiplier} /></label>
        <label>상쇄 배율<input type="number" min="1" max="100" step="0.1" bind:value={config.cancelMultiplier} /></label>
        <label>서지 충전 기준<input type="number" min="0" max="10" step="1" bind:value={config.chargeAt} /></label>
        <label>서지 기본 보너스<input type="number" min="0" max="10" step="1" bind:value={config.chargeBase} /></label>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={config.specialBonus} /><span>방해줄 특수 클리어 보너스</span></label>
    </details>
    <details><summary>진행·공급·상승 설정</summary>
      <label>플레이어명<input data-testid="player-name" maxlength="32" bind:value={config.playerName} /></label>
      <div class="fields">
        <label>미노 공급<select bind:value={config.bagType}><option value="7-bag">7-bag</option><option value="zenith">Zenith · 보정 공급</option></select></label>
        <label>스핀 규칙<select bind:value={config.spinBonuses}>{#each ['all-mini+','all+','all','all-mini','T-spins','T-spins+'] as value}<option {value}>{value}</option>{/each}</select></label>
        <label>상승 방식<select bind:value={config.garbageEntry}><option value="instant">즉시</option><option value="delayed">지연</option><option value="continuous">연속</option></select></label>
        <label>공격 반올림<select bind:value={config.roundMode}><option value="down">내림</option><option value="rng">난수 반올림</option></select></label>
      </div>
      {#each [
        ['progression','고도·층 진행'],['cancelCorrection','상쇄 누적 수신 보정'],['targetingGrace','타게팅 유예 보정'],['timeCancelFatigue','시간에 따른 상쇄 피로'],['fatigue','시간 피로·영구 방해줄'],['garbageQueue','공격 단계별 대기'],['noSameHole','같은 구멍 열 제외'],['attackIncrease','시간에 따라 공격 배율 증가'],['receiveIncrease','시간에 따라 수신 배율 증가'],['lockDecrease','시간에 따라 락 딜레이 감소']
      ] as [key,label]}<label class="toggle"><input type="checkbox" checked={Boolean(config[key as keyof Config])} on:change={e=>config={...config,[key]:e.currentTarget.checked}} /><span>{label}</span></label>{/each}
      <div class="fields">
        {#each [
          ['altitude','고도 · 비우면 층 기준',0,100000,0.1],['senderAltitude','발신 고도 · 비우면 동일',0,100000,0.1],['garbagePhase','단계 대기 · 비우면 층 기준',0,36000,1],
          ['garbageSpeed','공격 비행 프레임',0,36000,1],['absoluteCap','대기 절대 상한 · 0=없음',0,10000,1],['are','배치 후 대기',0,300,1],['lineClearAre','클리어 후 대기',0,300,1],['garbageAre','상승 간격',1,300,1],['garbageAreBump','클리어 상승 지연',0,300,1],
          ['messinessInner','내부 재추첨 · 비우면 자동',0,10,0.01],['messinessChange','경계 재추첨 · 비우면 자동',0,10,0.01],['garbageFavor','열 가중치 · 비우면 자동',-1000,1000,1],
          ['attackCap','공격 상한 · 0=없음',0,10000,1],['allClearGarbage','All Clear 공격',0,10000,1],['allClearB2B','All Clear B2B',0,100,1],['initialPending','초기 대기 공격',0,1000,1],['startGrace','시작 중력 유예',0,36000,1],['maxDuration','시간 제한 · 초, 0=없음',0,86400,1],
          ['attackRate','공격 배율 증가/초',0,100,0.01],['receiveRate','수신 배율 증가/초',0,100,0.01],['lockRate','락 딜레이 감소/초',0,100,0.01],['lockMinimum','최소 락 딜레이',0,3600,1]
        ] as [key,label,min,max,step]}
          <label>{label}<input type="number" min={Number(min)} max={Number(max)} step={Number(step)} value={config[key as keyof Config] as number ?? ''} on:input={e=>config={...config,[key]:e.currentTarget.value===''?null:e.currentTarget.valueAsNumber}} /></label>
        {/each}
      </div>
      <label>초기 큐 · I J L O S T Z I5<input data-testid="initial-queue" bind:value={config.initialQueue} /></label>
      <label>초기 보드 · 위에서 아래, 각 줄 10칸<textarea rows="5" placeholder="..........&#10;GGGG.GGGGG" bind:value={config.initialBoard}></textarea></label>
      <p class="muted">빈칸은 . / 방해줄은 G / 영구 방해줄은 X입니다. 초기 큐·보드·공급·시드 변경은 새 연습에서 적용합니다.</p>
    </details>
    <label class="toggle"><input data-testid="ttrx-toggle" type="checkbox" bind:checked={config.ttrx} /><span>.ttrx 내보내기 허용<small>기본 .ttr 저장은 항상 제공</small></span></label>
  </fieldset>
  <p class="settings-note">설정 저장 후 새 연습을 시작하거나, 일시정지 상태에서 현재 연습에 적용하세요. 공격은 합성 모델입니다.</p>
</div>
