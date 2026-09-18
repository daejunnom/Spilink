<script lang="ts">
  import { translation, locale, initLocale, localePreference, setLocalePreference, SUPPORTED_LOCALES, type LocalePreference } from '$lib/i18n/store';
  import { createTranslator, errorMessage, type MessageKey } from '$lib/i18n/index';
  let t=createTranslator('en');
  $: t=$translation;
  import AttackWarning from '$lib/components/AttackWarning.svelte';
  import type { WindupNotice } from '$lib/windup';
  import { onMount, tick } from 'svelte';
  import { base } from '$app/paths';
  import '../app.css';
  import TouchControls from '$lib/components/TouchControls.svelte';
  import TouchSettings from '$lib/components/TouchSettings.svelte';
  import { defaultTouchPreferences, validateTouchPreferences, TOUCH_STORAGE_KEY, touchDetected, touchVisible, orientationOf, type TouchPreferences, type TouchAction, type Orientation, type Point } from '$lib/touch/model';
  import { touchTranslator } from '$lib/touch/messages';
  import PracticeSettings from '$lib/components/PracticeSettings.svelte';
  import PiecePreview from '$lib/components/PiecePreview.svelte';
  import { DEFAULT_CONFIG, validateConfig, type Config } from '$lib/config';
  import { Session, type Status } from '$lib/session';
  import { Keyboard } from '$lib/input';
  import { drawBoard, previewCells } from '$lib/renderer';
  import { BOARD_VIEW, BOARD_ASPECT, SPAWN_BAND_PERCENT } from '$lib/board-view';
  import { downloadReplay, readReplay, convertImported, type SavedReplay, type ReplayFile } from '$lib/replay';
  import { newSeed } from '$lib/seed';
  import { garbageSegments, type GarbageSegment } from '$lib/garbage-view';
  let touchPreferences=defaultTouchPreferences(),touchDevice=false,touchEditing=false;
  let orientation:Orientation='portrait';
  $: showTouch=mounted&&touchVisible(touchPreferences.mode,touchDevice);
  $: tt=touchTranslator($locale);
  $: if(mounted){touchPreferences.size;showTouch;orientation;tick().then(fit);}
  const STORAGE_KEY='spilink.settings.v1', STEP=1000/60;
  let draft=structuredClone(DEFAULT_CONFIG),session:Session|null=null;
  let status:Status='ready',stats:ReturnType<Session['summary']>|null=null;
  let canvas:HTMLCanvasElement,surface:HTMLDivElement,stage:HTMLElement,dialog:HTMLDialogElement;
  let keyboard:Keyboard|null=null,detach:(()=>void)|undefined,origin=0,lastPaint=0,mounted=false,busy=false;
  let error='',notice='',isReplay=false,modal:''|'settings'|'replay'|'stats'|'about'='';
  let pending=0,reserved=0,lastAction='READY',lastAttack=0,assist=false,canUndo=false,canRedo=false;
  let boardWidth=200,sideWidth=50,fullscreen=false;
  let holdLocked=false,replayMismatch=false;
  let holdCells:ReturnType<typeof previewCells>=[],nextCells:ReturnType<typeof previewCells>[]=[];
  let packets:GarbageSegment[]=[];
  let windups:WindupNotice[]=[],warningFrame=0;
  let saved:SavedReplay|null=null,imported:ReplayFile|null=null;
  $: statusNames={ready:t('status.ready'),running:t('status.running'),paused:t('status.paused'),completed:t('status.completed'),topout:t('status.topout'),stopped:t('status.stopped')};
  $: locked=status==='running'||status==='paused';
  $: cap=status==='ready'?(draft.garbageCap||8):(session?.config.garbageCap??8);
  $: meterMax=Math.max(20,cap);
  $: progress=Math.min(100,(stats?.pieces??0)/4);
  function refresh(){
    if(!session)return;status=session.status;stats=session.summary();pending=session.receiver.size;reserved=session.receiver.reserved;
    replayMismatch=session.replayMismatch;lastAction=session.lastAction;lastAttack=session.lastAttack;assist=session.assistActive;canUndo=session.canUndo;canRedo=session.canRedo;
    holdLocked=session.engine.holdLocked;holdCells=previewCells(session,session.engine.held);nextCells=Array.from(session.engine.queue).slice(0,5).map(p=>previewCells(session,p));
    packets=garbageSegments(session.receiver,session.frame);
    windups=session.receiver.windups;warningFrame=session.frame;
  }
  function packetTitle(packet:GarbageSegment){return t('garbage.'+packet.urgency as MessageKey)+': '+packet.amount+(packet.remainingFrames===null?' · '+t('garbage.queued'):' · '+(packet.remainingFrames/60).toFixed(2)+'s');}
  function message(e:unknown){error=errorMessage(e,$locale);console.error(e);}
  function remember(){if(session?.ticks&&!session.playback)saved=session.exportReplay();}
  function connectKeyboard(){
    const physical=keyboard?.physical??new Set<string>();detach?.();if(!session)return;
    keyboard=new Keyboard(session.config.bindings,()=>({frame:session?.frame??0,origin,active:session?.status==='running'&&!session?.playback&&!modal&&!touchEditing}),command=>{
      if(touchEditing)return;
      if(command==='pause')togglePause();else if(command==='retry')start();else history(command);
    });keyboard.physical=physical;detach=keyboard.attach();
  }
  function setTouchPreferences(next:TouchPreferences){
    try{touchPreferences=validateTouchPreferences(next);keyboard?.release();if(session)session.releaseOnResume=true;
      try{localStorage.setItem(TOUCH_STORAGE_KEY,JSON.stringify(touchPreferences));}catch{notice=tt('storage');}
    }catch{notice=tt('invalid');}
  }
  function touchMove(action:TouchAction,point:Point){const next=structuredClone(touchPreferences);next.layouts[orientation][action]=point;setTouchPreferences(next);}
  function editTouch(){pause();keyboard?.release();setTouchPreferences({...touchPreferences,mode:'on'});closePanel();touchEditing=true;}
  function finishTouch(){touchEditing=false;surface?.focus({preventScroll:true});}
  function touchPress(action:TouchAction,owner:string,time:number){surface?.focus({preventScroll:true});keyboard?.virtualDown(action,owner,time);}
  function touchRelease(owner:string,time:number){keyboard?.virtualUp(owner,time);}
  function store(c:Config){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(c));}catch{notice=t('notice.storage');}}
  function saveSettings(apply=false){
    try{const c=validateConfig(draft);if(apply&&session){session.applySettings(c);connectKeyboard();refresh();}draft=c;store(c);error='';notice=apply?t('notice.applied'):t('notice.saved');
      if(status==='ready'){session=new Session(c);connectKeyboard();refresh();}
    }catch(e){message(e);}
  }
  function start(){
    try{const c=validateConfig({...draft,seed:newSeed(draft.seed)});const next=new Session(c);
      touchEditing=false;keyboard?.release();session?.stop();remember();session=next;draft=c;store(c);isReplay=false;error='';notice='';origin=performance.now();connectKeyboard();session.start();keyboard?.hoist();refresh();closePanel();surface?.focus({preventScroll:true});
    }catch(e){message(e);}
  }
  function pause(text=''){if(session?.status!=='running')return;keyboard?.release();session.pause();session.releaseOnResume=true;refresh();if(text)notice=text;}
  function togglePause(){if(modal||touchEditing)return;if(session?.status==='running')pause();else if(session?.status==='paused'){origin=performance.now();session.start();notice='';refresh();surface?.focus({preventScroll:true});}}
  function end(){keyboard?.release();session?.stop();remember();refresh();}
  function history(action:'undo'|'redo'){if(!session||isReplay)return;pause();keyboard?.release();if(session[action]()){draft=structuredClone(session.config);connectKeyboard();origin=performance.now();notice=action==='undo'?t('notice.undo'):t('notice.redo');}refresh();}
  function watch(file:SavedReplay|null=saved){
    pause();if(!file){remember();file=saved;}if(!file)return;
    try{session=new Session(file.spilink.settings,{keys:file.replay.events.filter(e=>e.type==='keydown'||e.type==='keyup') as ReturnType<Session['replaySource']>['keys'],attacks:file.spilink.attacks,changes:file.spilink.changes,endFrame:file.replay.frames,ticks:file.spilink.ticks,expectedEnd:file.spilink.expectedEnd});
      isReplay=true;origin=performance.now();connectKeyboard();session.start();error='';refresh();closePanel();surface?.focus({preventScroll:true});
    }catch(e){message(e);}
  }
  async function saveReplay(format:'ttr'|'ttrx'){
    if(busy)return;pause();remember();const file=session?.ticks&&!session.playback?session.exportReplay():saved;if(!file)return;
    busy=true;error='';try{await downloadReplay(file,format);notice=t('replay.saved',{format});}catch(e){message(e);}finally{busy=false;}
  }
  async function importFile(event:Event){
    const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file)return;busy=true;pause();
    try{const result=await readReplay(file);imported=result;notice=result.session?t('notice.imported'):t('notice.external');error='';}catch(e){message(e);}finally{busy=false;input.value='';}
  }
  function watchImported(){if(!imported?.session)return;try{remember();session=new Session(imported.session.config,imported.session.source);isReplay=true;origin=performance.now();connectKeyboard();session.start();refresh();closePanel();}catch(e){message(e);}}
  async function convert(format:'source'|'ttrx'){if(!imported||busy)return;busy=true;try{await convertImported(imported,format);error='';}catch(e){message(e);}finally{busy=false;}}
  async function openPanel(name:typeof modal){touchEditing=false;pause();keyboard?.release();if(name==='replay')remember();modal=name;await tick();dialog?.showModal();}
  function closePanel(){dialog?.close();modal='';surface?.focus({preventScroll:true});}
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice=t('notice.fullscreen');}}
  function fit(){if(!stage)return;const {width,height:outerHeight}=stage.getBoundingClientRect();const height=outerHeight-(parseFloat(getComputedStyle(stage).paddingTop)||0);sideWidth=Math.max(24,Math.min(88,width*.12,(height-81)/2.7));boardWidth=Math.max(50,Math.floor(Math.min((height-26)/BOARD_ASPECT,width-2*sideWidth-48-(showTouch&&orientation==='landscape'?4*touchPreferences.size+32:0),580)));}
  function time(n:number){return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;}
  onMount(()=>{
    const cleanupLocale=initLocale();mounted=true;
    try{const savedTouch=localStorage.getItem(TOUCH_STORAGE_KEY);if(savedTouch)touchPreferences=validateTouchPreferences(JSON.parse(savedTouch));}catch{notice=tt('invalid');}
    const coarse=matchMedia('(any-pointer: coarse)');
    const device=()=>{touchDevice=touchDetected(navigator.maxTouchPoints,coarse.matches);orientation=orientationOf(innerWidth,innerHeight);keyboard?.release();if(session)session.releaseOnResume=true;tick().then(fit);};
    coarse.addEventListener('change',device);window.addEventListener('resize',device);device();try{const v=localStorage.getItem(STORAGE_KEY);if(v)draft=validateConfig(JSON.parse(v));}catch{notice=t('notice.defaults');}
    try{session=new Session(draft);refresh();connectKeyboard();}catch(e){message(e);}
    let alive=true,request=0;origin=performance.now();
    const loop=(now:number)=>{if(!alive)return;try{
      if(session?.status==='running'){
        if(now-origin>250){pause(t('notice.lag'));origin=now;}
        else while(now-origin>=STEP&&session.status==='running'){session.tick(keyboard?.pull(session.frame)??[]);origin+=STEP;}
      }else origin=now;
      if(session&&canvas)drawBoard(canvas,session);
      if(now-lastPaint>50||session?.status!==status){refresh();lastPaint=now;}
    }catch(e){pause();message(e);}request=requestAnimationFrame(loop);};
    const blur=()=>pause(),visibility=()=>{if(document.hidden)blur();},full=()=>{fullscreen=Boolean(document.fullscreenElement);fit();};
    const observer=new ResizeObserver(fit);observer.observe(stage);fit();
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);document.addEventListener('fullscreenchange',full);window.visualViewport?.addEventListener('resize',fit);
    request=requestAnimationFrame(loop);
    return()=>{coarse.removeEventListener('change',device);window.removeEventListener('resize',device);keyboard?.release();cleanupLocale();alive=false;cancelAnimationFrame(request);detach?.();observer.disconnect();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',full);window.visualViewport?.removeEventListener('resize',fit);};
  });
</script>
<svelte:head><title>Spilink</title><meta name="description" content={t('page.description')} /></svelte:head>
<main class="app" class:touch-enabled={showTouch} class:touch-editing={touchEditing} class:touch-landscape={showTouch&&orientation==='landscape'} style={`--board-width:${boardWidth}px;--board-aspect:${BOARD_ASPECT};--spawn-band:${SPAWN_BAND_PERCENT}%;--side-width:${sideWidth}px;--touch-height:${2*touchPreferences.size+20}px`}>
  <div class="utility-row">
    {#if touchEditing}<button data-testid="touch-done" class="primary" on:click={finishTouch}>{tt('done')}</button>{/if}
    <span class="session-status" data-testid="status"><i class:live={status==='running'}></i>{isReplay?t('replay.prefix'):''}{replayMismatch?t('replay.mismatch'):statusNames[status]}</span>
    <nav class="top-tools" aria-label={t('nav.tools')}>
      <button data-testid="settings-button" on:click={()=>openPanel('settings')}>{t('nav.settings')}</button>
      <button data-testid="replay-button" on:click={()=>openPanel('replay')}>{t('nav.replay')}</button>
      <button data-testid="stats-button" on:click={()=>openPanel('stats')}>{t('nav.stats')}</button>
      <button data-testid="fullscreen-button" aria-pressed={fullscreen} on:click={toggleFullscreen}>{fullscreen?t('nav.window'):t('nav.fullscreen')}</button>
      <button class="about-button" aria-label={t('nav.about')} on:click={()=>openPanel('about')}>?</button>
    </nav>
  </div>
  <section class="play-stage" bind:this={stage} aria-label={t('aria.player')}>
    <AttackWarning notices={windups} frame={warningFrame} visible={status==='running'||status==='paused'} />
    <div class="board-layout">
      <aside class="hold-side"><h2>HOLD</h2><div class="mino-box" class:hold-locked={holdLocked} data-testid="hold-preview" data-locked={holdLocked} title={t(holdLocked?'hold.locked':'hold.available')}><PiecePreview cells={holdCells} label={t(holdLocked?'hold.locked':'hold.available')} /></div><div class="mini-counter"><span>COMBO</span><strong>{stats?.combo??0}</strong></div><div class="mini-counter"><span>B2B</span><strong>{stats?.btb??0}</strong></div><div class="mini-counter first400"><span>400 ATTACK</span><strong>{stats?.first400Attack??0}</strong></div></aside>
      <div class="board-shell">
        <div class="incoming-meter" data-testid="garbage-meter" role="meter" aria-label={t('aria.garbage')} aria-valuemin="0" aria-valuemax={Math.max(meterMax,pending)} aria-valuenow={pending}>
          <div class="meter-stack">{#each packets as packet}<div class={`meter-segment ${packet.urgency}`} data-urgency={packet.urgency} style={`height:${packet.amount/meterMax*100}%`} title={packetTitle(packet)}></div>{/each}</div>
          <div class="cap-line" data-testid="cap-line" style={`bottom:${cap/meterMax*100}%`} title={t('garbage.cap',{cap})}><span>{cap}</span></div>
          {#if pending>meterMax}<span class="meter-overflow">+{pending-meterMax}</span>{/if}
        </div>
        <div bind:this={surface} role="button" aria-label={t('aria.board')} tabindex="0" class="board-surface" data-testid="game-surface" on:click={()=>surface.focus({preventScroll:true})} on:keydown={()=>{}}>
          <canvas bind:this={canvas} data-testid="board-canvas" data-visible-rows={BOARD_VIEW.rows} aria-hidden="true"></canvas>
          {#if status!=='running'}
            <div class="board-overlay"><strong>{replayMismatch?t('replay.mismatch'):statusNames[status]}</strong>
              {#if status==='completed'}<span>{t('stats.firstResult',{attack:stats?.first400Attack??0})}</span>{/if}
              {#if status==='paused'}<button class="primary" on:click|stopPropagation={togglePause}>{t('play.resume')}</button>{:else}<button data-testid="start" class="primary" disabled={!mounted} on:click|stopPropagation={()=>start()}>{status==='ready'?t('play.start'):t('play.again')}</button>{/if}
            </div>
          {/if}
        </div>
      </div>
      <aside class="next-side"><h2>NEXT</h2>{#each nextCells as cells,i}<div class="mino-box" class:next-first={i===0}><PiecePreview {cells} label={t('aria.next',{index:i+1})} /></div>{/each}<span class="cap-label">CAP {cap}</span></aside>
    </div>
    <div class="action-readout">{#if touchEditing}<span>{tt('editing')}</span>{/if}<strong>{lastAction==='READY'?t('status.ready'):lastAction}</strong><span>{lastAttack?`+${lastAttack}`:''}</span><span class="incoming-count">{t('garbage.pending',{pending,reserved:reserved?t('garbage.reserved',{count:reserved}):''})}</span>{#if assist}<span>{t('play.assist')}</span>{/if}</div>
  </section>
  {#if showTouch}<TouchControls preferences={touchPreferences} {orientation} editing={touchEditing} active={status==='running'&&!modal&&!isReplay&&!touchEditing} onPress={touchPress} onRelease={touchRelease} onMove={touchMove}/>{/if}
  <section class="bottom-deck" aria-label={t('aria.controls')}>
    <div class="session-hud"><div><span>PIECES</span><strong><b data-testid="pieces">{stats?.pieces??0}</b><small>{session?.config.continueAfter400?' / ∞':' / 400'}</small></strong></div><div><span>ATTACK</span><strong>{stats?.attack??0}</strong></div><div><span>APP</span><strong>{(stats?.app??0).toFixed(3)}</strong></div><div><span>APM</span><strong>{(stats?.apm??0).toFixed(1)}</strong></div><div><span>PPS</span><strong>{(stats?.pps??0).toFixed(2)}</strong></div><div><span>TIME</span><strong>{time(stats?.time??0)}</strong></div></div>
    <div class="progress-track" aria-label={t('aria.progress')}><div style={`width:${progress}%`}></div></div>
    <div class="play-actions"><button disabled={!locked} on:click={togglePause}>{status==='paused'?t('play.resume'):t('status.paused')}</button><button data-testid="restart" disabled={!mounted} on:click={start}>{t('play.restart')}</button><button data-testid="undo" disabled={!canUndo} on:click={()=>history('undo')}>{t('play.undo')}</button><button data-testid="redo" disabled={!canRedo} on:click={()=>history('redo')}>{t('play.redo')}</button><button disabled={!locked} on:click={end}>{t('play.stop')}</button></div>
  </section>
</main>
{#if error||notice}<div class="toast" class:error={Boolean(error)} role={error?'alert':'status'}><span>{error||notice}</span><button aria-label={t('aria.dismiss')} on:click={()=>{error='';notice='';}}>×</button></div>{/if}
{#if modal}
  <dialog bind:this={dialog} class="drawer" on:cancel|preventDefault={closePanel} aria-label={modal==='settings'?t('panel.settings'):modal==='replay'?t('nav.replay'):modal==='stats'?t('nav.stats'):t('nav.help')}>
    <div class="drawer-bar"><strong>{modal==='settings'?t('panel.settings'):modal==='replay'?t('nav.replay'):modal==='stats'?t('panel.stats'):t('nav.help')}</strong><button data-testid="close-panel" aria-label={t('aria.close')} on:click={closePanel}>{t('panel.close')}</button></div>
    <div class="drawer-body">
      {#if modal==='settings'}
        <label class="language-select">{t('language.label')}<select data-testid="language-select" value={$localePreference} on:change={e=>setLocalePreference(e.currentTarget.value as LocalePreference)}><option value="auto">{t('language.auto')}</option>{#each SUPPORTED_LOCALES as language}<option value={language.code}>{language.name}</option>{/each}</select></label>
        <TouchSettings preferences={touchPreferences} {orientation} onChange={setTouchPreferences} onEdit={editTouch}/>
        <PracticeSettings bind:config={draft} disabled={isReplay} />
        <div class="panel-actions"><button on:click={()=>saveSettings()}>{t('settings.save')}</button><button disabled={status!=='paused'||isReplay} on:click={()=>saveSettings(true)}>{t('settings.apply')}</button><button on:click={()=>{draft=structuredClone(DEFAULT_CONFIG);saveSettings();}}>{t('settings.defaults')}</button><button class="primary" on:click={()=>start()}>{t('settings.start')}</button></div>
      {:else if modal==='replay'}
        <h2>{t('replay.current')}</h2><div class="panel-actions"><button disabled={!saved} on:click={()=>watch(saved)}>{t('replay.watch')}</button><button disabled={busy||!saved} on:click={()=>saveReplay('ttr')}>{t('replay.saveTtr')}</button><button disabled={busy||!saved||!draft.ttrx} on:click={()=>saveReplay('ttrx')}>{t('replay.saveTtrx')}</button></div>
        <p class="muted">{t('replay.compatibility')}</p>
        <h2>{t('replay.import')}</h2><label>{t('replay.select')}<input data-testid="import-file" type="file" accept=".ttr,.ttrm,.ttrx,.json" disabled={busy} on:change={importFile} /></label>
        {#if imported}<div class="import-summary"><strong>{imported.name}</strong><p>{t('replay.summary',{user:imported.username,streams:imported.streams,events:imported.events})}</p><div class="panel-actions"><button disabled={!imported.session||busy} on:click={watchImported}>{t('replay.watchImported')}</button><button disabled={busy} on:click={()=>convert('source')}>{t('replay.original')}</button><button disabled={busy} on:click={()=>convert('ttrx')}>{t('replay.convert')}</button></div></div>{/if}
        <p class="muted">{t('replay.externalInfo')}</p>
      {:else if modal==='stats'}
        <h2>{t('stats.first400')}</h2><dl><div><dt>ATTACK</dt><dd>{stats?.first400Attack??0}</dd></div><div><dt>ATTACK / PIECE</dt><dd>{((stats?.first400Attack??0)/Math.max(1,Math.min(400,stats?.pieces??0))).toFixed(3)}</dd></div><div><dt>{t('stats.measurement')}</dt><dd>{stats?.checkpoint?t('stats.fixed'):t('stats.measuring')}</dd></div></dl>
        <h2>{t('stats.session')}</h2><dl>{#each [['TIME',time(stats?.time??0)],['ATTACK',stats?.attack??0],['APM',(stats?.apm??0).toFixed(2)],['PPS',(stats?.pps??0).toFixed(2)],['VS',(stats?.vsscore??0).toFixed(2)],['LINES SENT',stats?.sent??0],['LINES RECEIVED',stats?.received??0],['LINES',stats?.lines??0],['MAX COMBO',stats?.maxCombo??0],['MAX B2B',stats?.maxBtb??0],['SPINS',stats?.spins??0],['ALL CLEARS',stats?.allClears??0],['KEYS',stats?.inputs??0],['HOLDS',stats?.holds??0],['FLOOR',stats?.floor??1],['ALTITUDE',(stats?.altitude??0).toFixed(2)]] as [label,value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>
        <h2>{t('pressure.budgetTitle')}</h2><dl><div><dt>{t('pressure.recent')}</dt><dd data-testid="recent-attack-budget">{stats?.recentGenerated??0}</dd></div><div><dt>{t('pressure.remaining')}</dt><dd data-testid="remaining-attack-budget">{(stats?.remainingBudget??draft.incomingApm).toFixed(1)}</dd></div></dl><p class="muted">{t('pressure.budgetHint')}</p>
        <h2>{t('aria.garbage')}</h2><div class="packet-list">{#each packets as p}<span class={p.urgency} title={packetTitle(p)}>{p.amount}</span>{/each}</div>
      {:else}
        <h2>{t('help.controls')}</h2><p>{t('help.keys')}</p><p>{t('help.history')}</p><p>{t('help.measurement')}</p><p>{t('pressure.warningHint')}</p><p>{t('help.independent')}</p>
        <nav class="license-links"><a href="https://github.com/daejunnom/Spilink" target="_blank" rel="noreferrer">GitHub</a><a href={`${base}/licenses/triangle.txt`} target="_blank" rel="noreferrer">{t('license.triangle')}</a><a href={`${base}/licenses/clearra.txt`} target="_blank" rel="noreferrer">{t('license.clearra')}</a><a href={`${base}/licenses/ttrx.txt`} target="_blank" rel="noreferrer">{t('license.ttrx')}</a></nav>
      {/if}
    </div>
  </dialog>
{/if}
