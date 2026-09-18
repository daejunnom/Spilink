import { AppError } from './errors.ts';
import { Engine } from './vendor/integrated.js';
import { validateConfig, type Config } from './config.ts';
import type { ClearEvent, EnginePort, KeyFrame } from './port.ts';
import { AttackRules, Measurement, Random } from './rules.ts';
import { AttackSource, Receiver, type RawAttack } from './garbage.ts';
import { Environment } from './environment.ts';
import { Supply } from './supply.ts';
import { makeReplay, newClears } from './ttr.ts';
export type Status = 'ready' | 'running' | 'paused' | 'completed' | 'topout' | 'stopped';
export type IncomingEvent = { frame: number; amount: number; source: number; assisted: boolean; altitude?: number };
export type SettingEvent = { frame: number; tick: number; config: Config };
export type ReplaySource = { keys: KeyFrame[]; attacks: IncomingEvent[]; endFrame: number; ticks: number; changes?: SettingEvent[] };
export class Session {
  engine: EnginePort; config: Config; status: Status = 'ready';
  ticks = 0; initialConfig: Config; environment: Environment; supply: Supply;
  changes: SettingEvent[] = []; private changeCursor = 0;
  sentNomult = 0; maxSpike = 0; maxSpikeNomult = 0; spike = 0; spikeNomult = 0; spikeTimer = 0;
  score = 0; clears = newClears(); private spawnAt: number | null = null;
  initialMap = ''; releaseOnResume = false; usedUndo = false;
  private history: SessionSnapshot[] = []; private historyIndex = 0;

  rules = new AttackRules(); measure = new Measurement(); receiver: Receiver; source: AttackSource;
  events: KeyFrame[] = []; incoming: IncomingEvent[] = [];
  inputs = 0; holds = 0; lines = 0; clearedGarbage = 0; sent = 0; spins = 0; allClears = 0;
  lastAction = 'READY'; lastAttack = 0; assistActive = false;
  playback: ReplaySource | null; private keyCursor = 0; private attackCursor = 0;
  constructor(input: Config, playback: ReplaySource | null = null) {
    this.config = validateConfig(input); this.initialConfig = structuredClone(this.config); this.playback = playback;
    this.environment = new Environment(this.config); this.supply = new Supply(this.config.seed,this.config.initialQueue);
    const c = this.config;
    const constant = (value: number) => ({ value, increase: 0, marginTime: 0 });
    this.receiver = new Receiver(c); this.source = new AttackSource(c);
    this.engine = new Engine({
      queue: { type: '7-bag', minLength: 14, seed: c.seed },
      board: { width: 10, height: 20, buffer: 20 }, kickTable: 'SRS+',
      options: { spinBonuses: c.spinBonuses, comboTable: 'multiplier', garbageTargetBonus: 'none', clutch: true, garbageBlocking: 'combo blocking', stock: 0 },
      gravity: { value: c.gravity, increase: 0, marginTime: 0 },
      garbage: {
        cap: { ...constant(c.garbageCap), absolute: 0, max: 40 },
        messiness: { change: 1, within: 0.3, nosame: false, timeout: 0, center: false },
        garbage: { speed: 20, holeSize: 1 }, multiplier: constant(c.attackMultiplier),
        bombs: false, seed: c.seed, boardWidth: 10, rounding: 'down', openerPhase: 0, specialBonus: c.specialBonus
      },
      handling: { arr: c.arr, das: c.das, dcd: c.dcd, sdf: c.sdf, safelock: c.safelock, cancel: c.cancel, may20g: c.may20g, irs: c.irs, ihs: c.ihs },
      pc: { garbage: 10, b2b: 0 }, b2b: { chaining: false, charging: { at: c.chargeAt, base: c.chargeBase } },
      misc: { movement: { infinite: false, lockResets: 15, lockTime: c.lockTime, may20G: true }, allowed: { spin180: true, hardDrop: true, hold: true, undo: false, retry: false }, infiniteHold: false, stride: false, date: new Date('2026-09-12T00:45:01Z') }
    });
    const random = new Random((c.seed + 271) % 2147483646 + 1);
    for (let y = 0; y < c.initialGarbage; y++) {
      const hole = Math.floor(random.next() * 10);
      this.engine.board.state[y] = Array.from({ length: 10 }, (_, x) => x === hole ? null : { mino: 'gb' });
    }
    if (c.initialBoard) {
      const rows=c.initialBoard.split(/\r?\n/).reverse();
      this.engine.board.state=Array.from({length:40},(_,y)=>Array.from({length:10},(_,x)=>{
        const v=rows[y]?.[x]?.toLowerCase() ?? '.';return v==='.'?null:{mino:v==='g'?'gb':v==='x'?'gbd':v};
      }));
    }
    this.initialMap=[...this.engine.board.state].reverse().map(row=>row.map(v=>v===null?'_':v.mino==='gb'?'#':v.mino==='gbd'?'@':v.mino).join('')).join('');
    this.engine.spilinkHooks = { canTick: () => this.status === 'running', clear: e => this.finishClear(e), input: e => this.consumed(e), held: () => { this.holds++; }, score: n => { this.score += n; }, next: () => this.pullPiece() };
    this.engine.initiatePiece(this.pullPiece()); this.engine.glock=c.startGrace;
    this.receiver.config=this.environment.effective(c);
    if(c.initialPending)this.receiver.receive(c.initialPending,0,0);
    this.history=[this.snapshot()];
  }
  get frame(): number { return this.engine.frame; }
  get height(): number {
    for (let y = this.engine.board.state.length - 1; y >= 0; y--) if (this.engine.board.state[y].some(Boolean)) return y + 1;
    return 0;
  }
  get sleeping(): boolean { return this.spawnAt !== null; }
  get canUndo(): boolean { return !this.playback && this.historyIndex>0; }
  get canRedo(): boolean { return !this.playback && this.historyIndex<this.history.length-1; }
  private pullPiece() {
    const piece=this.supply.pull(this.config,this.receiver.cancelStreak);
    this.engine.queue.splice(0,this.engine.queue.length,...this.supply.values);return piece;
  }
  start(): void { if(this.status==='ready'||this.status==='paused')this.status=!this.sleeping&&this.engine.toppedOut?'topout':'running'; }
  pause(): void { if(this.status==='running')this.status='paused'; }
  stop(): void { if(['ready','running','paused'].includes(this.status))this.status='stopped'; }
  applySettings(input:Config):void {
    if(this.status==='running'||this.playback)throw new AppError('error.pauseRequired');
    const next=validateConfig(input);
    for(const key of ['seed','bagType','initialQueue','initialBoard','initialGarbage','initialPending','startGrace'] as const)if(next[key]!==this.config[key])throw new AppError('error.restartRequired');
    this.branch();this.environment.change(this.config,next);this.config=next;this.syncConfig();
    this.changes.push({frame:this.frame,tick:this.ticks,config:structuredClone(next)});
  }
  private syncConfig():void {
    const c=this.environment.effective(this.config);this.receiver.config=c;
    this.engine.dynamic.gravity.set(c.gravity);this.engine.misc.movement.lockTime=c.lockTime;this.engine.gameOptions.spinBonuses=c.spinBonuses;
    Object.assign(this.engine.handling,{arr:c.arr,das:c.das,dcd:c.dcd,sdf:c.sdf,safelock:c.safelock,cancel:c.cancel,may20g:c.may20g,irs:c.irs,ihs:c.ihs});
  }
  private consumed(event:KeyFrame):void {
    this.events.push(structuredClone(event));
    if(event.type==='keydown' && !(event.data.key==='hardDrop'&&this.engine.falling.safeLock!==0))this.inputs++;
  }
  private releaseKeys():KeyFrame[]{
    const keys:string[]=[];
    if(this.engine.input.lShift.held)keys.push('moveLeft');if(this.engine.input.rShift.held)keys.push('moveRight');
    for(const [key,held] of Object.entries(this.engine.input.keys))if(held)keys.push(key);
    return keys.map(key=>({frame:this.frame,type:'keyup',data:{key:key as KeyFrame['data']['key'],subframe:0}}));
  }
  private applyReplayChanges():void {
    if(!this.playback)return;
    while(this.changeCursor<(this.playback.changes?.length??0)&&this.playback.changes![this.changeCursor].tick===this.ticks){
      const change=this.playback.changes![this.changeCursor++];
      this.environment.change(this.config,change.config);this.config=structuredClone(change.config);this.changes.push(structuredClone(change));
    }
    this.syncConfig();
  }
  tick(input: KeyFrame[] = []): void {
    if(this.status!=='running')return;
    this.applyReplayChanges();
    if(this.playback&&this.ticks>=this.playback.ticks){this.stop();return;}
    if((this.config.maxDuration&&this.frame>=this.config.maxDuration*60)||this.events.length>=500000||this.incoming.length>=100000){this.stop();return;}
    this.branch();const before=this.measure.pieces,frame=this.frame;
    this.syncConfig();let keys=input;const attacks:RawAttack[]=[];
    if(this.playback){
      keys=[];
      while(this.keyCursor<this.playback.keys.length&&this.playback.keys[this.keyCursor].frame===frame)keys.push(this.playback.keys[this.keyCursor++]);
      while(this.attackCursor<this.playback.attacks.length&&this.playback.attacks[this.attackCursor].frame===frame){const event=this.playback.attacks[this.attackCursor++];this.incoming.push(structuredClone(event));this.assistActive=event.assisted;if(event.amount)attacks.push(event);}
    }else{
      const next=this.source.next(frame,this.receiver.config,Math.max(this.height,this.receiver.size+this.receiver.reserved));
      if(next){const event={frame,amount:next.amount,source:1,assisted:next.assisted,altitude:this.config.senderAltitude??this.environment.altitude};this.assistActive=event.assisted;this.incoming.push(event);if(event.amount)attacks.push(event);}
    }
    if(this.releaseOnResume&&!this.playback){keys=[...this.releaseKeys(),...keys];this.releaseOnResume=false;}
    for(const e of keys)if(e.frame!==frame||!Number.isFinite(e.data.subframe)||e.data.subframe<0||e.data.subframe>=1)throw new Error('Invalid input time.');
    this.receiver.receiveBatch(attacks,frame);
    this.engine.tick(keys);this.ticks++;
    if(this.status==='running'){
      if(this.spikeTimer>0&&--this.spikeTimer===0){this.spike=0;this.spikeNomult=0;}
      this.receiver.advance(this.frame);
      const rise=this.receiver.applyScheduled(this.engine.board.state,this.frame,this.sleeping);
      if(rise.overflow)this.status='topout';else if(rise.rows&&!this.sleeping)this.pushFalling();
      if(this.status==='running'&&this.spawnAt!==null&&this.frame>=this.spawnAt){this.spawnAt=null;this.engine.nextPiece();if(this.engine.toppedOut)this.status='topout';}
      const perma=this.environment.tick(this.frame,this.config);
      if(perma&&this.status==='running'){
        const top=this.engine.board.state.pop();this.engine.board.state.unshift(Array.from({length:10},()=>({mino:'gbd'})));
        if(top?.some(Boolean))this.status='topout';else if(!this.sleeping)this.pushFalling();
      }
    }
    if(this.playback&&this.ticks>=this.playback.ticks){this.applyReplayChanges();if(this.status==='running')this.stop();}
    if(!this.playback&&before!==this.measure.pieces){this.history.push(this.snapshot());this.historyIndex=this.history.length-1;if(this.history.length>64){this.history.shift();this.historyIndex--;}}
  }
  private pushFalling():void {
    while(this.engine.falling.absoluteBlocks.some(([x,y])=>this.engine.board.state[y]?.[x]!==null)){
      if(this.engine.falling.absoluteBlocks.some(([,y])=>y>=39)){this.status='topout';return;}
      this.engine.falling.location[1]++;this.engine.falling.highestY++;
    }
  }
  private finishClear(e: ClearEvent): unknown {
    const frame = this.frame + this.engine.subframe;
    this.receiver.beforeClear(e,this.frame,this.engine.falling.x,this.engine.falling.absoluteBlocks,this.engine.board.state);
    const attacks = this.rules.resolve(e,this.receiver.config,n=>this.receiver.round(n));
    this.countClear(e);
    let total = 0, sent = 0;
    for(const attack of attacks){
      total+=attack.amount;const cancelled=this.receiver.cancelled;const out=this.receiver.cancel(attack.amount,this.engine.board.state,this.frame);sent+=out;
      if(out&&this.receiver.config.attackMultiplier)this.sentNomult+=Math.floor(out/this.receiver.config.attackMultiplier);
      if(out)this.environment.award(out,true,this.config);if(this.receiver.cancelled>cancelled)this.environment.award(0,false,this.config);
    }
    if (sent) {
      this.spike += sent;
      const multiplier = this.receiver.config.attackMultiplier;
      const surge = attacks.filter(a=>a.kind==='surge').reduce((n,a)=>n+a.amount,0);
      this.spikeNomult += multiplier ? Math.floor((sent-surge)/multiplier) : 0;
      this.maxSpike = Math.max(this.maxSpike,this.spike);
      this.maxSpikeNomult = Math.max(this.maxSpikeNomult,this.spikeNomult); this.spikeTimer=60;
    }
    this.sent += sent; this.lines += e.lines; this.clearedGarbage += e.garbageCleared;
    if (e.spin !== 'none') this.spins++;
    if (e.pc) this.allClears++;
    this.lastAttack = total;
    this.lastAction = attacks.some(a => a.kind === 'surge') ? 'B2B SURGE' : e.pc ? 'ALL CLEAR' : e.spin !== 'none' ? `${e.mino.toUpperCase()} ${e.spin === 'mini' ? 'MINI ' : ''}SPIN` : ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][e.lines] || 'PLACED';
    if(e.lines)this.receiver.riseLockedUntil=Math.max(this.receiver.riseLockedUntil,this.frame+this.config.garbageAreBump);
    const rise = e.lines === 0 && total === 0 ? this.receiver.take(this.engine.board.state, this.frame) : { rows: 0, overflow: false };
    const completed = this.measure.record(total, frame, this.config.continueAfter400);
    Object.assign(this.engine.stats, { combo: this.rules.combo - 1, b2b: this.rules.btb - 1, pieces: this.measure.pieces, lines: this.lines });
    Object.assign(this.engine.stats.garbage, { attack: this.measure.attack, sent: this.sent, receive: this.receiver.received, cleared: this.clearedGarbage });
    this.engine.lastWasClear = e.lines > 0;
    this.engine.resCache.lastLock = frame;
    this.engine.resCache.pieces++;
    this.engine.resCache.garbage.sent.push(sent);
    if (rise.overflow) this.status = 'topout';
    else if (completed) this.status = 'completed';
    else {
      const wait=Math.max(e.lines?this.config.lineClearAre:this.config.are,this.config.garbageEntry==='delayed'?rise.rows*this.config.garbageAre:0);
      if(wait>0){this.spawnAt=this.frame+wait;this.engine.state|=128;}
      else{this.engine.nextPiece();if(this.engine.toppedOut)this.status='topout';}
    }
    this.engine.lastSpin = null;
    return { mino: e.mino, lines: e.lines, spin: e.spin, garbageCleared: e.garbageCleared, garbage: sent ? [sent] : [], rawGarbage: attacks.map(a => a.amount), surge: attacks.filter(a => a.kind === 'surge').reduce((n, a) => n + a.amount, 0), stats: this.engine.stats, garbageAdded: false, topout: this.status === 'topout', keysPresses: [], pieceTime: 0 };
  }
  ghost(): [number, number][] {
    const blocks = this.engine.falling.absoluteBlocks.map(([x, y]) => [x, y] as [number, number]);
    let drop = 0;
    while (drop < 40 && blocks.every(([x, y]) => y - drop - 1 >= 0 && this.engine.board.state[y - drop - 1]?.[x] === null)) drop++;
    return blocks.map(([x, y]) => [x, y - drop]);
  }
  summary() {
    const seconds = this.frame / 60;
    return { score:this.score, altitude:this.environment.altitude, floor:this.receiver.config.floor, cancelStreak:this.receiver.cancelStreak, targetingGrace:this.receiver.targetingGrace, vsscore:(this.measure.attack+this.clearedGarbage)/Math.max(1,this.measure.pieces)*(this.measure.pieces/Math.max(1,seconds))*100, pieces: this.measure.pieces, attack: this.measure.attack, first400Attack: this.measure.first400Attack,
      checkpoint: this.measure.checkpoint, sent: this.sent, received: this.receiver.received, risen: this.receiver.risen,
      cancelled: this.receiver.cancelled, lines: this.lines, spins: this.spins, allClears: this.allClears, inputs: this.inputs, holds: this.holds,
      combo: Math.max(0, this.rules.combo - 1), btb: Math.max(0, this.rules.btb - 1), maxCombo: Math.max(0, this.rules.topCombo - 1), maxBtb: Math.max(0, this.rules.topBtb - 1),
      app: this.measure.attack / (this.measure.pieces || 1), apm: this.measure.attack / (this.frame / 3600 || 1), pps: this.measure.pieces / (seconds || 1), time: seconds };
  }
  private countClear(e:ClearEvent):void {
    const n=Math.min(4,e.lines);const ordinary=['','singles','doubles','triples','quads'];
    const normal=['realtspins','tspinsingles','tspindoubles','tspintriples','tspinquads'];
    const mini=['minitspins','minitspinsingles','minitspindoubles','minitspintriples','minitspinquads'];
    const key=e.spin==='normal'?normal[n]:e.spin==='mini'?mini[n]:ordinary[n];if(key)this.clears[key]++;
    if(e.pc)this.clears.allclear++;
    const points=e.spin==='normal'?[400,800,1200,1600,2600][n]:e.spin==='mini'?[100,200,400,800,1600][n]:[0,100,300,500,800][n];
    this.score+=e.pc?3500:points*(this.rules.btb>1?1.5:1)+Math.max(0,this.rules.combo-1)*50;
  }
  snapshot() {
    return { engine:this.engine.snapshot(),config:structuredClone(this.config),environment:this.environment.snapshot(),supply:this.supply.snapshot(),receiver:this.receiver.snapshot(),source:this.source.snapshot(),
      rules:{...this.rules},measure:structuredClone({...this.measure}),status:this.status,ticks:this.ticks,spawnAt:this.spawnAt,
      sentNomult:this.sentNomult,maxSpike:this.maxSpike,maxSpikeNomult:this.maxSpikeNomult,spike:this.spike,spikeNomult:this.spikeNomult,spikeTimer:this.spikeTimer,
      inputs:this.inputs,holds:this.holds,lines:this.lines,clearedGarbage:this.clearedGarbage,sent:this.sent,spins:this.spins,allClears:this.allClears,score:this.score,clears:{...this.clears},
      lastAction:this.lastAction,lastAttack:this.lastAttack,assistActive:this.assistActive,eventLength:this.events.length,incomingLength:this.incoming.length,changeLength:this.changes.length };
  }
  private restore(s:SessionSnapshot):void {
    this.engine.fromSnapshot(s.engine);this.config=structuredClone(s.config);this.environment.restore(s.environment);this.supply.restore(s.supply);this.receiver.restore(s.receiver);this.source.restore(s.source);
    Object.assign(this.rules,s.rules);Object.assign(this.measure,structuredClone(s.measure));
    for(const key of ['sentNomult','maxSpike','maxSpikeNomult','spike','spikeNomult','spikeTimer','status','ticks','spawnAt','inputs','holds','lines','clearedGarbage','sent','spins','allClears','score','lastAction','lastAttack','assistActive'] as const)Object.assign(this,{[key]:s[key]});
    this.clears={...s.clears};this.syncConfig();this.usedUndo=true;this.releaseOnResume=true;
    if(!['completed','topout','stopped'].includes(this.status))this.status='paused';
  }
  private branch():void {
    if(this.historyIndex>=this.history.length-1)return;
    const s=this.history[this.historyIndex];this.events.length=s.eventLength;this.incoming.length=s.incomingLength;this.changes.length=s.changeLength;this.history.length=this.historyIndex+1;
  }
  undo():boolean{if(!this.canUndo)return false;this.restore(this.history[--this.historyIndex]);return true;}
  redo():boolean{if(!this.canRedo)return false;this.restore(this.history[++this.historyIndex]);return true;}
  exportReplay(){return makeReplay(this);}
  replaySource():ReplaySource{return {keys:structuredClone(this.events.slice(0,this.historyIndex<this.history.length-1?this.history[this.historyIndex].eventLength:undefined)),attacks:structuredClone(this.incoming.slice(0,this.historyIndex<this.history.length-1?this.history[this.historyIndex].incomingLength:undefined)),changes:structuredClone(this.changes.slice(0,this.historyIndex<this.history.length-1?this.history[this.historyIndex].changeLength:undefined)),endFrame:this.frame,ticks:this.ticks};}
}
export type SessionSnapshot = ReturnType<Session['snapshot']>;
