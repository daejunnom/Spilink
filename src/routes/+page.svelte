<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import '../app.css';
  import PracticeSettings from '$lib/components/PracticeSettings.svelte';
  import PiecePreview from '$lib/components/PiecePreview.svelte';
  import { DEFAULT_CONFIG, validateConfig, type Config } from '$lib/config';
  import { Session, type Status, type ReplaySource } from '$lib/session';
  import { Keyboard } from '$lib/input';
  import { drawBoard, previewCells } from '$lib/renderer';
  import { downloadReplay, type SavedReplay } from '$lib/replay';

  const STORAGE_KEY = 'spilink.settings.v1';
  const STEP = 1000 / 60;
  let draft = structuredClone(DEFAULT_CONFIG);
  let session: Session | null = null;
  let status: Status = 'ready';
  let stats: ReturnType<Session['summary']> | null = null;
  let canvas: HTMLCanvasElement;
  let surface: HTMLDivElement;
  let keyboard: Keyboard | null = null;
  let detach: (() => void) | undefined;
  let origin = 0;
  let lastPaint = 0;
  let mounted = false;
  let busy = false;
  let isReplay = false;
  let error = '';
  let notice = '';
  let pending = 0;
  let reserved = 0;
  let lastAction = 'READY';
  let lastAttack = 0;
  let assist = false;
  let holdCells: ReturnType<typeof previewCells> = [];
  let nextCells: ReturnType<typeof previewCells>[] = [];
  let packets: { id: number; amount: number; ready: boolean }[] = [];
  let lastReplay: { config: Config; source: ReplaySource; file: SavedReplay } | null = null;
  const statusNames: Record<Status, string> = { ready: '시작 준비', running: '연습 중', paused: '일시정지', completed: '400개 측정 완료', topout: '탑아웃', stopped: '세션 종료' };
  $: locked = status === 'running' || status === 'paused';
  $: progress = Math.min(100, (stats?.pieces ?? 0) / 4);

  function refresh() {
    if (!session) return;
    status = session.status; stats = session.summary();
    pending = session.receiver.size; reserved = session.receiver.reserved;
    lastAction = session.lastAction; lastAttack = session.lastAttack;
    assist = session.assistActive;
    holdCells = previewCells(session, session.engine.held);
    nextCells = Array.from(session.engine.queue).slice(0, 5).map(piece => previewCells(session, piece));
    packets = session.receiver.pending.map(p => ({ id: p.id, amount: p.amount, ready: p.status === 'spawn' }));
  }
  function remember() {
    if (!session || !session.ticks || session.playback) return;
    lastReplay = { config: structuredClone(session.config), source: session.replaySource(), file: session.exportReplay() };
  }
  function connectKeyboard() {
    detach?.();
    if (!session) return;
    keyboard = new Keyboard(session.config.bindings,
      () => ({ frame: session?.frame ?? 0, origin, active: session?.status === 'running' && !session?.playback }),
      action => { if (action === 'pause') togglePause(); else start(false); });
    detach = keyboard.attach();
  }
  function store(config: Config) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
    catch { notice = '브라우저에 설정을 저장할 수 없습니다. 현재 연습은 계속 사용할 수 있습니다.'; }
  }
  function saveSettings() {
    try { draft = validateConfig(draft); store(draft); error = ''; notice = '이 브라우저에 설정을 저장했습니다.'; }
    catch (e) { error = String(e instanceof Error ? e.message : e); }
  }
  function start(newSeed: boolean) {
    try {
      const next = validateConfig({ ...draft, seed: newSeed ? crypto.getRandomValues(new Uint32Array(1))[0] % 2147483646 + 1 : draft.seed });
      const nextSession = new Session(next);
      session?.stop(); remember();
      session = nextSession; draft = next; store(next);
      isReplay = false; error = ''; notice = '';
      origin = performance.now(); connectKeyboard(); session.start(); refresh(); surface?.focus({ preventScroll: true });
    } catch (e) { error = String(e instanceof Error ? e.message : e); }
  }
  function pause(message = '') {
    if (session?.status !== 'running') return;
    keyboard?.release(); session.pause(); refresh();
    if (message) notice = message;
  }
  function togglePause() {
    if (session?.status === 'running') pause();
    else if (session?.status === 'paused') { origin = performance.now(); session.start(); notice = ''; refresh(); surface?.focus({ preventScroll: true }); }
  }
  function end() { keyboard?.release(); session?.stop(); remember(); refresh(); }
  function watchReplay() {
    pause(); remember();
    if (!lastReplay) return;
    try {
      const next = new Session(lastReplay.config, lastReplay.source);
      session = next; isReplay = true; origin = performance.now(); connectKeyboard(); session.start(); error = ''; notice = '현재 세션의 기록을 재생합니다.'; refresh(); surface?.focus({ preventScroll: true });
    } catch (e) { error = String(e instanceof Error ? e.message : e); }
  }
  async function saveReplay(format: 'ttr' | 'ttrx') {
    if (busy) return;
    pause(); remember();
    const file = session?.ticks && !session.playback ? session.exportReplay() : lastReplay?.file;
    if (!file) return;
    busy = true; error = '';
    try { await downloadReplay(file, format); notice = `.${format} 파일을 저장했습니다. 공식 TETR.IO 재생 호환성은 아직 검증되지 않았습니다.`; }
    catch (e) { error = `${String(e instanceof Error ? e.message : e)}${format === 'ttrx' ? ' 원본 .ttr 저장은 계속 사용할 수 있습니다.' : ''}`; }
    finally { busy = false; }
  }
  function time(value: number) { return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toFixed(1).padStart(4, '0')}`; }

  onMount(() => {
    mounted = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) draft = validateConfig(JSON.parse(saved));
    } catch { notice = '저장된 설정을 읽지 못해 기본값으로 시작합니다.'; }
    try { session = new Session(draft); refresh(); connectKeyboard(); }
    catch (e) { error = String(e instanceof Error ? e.message : e); }
    let alive = true;
    let request = 0;
    origin = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      try {
        if (session?.status === 'running') {
          if (now - origin > 250) { pause('화면 갱신이 지연되어 연습을 일시정지했습니다.'); origin = now; }
          else {
            while (now - origin >= STEP && session.status === 'running') {
              const events = keyboard?.pull(session.frame) ?? [];
              session.tick(events); origin += STEP;
            }
          }
        } else origin = now;
        if (session && canvas) drawBoard(canvas, session);
        if (now - lastPaint > 60 || session?.status !== status) { refresh(); lastPaint = now; }
      } catch (e) { pause(); error = String(e instanceof Error ? e.message : e); alive = false; }
      if (alive) request = requestAnimationFrame(loop);
    };
    const blur = () => pause('포커스를 벗어나 연습을 일시정지했습니다.');
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    request = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(request); detach?.(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  });
</script>

<svelte:head><title>Spilink — 받고, 연결하고, 쏘세요.</title><meta name="description" content="올스핀 콤보, 플롱킹, B2B 서지를 위한 독립형 1인 연습 공간. 400개 측정과 자유로운 연습 설정." /></svelte:head>
<header class="site-header">
  <a class="brand" href={`${base}/`} aria-label="Spilink 홈"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>SPILINK</a>
  <div class="header-right"><span class="preview-tag">EARLY PREVIEW</span><a href="https://github.com/daejunnom/Spilink" target="_blank" rel="noreferrer">GitHub ↗</a></div>
</header>
<main>
  <div class="intro"><div><p class="eyebrow">SOLO PRACTICE / BLOCK RATIONING</p><h1>받고, 연결하고, 쏘세요.</h1><p>방해줄을 자원으로. 나만의 속도로 올스핀 콤보와 서지를 연습하세요.</p></div><div class="session-badge"><span class:live={status === 'running'} class="status-dot"></span><span data-testid="status">{isReplay ? '리플레이 · ' : ''}{statusNames[status]}</span></div></div>
  {#if error}<div class="message error" role="alert">{error}</div>{/if}
  {#if notice}<div class="message" role="status">{notice}</div>{/if}
  <div class="workspace">
    <aside class="setup-column">
      <PracticeSettings bind:config={draft} disabled={locked} />
      <div class="setup-actions"><button class="quiet" disabled={!mounted || locked} on:click={saveSettings}>설정 저장</button><button class="quiet" disabled={!mounted || locked} on:click={() => { draft = structuredClone(DEFAULT_CONFIG); saveSettings(); }}>기본값 복원</button></div>
    </aside>
    <section class="play-column" aria-label="연습 플레이어">
      <div class="play-heading"><span>{isReplay ? 'REPLAY' : 'PRACTICE'}</span><span>{session?.config.continueAfter400 ? '400 + FREE PLAY' : '400 PIECES'}</span></div>
      <div class="board-layout">
        <div class="hold-side"><h2>HOLD</h2><div class="mino-box"><PiecePreview cells={holdCells} label="홀드 미노" /></div><div class="mini-counter"><span>COMBO</span><strong>{stats?.combo ?? 0}</strong></div><div class="mini-counter"><span>B2B</span><strong>{stats?.btb ?? 0}</strong></div></div>
        <div class="board-shell">
          <div class="incoming-meter" aria-label={`대기 방해줄 ${pending}줄`}><div style={`height:${Math.min(100, pending * 5)}%`}></div></div>
          <div bind:this={surface} class="board-surface" role="application" aria-label="Spilink 게임 보드" tabindex="0" data-testid="game-surface">
            <canvas bind:this={canvas} aria-label="플레이 보드"></canvas>
            {#if status !== 'running'}
              <div class="board-overlay"><span class="eyebrow">{status === 'ready' ? 'YOUR NEXT COMBO' : 'SPILINK'}</span><strong>{statusNames[status]}</strong><p>{status === 'ready' ? '연습 시작을 눌러 보드에 집중하세요.' : status === 'completed' ? '400번째 배치까지의 결과를 기록했습니다.' : status === 'paused' ? '준비되면 같은 자리에서 이어가세요.' : '다음 시도에서도 같은 조건으로 연습할 수 있어요.'}</p>
                {#if status === 'paused'}<button class="primary" on:click={togglePause}>계속하기</button>{:else}<button data-testid="start" class="primary" disabled={!mounted} on:click={() => start(false)}>{status === 'ready' ? '연습 시작' : '다시 연습'}</button>{/if}
              </div>
            {/if}
          </div>
        </div>
        <div class="next-side"><h2>NEXT</h2>{#each nextCells as cells, i}<div class:next-first={i === 0} class="mino-box"><PiecePreview {cells} label={`다음 ${i + 1}번째 미노`} /></div>{/each}</div>
      </div>
      <div class="action-readout"><strong>{lastAction}</strong><span>{lastAttack ? `+${lastAttack} ATTACK` : 'ALL-SPIN · COMBO · SURGE'}</span></div>
      <div class="play-actions"><button disabled={!locked} on:click={togglePause}>{status === 'paused' ? '계속하기' : '일시정지'}</button><button disabled={!mounted} on:click={() => start(false)}>같은 시드 재시작</button><button disabled={!mounted} on:click={() => start(true)}>새 시드</button><button class="quiet" disabled={!locked} on:click={end}>종료</button></div>
      <p class="focus-note">키보드 전용 미리보기 · <kbd>{session?.config.bindings.retry.replace('Key','') ?? 'R'}</kbd> 재시작 · <kbd>{session?.config.bindings.pause ?? 'Escape'}</kbd> 일시정지</p>
      <div class="incoming-panel"><div><span class="eyebrow">INCOMING</span><strong>{pending} <small>대기</small> {#if reserved}<span>+ {reserved} <small>예고</small></span>{/if}</strong></div><div class="packet-list">{#each packets.slice(0, 8) as packet}<span class:ready={packet.ready}>{packet.amount}</span>{/each}</div>{#if assist}<p>신규 공격 완화 중 · 기존 공격은 유지됩니다.</p>{/if}</div>
    </section>
    <aside class="results-column">
      <div class="panel measurement-panel"><span class="eyebrow">FIRST 400</span><div class="piece-count"><strong data-testid="pieces">{stats?.pieces ?? 0}</strong><span>/ 400</span></div><div class="progress-track"><div style={`width:${progress}%`}></div></div><p>{stats?.checkpoint ? '최초 400개 결과 확정' : '400번째 배치까지 생성 공격을 집계합니다.'}</p><div class="measure-result"><span>ATTACK</span><strong>{stats?.first400Attack ?? 0}</strong></div><div class="measure-result"><span>ATTACK / PIECE</span><strong>{((stats?.first400Attack ?? 0) / Math.max(1, Math.min(400, stats?.pieces ?? 0))).toFixed(3)}</strong></div></div>
      <div class="panel stats-panel"><span class="eyebrow">SESSION</span><div class="time-display">{time(stats?.time ?? 0)}</div><dl><div><dt>ATTACK</dt><dd>{stats?.attack ?? 0}</dd></div><div><dt>APM</dt><dd>{(stats?.apm ?? 0).toFixed(2)}</dd></div><div><dt>PPS</dt><dd>{(stats?.pps ?? 0).toFixed(2)}</dd></div><div><dt>LINES SENT</dt><dd>{stats?.sent ?? 0}</dd></div><div><dt>LINES RECEIVED</dt><dd>{stats?.received ?? 0}</dd></div><div><dt>LINES</dt><dd>{stats?.lines ?? 0}</dd></div><div><dt>MAX COMBO</dt><dd>{stats?.maxCombo ?? 0}</dd></div><div><dt>MAX B2B</dt><dd>{stats?.maxBtb ?? 0}</dd></div><div><dt>SPINS</dt><dd>{stats?.spins ?? 0}</dd></div><div><dt>ALL CLEARS</dt><dd>{stats?.allClears ?? 0}</dd></div></dl></div>
      <div class="panel replay-panel"><span class="eyebrow">REPLAY</span><h2>다시 보고, 다시 연습</h2><button class="full" disabled={!stats?.pieces && !lastReplay} on:click={watchReplay}>현재 기록 재생</button><div class="download-row"><button class="primary" disabled={busy || (!stats?.pieces && !lastReplay)} on:click={() => saveReplay('ttr')}>.ttr 저장</button>{#if draft.ttrx}<button disabled={busy || (!stats?.pieces && !lastReplay)} on:click={() => saveReplay('ttrx')}>{busy ? '변환 중…' : '.ttrx 저장'}</button>{/if}</div><p>Spilink 실험 리플레이입니다. 공식 TETR.IO 재생 호환성은 아직 검증되지 않았습니다.</p></div>
    </aside>
  </div>
  <div class="preview-notice"><strong>첫 플레이 미리보기</strong><span>공격은 합성 모델로 생성됩니다. 원본 QP 전체 규칙의 동등성은 검증 중이며, 현재는 7-bag 연습만 제공합니다. 되돌리기와 외부 리플레이 가져오기는 아직 지원하지 않습니다. 한 세션은 최대 1시간입니다.</span></div>
</main>
<footer><span>SPILINK · Independent solo practice</span><nav aria-label="라이선스"><a href={`${base}/licenses/triangle.txt`}>Triangle</a><a href={`${base}/licenses/clearra.txt`}>Clearra</a><a href={`${base}/licenses/ttrx.txt`}>TTRX</a></nav><span>Not affiliated with TETR.IO</span></footer>
