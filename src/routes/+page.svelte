<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { base } from '$app/paths';
  import '../app.css';
  import PracticeSettings from '$lib/components/PracticeSettings.svelte';
  import PiecePreview from '$lib/components/PiecePreview.svelte';
  import { DEFAULT_CONFIG, validateConfig, type Config } from '$lib/config';
  import { Session, type Status } from '$lib/session';
  import { Keyboard } from '$lib/input';
  import { drawBoard, previewCells } from '$lib/renderer';
  import { downloadReplay, readReplay, convertImported, type SavedReplay, type ReplayFile } from '$lib/replay';
  const STORAGE_KEY='spilink.settings.v1', STEP=1000/60;
  let draft=structuredClone(DEFAULT_CONFIG),session:Session|null=null;
  let status:Status='ready',stats:ReturnType<Session['summary']>|null=null;
  let canvas:HTMLCanvasElement,surface:HTMLDivElement,stage:HTMLElement,dialog:HTMLDialogElement;
  let keyboard:Keyboard|null=null,detach:(()=>void)|undefined,origin=0,lastPaint=0,mounted=false,busy=false;
  let error='',notice='',isReplay=false,modal:''|'settings'|'replay'|'stats'|'about'='';
  let pending=0,reserved=0,lastAction='READY',lastAttack=0,assist=false,canUndo=false,canRedo=false;
  let boardWidth=200,sideWidth=50,fullscreen=false;
  let holdCells:ReturnType<typeof previewCells>=[],nextCells:ReturnType<typeof previewCells>[]=[];
  let packets:{id:number;amount:number;ready:boolean}[]=[];
  let saved:SavedReplay|null=null,imported:ReplayFile|null=null;
  const statusNames:Record<Status,string>={ready:'시작 준비',running:'연습 중',paused:'일시정지',completed:'400개 측정 완료',topout:'탑아웃',stopped:'세션 종료'};
  $: locked=status==='running'||status==='paused';
  $: cap=status==='ready'?(draft.garbageCap||8):(session?.config.garbageCap??8);
  $: meterMax=Math.max(20,cap);
  $: progress=Math.min(100,(stats?.pieces??0)/4);
  function refresh(){
    if(!session)return;status=session.status;stats=session.summary();pending=session.receiver.size;reserved=session.receiver.reserved;
    lastAction=session.lastAction;lastAttack=session.lastAttack;assist=session.assistActive;canUndo=session.canUndo;canRedo=session.canRedo;
    holdCells=previewCells(session,session.engine.held);nextCells=Array.from(session.engine.queue).slice(0,5).map(p=>previewCells(session,p));
    packets=session.receiver.pending.map(p=>({id:p.id,amount:p.amount,ready:p.active&&p.status==='spawn'}));
  }
  function message(e:unknown){error=e instanceof Error?e.message:String(e);}
  function remember(){if(session?.ticks&&!session.playback)saved=session.exportReplay();}
  function connectKeyboard(){
    const physical=keyboard?.physical??new Set<string>();detach?.();if(!session)return;
    keyboard=new Keyboard(session.config.bindings,()=>({frame:session?.frame??0,origin,active:session?.status==='running'&&!session?.playback&&!modal}),command=>{
      if(command==='pause')togglePause();else if(command==='retry')start(false);else history(command);
    });keyboard.physical=physical;detach=keyboard.attach();
  }
  function store(c:Config){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(c));}catch{notice='설정을 저장하지 못했습니다. 현재 연습은 계속 사용할 수 있습니다.';}}
  function saveSettings(apply=false){
    try{const c=validateConfig(draft);if(apply&&session){session.applySettings(c);connectKeyboard();refresh();}draft=c;store(c);error='';notice=apply?'현재 연습에 적용했습니다.':'설정을 저장했습니다.';
      if(status==='ready'){session=new Session(c);connectKeyboard();refresh();}
    }catch(e){message(e);}
  }
  function start(newSeed:boolean){
    try{const c=validateConfig({...draft,seed:newSeed?crypto.getRandomValues(new Uint32Array(1))[0]%2147483646+1:draft.seed});const next=new Session(c);
      session?.stop();remember();session=next;draft=c;store(c);isReplay=false;error='';notice='';origin=performance.now();connectKeyboard();session.start();keyboard?.hoist();refresh();closePanel();surface?.focus({preventScroll:true});
    }catch(e){message(e);}
  }
  function pause(text=''){if(session?.status!=='running')return;keyboard?.release();session.pause();session.releaseOnResume=true;refresh();if(text)notice=text;}
  function togglePause(){if(modal)return;if(session?.status==='running')pause();else if(session?.status==='paused'){origin=performance.now();session.start();notice='';refresh();surface?.focus({preventScroll:true});}}
  function end(){keyboard?.release();session?.stop();remember();refresh();}
  function history(action:'undo'|'redo'){if(!session||isReplay)return;pause();keyboard?.release();if(session[action]()){draft=structuredClone(session.config);connectKeyboard();origin=performance.now();notice=action==='undo'?'이전 배치로 돌아왔습니다.':'다음 배치를 복원했습니다.';}refresh();}
  function watch(file:SavedReplay|null=saved){
    pause();if(!file){remember();file=saved;}if(!file)return;
    try{session=new Session(file.spilink.settings,{keys:file.replay.events.filter(e=>e.type==='keydown'||e.type==='keyup') as ReturnType<Session['replaySource']>['keys'],attacks:file.spilink.attacks,changes:file.spilink.changes,endFrame:file.replay.frames,ticks:file.spilink.ticks});
      isReplay=true;origin=performance.now();connectKeyboard();session.start();error='';refresh();closePanel();surface?.focus({preventScroll:true});
    }catch(e){message(e);}
  }
  async function saveReplay(format:'ttr'|'ttrx'){
    if(busy)return;pause();remember();const file=session?.ticks&&!session.playback?session.exportReplay():saved;if(!file)return;
    busy=true;error='';try{await downloadReplay(file,format);notice=`.${format} 파일을 저장했습니다.`;}catch(e){message(e);}finally{busy=false;}
  }
  async function importFile(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file)return;busy=true;pause();
    try{const result=await readReplay(file);imported=result;notice=result.session?'Spilink 기록을 읽었습니다.':'외부 기록을 읽었습니다. 원본 보존과 변환을 사용할 수 있습니다.';error='';}catch(e){message(e);}finally{busy=false;input.value='';}
  }
  function watchImported(){if(!imported?.session)return;try{remember();session=new Session(imported.session.config,imported.session.source);isReplay=true;origin=performance.now();connectKeyboard();session.start();refresh();closePanel();}catch(e){message(e);}}
  async function convert(format:'source'|'ttrx'){if(!imported||busy)return;busy=true;try{await convertImported(imported,format);error='';}catch(e){message(e);}finally{busy=false;}}
  async function openPanel(name:typeof modal){pause();if(name==='replay')remember();modal=name;await tick();dialog?.showModal();}
  function closePanel(){dialog?.close();modal='';surface?.focus({preventScroll:true});}
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice='이 브라우저에서는 전체 화면을 사용할 수 없습니다.';}}
  function fit(){if(!stage)return;const {width,height}=stage.getBoundingClientRect();sideWidth=Math.max(24,Math.min(88,width*.12,(height-81)/2.7));boardWidth=Math.max(50,Math.floor(Math.min((height-26)/2,width-2*sideWidth-48,580)));}
  function time(n:number){return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;}
  onMount(()=>{
    mounted=true;try{const v=localStorage.getItem(STORAGE_KEY);if(v)draft=validateConfig(JSON.parse(v));}catch{notice='저장된 설정을 읽지 못해 기본값을 사용합니다.';}
    try{session=new Session(draft);refresh();connectKeyboard();}catch(e){message(e);}
    let alive=true,request=0;origin=performance.now();
    const loop=(now:number)=>{if(!alive)return;try{
      if(session?.status==='running'){
        if(now-origin>250){pause('화면 갱신이 지연되어 일시정지했습니다.');origin=now;}
        else while(now-origin>=STEP&&session.status==='running'){session.tick(keyboard?.pull(session.frame)??[]);origin+=STEP;}
      }else origin=now;
      if(session&&canvas)drawBoard(canvas,session);
      if(now-lastPaint>50||session?.status!==status){refresh();lastPaint=now;}
    }catch(e){pause();message(e);}request=requestAnimationFrame(loop);};
    const blur=()=>pause(),visibility=()=>{if(document.hidden)blur();},full=()=>{fullscreen=Boolean(document.fullscreenElement);fit();};
    const observer=new ResizeObserver(fit);observer.observe(stage);fit();
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);document.addEventListener('fullscreenchange',full);window.visualViewport?.addEventListener('resize',fit);
    request=requestAnimationFrame(loop);
    return()=>{alive=false;cancelAnimationFrame(request);detach?.();observer.disconnect();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',full);window.visualViewport?.removeEventListener('resize',fit);};
  });
</script>
<svelte:head><title>Spilink</title><meta name="description" content="400개 측정과 자유 연습을 위한 올스핀 콤보·플롱킹·서지 플레이어" /></svelte:head>
<main class="app" style={`--board-width:${boardWidth}px;--side-width:${sideWidth}px`}>
  <div class="utility-row">
    <span class="session-status" data-testid="status"><i class:live={status==='running'}></i>{isReplay?'재생 · ':''}{statusNames[status]}</span>
    <nav class="top-tools" aria-label="연습 도구">
      <button data-testid="settings-button" on:click={()=>openPanel('settings')}>설정</button>
      <button data-testid="replay-button" on:click={()=>openPanel('replay')}>기록</button>
      <button data-testid="stats-button" on:click={()=>openPanel('stats')}>통계</button>
      <button data-testid="fullscreen-button" aria-pressed={fullscreen} on:click={toggleFullscreen}>{fullscreen?'창 모드':'전체 화면'}</button>
      <button class="about-button" aria-label="도움말과 라이선스" on:click={()=>openPanel('about')}>?</button>
    </nav>
  </div>
  <section class="play-stage" bind:this={stage} aria-label="연습 플레이어">
    <div class="board-layout">
      <aside class="hold-side"><h2>HOLD</h2><div class="mino-box"><PiecePreview cells={holdCells} label="홀드 미노" /></div><div class="mini-counter"><span>COMBO</span><strong>{stats?.combo??0}</strong></div><div class="mini-counter"><span>B2B</span><strong>{stats?.btb??0}</strong></div><div class="mini-counter first400"><span>400 ATTACK</span><strong>{stats?.first400Attack??0}</strong></div></aside>
      <div class="board-shell">
        <div class="incoming-meter" data-testid="garbage-meter" role="meter" aria-label="대기 방해줄" aria-valuemin="0" aria-valuemax={Math.max(meterMax,pending)} aria-valuenow={pending}>
          <div class="meter-fill" style={`height:${Math.min(100,pending/meterMax*100)}%`}></div>
          <div class="cap-line" data-testid="cap-line" style={`bottom:${cap/meterMax*100}%`} title={`가비지 캡 ${cap}줄`}><span>{cap}</span></div>
          {#if pending>meterMax}<span class="meter-overflow">+{pending-meterMax}</span>{/if}
        </div>
        <div bind:this={surface} role="button" aria-label="Spilink 게임 보드" tabindex="0" class="board-surface" data-testid="game-surface" on:click={()=>surface.focus({preventScroll:true})} on:keydown={()=>{}}>
          <canvas bind:this={canvas} aria-hidden="true"></canvas>
          {#if status!=='running'}
            <div class="board-overlay"><strong>{statusNames[status]}</strong>
              {#if status==='completed'}<span>최초 400개 공격 {stats?.first400Attack??0}</span>{/if}
              {#if status==='paused'}<button class="primary" on:click|stopPropagation={togglePause}>계속하기</button>{:else}<button data-testid="start" class="primary" disabled={!mounted} on:click|stopPropagation={()=>start(false)}>{status==='ready'?'연습 시작':'다시 연습'}</button>{/if}
            </div>
          {/if}
        </div>
      </div>
      <aside class="next-side"><h2>NEXT</h2>{#each nextCells as cells,i}<div class="mino-box" class:next-first={i===0}><PiecePreview {cells} label={`다음 ${i+1}번째 미노`} /></div>{/each}<span class="cap-label">CAP {cap}</span></aside>
    </div>
    <div class="action-readout"><strong>{lastAction}</strong><span>{lastAttack?`+${lastAttack}`:''}</span><span class="incoming-count">대기 {pending}{reserved?` + 예고 ${reserved}`:''}</span>{#if assist}<span>공급 완화</span>{/if}</div>
  </section>
  <section class="bottom-deck" aria-label="진행과 조작">
    <div class="session-hud"><div><span>PIECES</span><strong><b data-testid="pieces">{stats?.pieces??0}</b><small>{session?.config.continueAfter400?' / ∞':' / 400'}</small></strong></div><div><span>ATTACK</span><strong>{stats?.attack??0}</strong></div><div><span>APP</span><strong>{(stats?.app??0).toFixed(3)}</strong></div><div><span>APM</span><strong>{(stats?.apm??0).toFixed(1)}</strong></div><div><span>PPS</span><strong>{(stats?.pps??0).toFixed(2)}</strong></div><div><span>TIME</span><strong>{time(stats?.time??0)}</strong></div></div>
    <div class="progress-track" aria-label="400개 측정 진행"><div style={`width:${progress}%`}></div></div>
    <div class="play-actions"><button disabled={!locked} on:click={togglePause}>{status==='paused'?'계속하기':'일시정지'}</button><button disabled={!mounted} on:click={()=>start(false)}>재시작</button><button disabled={!mounted} on:click={()=>start(true)}>새 시드</button><button data-testid="undo" disabled={!canUndo} on:click={()=>history('undo')}>되돌리기</button><button data-testid="redo" disabled={!canRedo} on:click={()=>history('redo')}>다시 실행</button><button disabled={!locked} on:click={end}>종료</button></div>
  </section>
</main>
{#if error||notice}<div class="toast" class:error={Boolean(error)} role={error?'alert':'status'}><span>{error||notice}</span><button aria-label="알림 닫기" on:click={()=>{error='';notice='';}}>×</button></div>{/if}
{#if modal}
  <dialog bind:this={dialog} class="drawer" on:cancel|preventDefault={closePanel} aria-label={modal==='settings'?'연습 설정':modal==='replay'?'기록':modal==='stats'?'통계':'도움말'}>
    <div class="drawer-bar"><strong>{modal==='settings'?'연습 설정':modal==='replay'?'기록':modal==='stats'?'세션 통계':'도움말'}</strong><button data-testid="close-panel" aria-label="패널 닫기" on:click={closePanel}>닫기</button></div>
    <div class="drawer-body">
      {#if modal==='settings'}
        <PracticeSettings bind:config={draft} disabled={isReplay} />
        <div class="panel-actions"><button on:click={()=>saveSettings()}>설정 저장</button><button disabled={status!=='paused'||isReplay} on:click={()=>saveSettings(true)}>현재 연습에 적용</button><button on:click={()=>{draft=structuredClone(DEFAULT_CONFIG);saveSettings();}}>기본값 복원</button><button class="primary" on:click={()=>start(false)}>새 연습 시작</button></div>
      {:else if modal==='replay'}
        <h2>현재 연습</h2><div class="panel-actions"><button disabled={!saved} on:click={()=>watch(saved)}>현재 기록 재생</button><button disabled={busy||!saved} on:click={()=>saveReplay('ttr')}>.ttr 저장</button><button disabled={busy||!saved||!draft.ttrx} on:click={()=>saveReplay('ttrx')}>.ttrx 저장</button></div>
        <p class="muted">입력·가상 공격·설정 변경을 저장합니다. 공식 TETR.IO와의 게임 결과 일치는 아직 검증되지 않았습니다.</p>
        <h2>파일 가져오기</h2><label>리플레이 선택<input data-testid="import-file" type="file" accept=".ttr,.ttrm,.ttrx,.json" disabled={busy} on:change={importFile} /></label>
        {#if imported}<div class="import-summary"><strong>{imported.name}</strong><p>{imported.username} · {imported.streams}개 스트림 · {imported.events}개 이벤트</p><div class="panel-actions"><button disabled={!imported.session||busy} on:click={watchImported}>가져온 기록 재생</button><button disabled={busy} on:click={()=>convert('source')}>원본 형식 저장</button><button disabled={busy} on:click={()=>convert('ttrx')}>TTRX로 변환</button></div></div>{/if}
        <p class="muted">외부 .ttr/.ttrm은 구조 검사·원문 보존·변환을 지원합니다. 현재 플레이어에서 재생 가능한 파일은 Spilink v2 기록입니다. 기존 외부 파일을 임의의 게임 규칙으로 바꾸어 재생하지 않습니다.</p>
      {:else if modal==='stats'}
        <h2>최초 400개</h2><dl><div><dt>ATTACK</dt><dd>{stats?.first400Attack??0}</dd></div><div><dt>ATTACK / PIECE</dt><dd>{((stats?.first400Attack??0)/Math.max(1,Math.min(400,stats?.pieces??0))).toFixed(3)}</dd></div><div><dt>측정 상태</dt><dd>{stats?.checkpoint?'확정':'진행 중'}</dd></div></dl>
        <h2>전체 세션</h2><dl>{#each [['TIME',time(stats?.time??0)],['ATTACK',stats?.attack??0],['APM',(stats?.apm??0).toFixed(2)],['PPS',(stats?.pps??0).toFixed(2)],['VS',(stats?.vsscore??0).toFixed(2)],['LINES SENT',stats?.sent??0],['LINES RECEIVED',stats?.received??0],['LINES',stats?.lines??0],['MAX COMBO',stats?.maxCombo??0],['MAX B2B',stats?.maxBtb??0],['SPINS',stats?.spins??0],['ALL CLEARS',stats?.allClears??0],['KEYS',stats?.inputs??0],['HOLDS',stats?.holds??0],['FLOOR',stats?.floor??1],['ALTITUDE',(stats?.altitude??0).toFixed(2)]] as [label,value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>
        <h2>대기 방해줄</h2><div class="packet-list">{#each packets as p}<span class:ready={p.ready}>{p.amount}</span>{/each}</div>
      {:else}
        <h2>조작</h2><p>화살표 이동·소프트드롭, Space 하드드롭, ↑/Z/A 회전, C 홀드, R 재시작, Esc 일시정지. 모든 키는 설정에서 바꿀 수 있습니다.</p><p>Ctrl+Z / Ctrl+Y로 최근 배치를 되돌리고 복원합니다. 게임과 공격 예약은 함께 일시정지됩니다.</p><p>400번째 배치까지 측정하고 종료합니다. 설정에서 이후 계속 플레이를 켜면 최초 400개 결과를 남긴 채 연습을 이어갑니다.</p><p>독립 연습 프로젝트이며 공식 업적이나 순위를 등록하지 않습니다. 키보드 조작을 사용합니다.</p>
        <nav class="license-links"><a href="https://github.com/daejunnom/Spilink" target="_blank" rel="noreferrer">GitHub</a><a href={`${base}/licenses/triangle.txt`} target="_blank" rel="noreferrer">Triangle 라이선스</a><a href={`${base}/licenses/clearra.txt`} target="_blank" rel="noreferrer">Clearra 라이선스</a><a href={`${base}/licenses/ttrx.txt`} target="_blank" rel="noreferrer">TTRX 라이선스</a></nav>
      {/if}
    </div>
  </dialog>
{/if}
