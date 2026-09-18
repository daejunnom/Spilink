import { WINDUP, windupEnd, type WindupNotice } from './windup.ts';
import type { Config } from './config.ts';
import type { ClearEvent, Tile } from './port.ts';
import { Random, splitLargeAttack } from './rules.ts';
import { expertPhase } from './rule-defaults.ts';
import { garbageCeilingFull } from './survival.ts';
import { FLOOR_ALTITUDES } from './environment.ts';
export { FLOOR_ALTITUDES } from './environment.ts';
export type Packet = { id: number; source: number; amount: number; status: 'sleeping' | 'caution' | 'danger' | 'spawn'; first: boolean; delay: number; active: boolean; hardened: boolean; shielded?: boolean; queued?: boolean; column?: number; size?: number };
type Timer = { at: number; kind: 'enter' | 'hit' | 'phase'; packet: Packet };
export type Rise = { at: number; column: number; hardened: boolean; packetId: number; size: number };
export type RawAttack = { amount: number; source: number; altitude?: number; column?: number; hardened?: boolean; iid?: number; ackiid?: number };
export class Receiver {
  pending: Packet[] = []; timers: Timer[] = []; continuous: Rise[] = []; delayed: Rise[] = [];
  windups: WindupNotice[] = [];
  received = 0; risen = 0; cancelled = 0; nextId = 0; windupUntil = 0; riseLockedUntil = 0;
  cancelStreak = 0; targetingGrace = 0; lastAttack = 0; lastTank = 0; staleFrame = 0; stalePieces = 0;
  lastColumn: number | null = null; changedColumn = false;
  spinColumns: number[] = []; ljColumns: number[] = []; quadColumns: number[] = []; spinHistory: string[] = [];
  random: Random; config: Config;
  private seen = new Map<number,number>();
  constructor(config: Config) { this.config = config; this.random = new Random(config.seed); }
  get size(): number { return this.pending.reduce((n,p) => n+p.amount,0) + this.continuous.length; }
  get reserved(): number { return this.timers.filter(t => t.kind === 'enter').reduce((n,t) => n+t.packet.amount,0) + this.delayed.length; }
  get phase(): number { return this.config.garbagePhase ?? expertPhase(this.config.floor); }
  get inner(): number { return this.config.messinessInner ?? .05*this.config.floor+.25; }
  get change(): number { return this.config.messinessChange ?? 2.5*(.05*this.config.floor+.25); }
  round(n: number): number {
    const whole = Math.floor(n), part = n-whole;
    return whole + (this.config.roundMode === 'rng' && part > 0 && this.random.next() < part ? 1 : 0);
  }
  private adjusted(raw: RawAttack, frame: number): Packet | null {
    if (!Number.isInteger(raw.amount) || raw.amount < 0 || raw.amount > 10000 || !Number.isFinite(raw.source)) throw new Error('Invalid incoming attack.');
    if (raw.iid !== undefined) {
      if (!Number.isSafeInteger(raw.iid)) throw new Error('Invalid interaction id.');
      if (raw.iid <= (this.seen.get(raw.source) ?? -1)) return null;
      this.seen.set(raw.source,raw.iid);
    }
    const self = this.config.altitude ?? FLOOR_ALTITUDES[this.config.floor];
    const sender = raw.altitude ?? this.config.senderAltitude ?? self;
    if (!Number.isFinite(sender) || sender < 0) throw new Error('Invalid sender altitude.');
    const effectiveSender = Math.max(Math.min(3500,sender),Math.min(2000,self-1000));
    let amount = raw.amount, delay = this.phase;
    if (amount && effectiveSender < self) amount *= 1+.004*(self-effectiveSender)**2/(self+effectiveSender);
    if (this.config.cancelCorrection) {
      let cap = [4,4,5,6,7,8,9,10,Infinity,Infinity,Infinity][this.config.floor];
      if (this.windupUntil >= frame) cap = Math.min(6,cap);
      amount = Math.max(amount,Math.min(amount+.001*this.cancelStreak**2,cap));
      if (this.cancelStreak >= 25) delay = Math.floor(delay/2);
    }
    if (this.config.targetingGrace && this.targetingGrace > 8) amount *= 1-.05*(this.targetingGrace-8);
    amount = this.round(amount*this.config.receiveMultiplier);
    if (!amount) return null;
    const queuedAmount = this.pending.reduce((sum,p) => sum+p.amount,0), cap = this.config.absoluteCap;
    const shielded = cap > 0 && queuedAmount >= cap;
    if (cap && !shielded) amount = Math.min(amount,cap-queuedAmount);
    return { id: ++this.nextId, source: raw.source, amount, delay, active: false, first: false,
      status: this.config.garbageQueue && this.pending.length ? 'sleeping' : delay > 0 ? 'caution' : 'spawn',
      hardened: raw.hardened ?? false, shielded, queued: this.config.garbageQueue, column: raw.column, size: 1 };
  }
  receive(raw: number, frame: number, source = 1, altitude?: number): void { this.receiveBatch([{amount:raw,source,altitude}],frame); }
  receiveBatch(raw: RawAttack[], frame: number): void {
    const groups = new Map<number,Packet>(); const standalone: Packet[] = [];
    for (const attack of raw) {
      const p = this.adjusted(attack,frame); if (!p) continue;
      if (!p.source) standalone.push(p);
      else if (groups.has(p.source)) groups.get(p.source)!.amount += p.amount;
      else groups.set(p.source,p);
    }
    for (const packet of [...standalone,...groups.values()]) {
      if (packet.amount < 8) this.enter(packet,frame);
      else {
        const parts = splitLargeAttack(packet.amount,this.config.altitude ?? FLOOR_ALTITUDES[this.config.floor]);
        const start = Math.max(frame,this.windupUntil);
        this.windupUntil = start+WINDUP.reservationFrames+WINDUP.partSpacingFrames*parts.length;
        this.windups.push({id:packet.id,start,parts:parts.length,amount:parts.reduce((sum,n)=>sum+n,0),source:packet.source});
        parts.forEach((amount,i) => this.timers.push({at:start+WINDUP.firstPartFrames+WINDUP.partSpacingFrames*i,kind:'enter',packet:{...packet,id:++this.nextId,amount}}));
      }
    }
  }
  private enter(packet: Packet, frame: number): void {
    this.pending.push(packet); this.received += packet.amount; this.lastAttack = frame; this.stalePieces = 0;
    if (this.config.targetingGrace) this.targetingGrace += Math.max(0,Math.min(18-this.targetingGrace,packet.amount));
    if (this.config.garbageSpeed === 0) this.hit(packet,frame);
    else this.timers.push({at:frame+this.config.garbageSpeed,kind:'hit',packet});
  }
  private hit(packet: Packet, frame: number): void {
    if (!this.pending.includes(packet)) return;
    if (packet.shielded) { this.pending.splice(this.pending.indexOf(packet),1); this.wake(frame); return; }
    packet.active = true; this.progress(packet,frame);
  }
  private wake(frame: number): void { if (this.pending[0]?.status === 'sleeping') this.progress(this.pending[0],frame); }
  private progress(packet: Packet, frame: number): void {
    if (!this.pending.includes(packet) || !packet.active) return;
    if (packet.status === 'sleeping') {
      if (this.pending[0] !== packet) return;
      packet.status = packet.delay > 0 ? 'caution' : 'spawn';
    } else if (packet.status === 'caution') {
      if (packet.first) packet.status = 'danger';
    } else if (packet.status === 'danger') packet.status = 'spawn';
    else return;
    packet.first = true;
    if (packet.delay <= 0) { packet.status = 'spawn'; return; }
    if (packet.status !== 'spawn') this.timers.push({at:frame+packet.delay,kind:'phase',packet});
  }
  advance(frame: number): void {
    this.windups = this.windups.filter(n => frame < windupEnd(n));
    // Due events are visited in reverse insertion order. No wall-clock timers participate.
    for (let i = this.timers.length-1; i >= 0; i--) {
      const t = this.timers[i]; if (t.at > frame) continue;
      this.timers.splice(i,1);
      if (t.kind === 'enter') this.enter(t.packet,frame);
      else if (t.kind === 'hit') this.hit(t.packet,frame);
      else this.progress(t.packet,frame);
    }
    const interval = [0,4.8,3.9,2.1,1.4,1.3,.9,.6,.4,.3,.2][this.config.floor]*60;
    if (this.config.targetingGrace && this.targetingGrace > 0 && frame >= this.lastAttack+interval) { this.targetingGrace--; this.lastAttack=frame; }
    if (this.config.timeCancelFatigue && frame > this.staleFrame && (frame-this.staleFrame)%1800 === 0) this.cancelStreak += 5;
  }
  cancel(attack: number, board: Tile[][], frame: number): number {
    let outgoing=attack, defense=this.round(attack*(this.config.cancelMultiplier-1)), removed=0;
    for (let i=0;i<this.continuous.length && outgoing+defense>0;) {
      if (this.continuous[i].hardened) { i++; continue; }
      this.continuous.splice(i,1); if (outgoing) outgoing--; else defense--; removed++;
    }
    for (let i=0;i<this.pending.length && outgoing+defense>0;) {
      const p=this.pending[i]; if (p.hardened) { i++; continue; }
      const count=Math.min(p.amount,outgoing+defense), used=Math.min(outgoing,count);
      outgoing-=used; defense-=count-used; p.amount-=count; removed+=count;
      if (!p.amount) { this.pending.splice(i,1); this.wake(frame); this.boundary(board); } else i++;
    }
    this.cancelled+=removed; this.cancelStreak+=removed;
    return outgoing;
  }
  beforeClear(e: ClearEvent, frame: number, x: number, blocks: [number,number][] = [], board: Tile[][] = []): void {
    this.stalePieces++; if (this.stalePieces === 75) this.cancelStreak+=5;
    const fresh = () => { this.staleFrame=frame; this.stalePieces=0; };
    if (e.garbageCleared) { this.cancelStreak=0; this.lastTank=frame; fresh(); }
    if (e.lines && e.spin !== 'none') {
      if (e.mino === 'i') { this.cancelStreak=Math.max(0,this.cancelStreak-2); fresh(); }
      else if (['s','z','l','j'].includes(e.mino)) {
        const columns=['s','z'].includes(e.mino)?this.spinColumns:this.ljColumns;
        const old=columns.indexOf(x);if(old>=0)columns.splice(old,1);columns.push(x);
        if(columns.length>2){columns.shift();this.cancelStreak=Math.max(0,this.cancelStreak-2);fresh();}
      }
    }
    if (e.lines>=4) {
      this.cancelStreak=Math.max(0,this.cancelStreak-3); fresh();
      const col=blocks[0]?.[0]??x,old=this.quadColumns.indexOf(col);if(old>=0)this.quadColumns.splice(old,1);this.quadColumns.push(col);
      if(this.quadColumns.length>2){this.quadColumns.shift();this.cancelStreak=Math.max(0,this.cancelStreak-4);}
    }
    if(!e.lines&&e.mino==='i'&&blocks.length===4&&blocks.every(b=>b[0]===blocks[0][0])){
      const column=blocks[0][0],neighbor=({0:1,1:0,8:9,9:8} as Record<number,number>)[column];
      if(neighbor!==undefined&&blocks.every(([,y])=>board[y]?.[neighbor]?.mino==='i'))this.cancelStreak+=3;
    }
    if(e.lines&&e.spin!=='none'&&['s','z'].includes(e.mino)){if(this.spinHistory.filter(x=>x===e.mino).length>=5)this.cancelStreak+=2;this.spinHistory.push(e.mino);if(this.spinHistory.length>6)this.spinHistory.shift();}
    if(e.pc)this.cancelStreak+=3;
  }
  private boundary(board: Tile[][]): void { if (this.random.next()<this.change) { this.chooseColumn(board); this.changedColumn=true; } }
  chooseColumn(board: Tile[][]): number {
    let hole=-1;
    for (const row of board) { const x=row.findIndex(v=>v===null); if(x<0)continue; if(row.some(v=>v?.mino==='gb'||v?.mino==='gbd'))hole=x; break; }
    const favor=this.config.garbageFavor ?? -3*this.config.floor-25;
    if (!favor) {
      let x=Math.floor(this.random.next()*(this.config.noSameHole && this.lastColumn!==null?9:10));
      if(this.config.noSameHole && this.lastColumn!==null && x>=this.lastColumn)x++;
      return this.lastColumn=x;
    }
    const ranked=Array.from({length:10},(_,x)=>{
      let h=0;for(let y=board.length-1;y>=0;y--)if(board[y][x]){h=y+1;break;}
      return{x,score:(h?h+(hole<0?0:5*Math.abs(x-hole)):0)+.1*this.random.next(),weight:0};
    }).sort((a,b)=>a.score-b.score);
    let sum=0;
    ranked.forEach((r,i)=>{sum+=this.config.noSameHole&&r.x===this.lastColumn?0:Math.max(0,10+favor+i*((20-2*(10+favor))/9));r.weight=sum;});
    const n=this.random.next()*sum;
    return this.lastColumn=(ranked.find(r=>r.weight!==0&&n<=r.weight)??ranked[0]).x;
  }
  private push(board: Tile[][], row: Rise, frame: number): boolean {
    if (garbageCeilingFull(board)) return true;
    board.pop();
    const cells=Array.from({length:10},(_,x)=>x>=row.column&&x<row.column+row.size?null:{mino:'gb'});
    let perma=0;while(perma<board.length&&board[perma].every(v=>v?.mino==='gbd'))perma++;
    board.splice(perma,0,cells);this.risen++;this.cancelStreak=Math.max(0,this.cancelStreak-3);this.lastTank=this.staleFrame=frame;this.stalePieces=0;
    return false;
  }
  take(board: Tile[][], frame: number): {rows:number;overflow:boolean} {
    const deferred=this.pending.filter(p=>!(p.active&&p.status==='spawn'));
    this.pending=this.pending.filter(p=>p.active&&p.status==='spawn');
    let rows=0,overflow=false;
    while(rows<this.config.garbageCap&&this.pending.length){
      const p=this.pending[0];p.amount--;
      if(this.lastColumn===null||this.random.next()<this.inner)if(!this.changedColumn){this.chooseColumn(board);this.changedColumn=true;}
      const row: Rise={at:frame+this.config.garbageAre*(rows+1),column:p.column??this.lastColumn??0,size:p.size??1,hardened:p.hardened,packetId:p.id};
      if(this.config.garbageEntry==='continuous')this.continuous.push(row);
      else if(this.config.garbageEntry==='delayed')this.delayed.push(row);
      else overflow=this.push(board,row,frame)||overflow;
      rows++;this.changedColumn=false;
      if(!p.amount){this.pending.shift();this.boundary(board);}
      if(overflow)break;
    }
    this.pending.push(...deferred);this.wake(frame);
    if(rows&&this.config.garbageEntry==='continuous')this.riseLockedUntil=Math.max(this.riseLockedUntil,frame+this.config.garbageAre);
    return {rows,overflow};
  }
  applyScheduled(board: Tile[][], frame: number, sleeping: boolean, onRow?: () => boolean): {rows:number;overflow:boolean} {
    let rows=0,overflow=false;
    for(let i=this.delayed.length-1;i>=0;i--){const row=this.delayed[i];if(row.at>frame)continue;this.delayed.splice(i,1);overflow=this.push(board,row,frame)||overflow;rows++;if(!overflow&&!sleeping&&onRow&&!onRow())overflow=true;if(overflow)break;}
    if(!overflow&&!sleeping&&this.continuous.length&&frame>=this.riseLockedUntil){overflow=this.push(board,this.continuous.shift()!,frame);rows++;if(!overflow&&onRow&&!onRow())overflow=true;this.riseLockedUntil=frame+this.config.garbageAre;}
    return {rows,overflow};
  }
  snapshot(){ return structuredClone({windups:this.windups,pending:this.pending,timers:this.timers,continuous:this.continuous,delayed:this.delayed,
    received:this.received,risen:this.risen,cancelled:this.cancelled,nextId:this.nextId,windupUntil:this.windupUntil,riseLockedUntil:this.riseLockedUntil,
    cancelStreak:this.cancelStreak,targetingGrace:this.targetingGrace,lastAttack:this.lastAttack,lastTank:this.lastTank,staleFrame:this.staleFrame,stalePieces:this.stalePieces,
    lastColumn:this.lastColumn,changedColumn:this.changedColumn,spinColumns:this.spinColumns,ljColumns:this.ljColumns,quadColumns:this.quadColumns,spinHistory:this.spinHistory,randomState:this.random.state,seen:[...this.seen]}); }
  restore(value:ReturnType<Receiver['snapshot']>):void{const {randomState,seen,...rest}=structuredClone(value);Object.assign(this,rest);this.random.state=randomState;this.seen=new Map(seen);}
}
export { AttackSource } from './attack-source.ts';
