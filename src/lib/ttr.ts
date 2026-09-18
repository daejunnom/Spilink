import { ATTACK_PACKETS, incomingPacketLimit } from './attack-packets.ts';
import { ATTACK_PACING } from './attack-source.ts';
import { SEASON_TWO_PC, REPLAY_PROFILE, REPLAY_VERSION, RULE_REVISION, expertPhase } from './rule-defaults.ts';
import type { Session } from './session.ts';
import { FLOOR_ALTITUDES } from './environment.ts';
import type { Config } from './config.ts';
export function newClears():Record<string,number>{
  return Object.fromEntries(['singles','doubles','triples','quads','pentas','realtspins','minitspins','minitspinsingles','tspinsingles','minitspindoubles','tspindoubles','minitspintriples','tspintriples','minitspinquads','tspinquads','tspinpentas','allclear'].map(k=>[k,0]));
}
export function nativeOptions(c:Config){
  return {version:19,seed:c.seed,seed_random:false,gameid:1,username:c.playerName,
    boardwidth:10,boardheight:20,boardbuffer:20,bagtype:c.bagType,kickset:'SRS+',allow180:true,
    spinbonuses:c.spinBonuses,combotable:'multiplier',hasgarbage:true,garbageblocking:'combo blocking',
    zenith:true,zenith_expert:true,zenith_messy:true,zenith_mods:['expert','messy'],
    g:c.gravity,gincrease:c.gravityIncrease?c.gravityRate:0,gravitymay20g:true,
    garbagemultiplier:c.attackMultiplier,receivemultiplier:c.receiveMultiplier,cancelmultiplier:c.cancelMultiplier,
    garbagecap:c.garbageCap,garbagecapmax:c.garbageCap,garbageabsolutecap:c.absoluteCap,
    garbagequeue:c.garbageQueue,garbagespeed:c.garbageSpeed,garbagephase:c.garbagePhase??expertPhase(c.floor),
    garbageentry:c.garbageEntry,garbageare:c.garbageAre,garbagearebump:c.garbageAreBump,
    are:c.are,lineclear_are:c.lineClearAre,locktime:c.lockTime,clutch:c.clutch,nolockout:c.noLockout,display_hold:true,infinite_hold:false,
    b2bcharging:true,b2bcharge_at:c.chargeAt,b2bcharge_base:c.chargeBase,b2bchaining:false,
    garbagespecialbonus:c.specialBonus,allclear_garbage:c.allClearGarbage,allclear_b2b:c.allClearB2B,allclear_b2b_dupes:SEASON_TWO_PC.duplicateB2B,allclear_b2b_sends:SEASON_TWO_PC.b2bSends,
    messiness_inner:c.messinessInner??.05*c.floor+.25,messiness_change:c.messinessChange??2.5*(.05*c.floor+.25),garbagefavor:c.garbageFavor??-3*c.floor-25,messiness_nosame:c.noSameHole,roundmode:c.roundMode,
    objective_type:'none',objective_result:'score',countdown:false,prestart:0,precountdown:0,
    handling:{arr:c.arr,das:c.das,dcd:c.dcd,sdf:c.sdf,safelock:c.safelock,cancel:c.cancel,may20g:c.may20g,irs:c.irs,ihs:c.ihs}};
}
export function makeReplay(session:Session){
  const c=session.initialConfig,s=session.summary(),source=session.replaySource();
  const reason=session.status==='completed'?'clear':session.status==='topout'?'topout':null;
  let id=0;
  const senderIds = new Map([...new Set(source.attacks.map(e => e.source))].map((source,index) => [source,index+2]));
  const attacks=source.attacks.filter(e=>e.amount>0).map(e=>{
    const iid=++id;
    return {frame:e.frame,type:'ige',data:{id:iid,frame:e.frame,type:'interaction',data:{type:'garbage',amt:e.amount,gameid:senderIds.get(e.source),frame:e.frame,iid,ackiid:0,zthalt:e.altitude??c.senderAltitude??c.altitude??FLOOR_ALTITUDES[c.floor],active:false,size:1,x:5,y:21}}};
  });
  // This input already exists in the constructor for own playback; the native stream needs it too.
  const initial=c.initialPending>0?[{frame:0,type:'ige',data:{id:++id,frame:0,type:'interaction',data:{type:'garbage',gameid:0,frame:0,iid:0,ackiid:0,amt:c.initialPending,zthalt:c.senderAltitude??c.altitude??FLOOR_ALTITUDES[c.floor],active:false,size:1,x:5,y:21}}}]:[];
  const settings=source.changes?.map(e=>({frame:e.frame,type:'ige',data:{id:++id,type:'custom',data:{type:'setoptions',data:{options:nativeOptions(e.config)}}}}))??[];
  const events=[...initial,...settings,...attacks,...source.keys].map((event,index)=>({event,index})).sort((a,b)=>a.event.frame-b.event.frame||a.index-b.index).map(x=>x.event);
  const queue=c.initialQueue.match(/i5|[ijlostz]/gi)?.map(x=>x.toLowerCase()).join(',')??'';
  return {version:1,id:null,gamemode:'custom',ts:new Date().toISOString(),users:[{id:null,username:c.playerName,avatar_revision:0,banner_revision:0,flags:0,country:null}],
    replay:{frames:session.frame,events:[{frame:0,type:'start',data:{}},...events,{frame:session.frame,type:'end',data:{reason}}],
      options:{...nativeOptions(c),map:session.initialMap+(queue?'?'+queue:'')},
      results:{aggregatestats:{apm:s.apm,pps:s.pps,vsscore:s.vsscore},gameoverreason:reason,
        stats:{lines:s.lines,level_lines:0,level_lines_needed:1,inputs:s.inputs,holds:s.holds,score:s.score,zenlevel:1,zenprogress:0,level:1,
          combo:session.rules.combo,topcombo:session.rules.topCombo,combopower:0,btb:session.rules.btb,topbtb:session.rules.topBtb,btbpower:0,tspins:s.spins,piecesplaced:s.pieces,
          clears:{...session.clears},garbage:{sent:s.sent,sent_nomult:session.sentNomult,maxspike:session.maxSpike,maxspike_nomult:session.maxSpikeNomult,received:s.received,attack:s.attack,cleared:session.clearedGarbage},kills:0,
          zenith:{altitude:s.altitude,rank:session.environment.rank,peakrank:session.environment.peakRank,avgrankpts:session.environment.rankSum,floor:s.floor,targetingfactor:3,targetinggrace:s.targetingGrace,totalbonus:session.environment.totalBonus,revives:0,revivesTotal:0,revivesMaxOfBoth:0,speedrun:false,speedrun_seen:false,splits:[...session.environment.splits]},
          finaltime:Math.max(session.frame,session.ticks)/60*1000}}},
    spilink:{attackSource:{version:ATTACK_PACING.version,rateUnit:'raw-damage-per-minute',windowFrames:ATTACK_PACING.framesPerMinute,budget:'rolling-actual-raw',packetPolicy:ATTACK_PACKETS.version,initialPacketCap:incomingPacketLimit(c),virtualSenders:false},version:REPLAY_VERSION,profile:REPLAY_PROFILE,ruleRevision:RULE_REVISION,expectedEnd:source.expectedEnd,ticks:session.ticks,settings:structuredClone(c),changes:source.changes??[],attacks:source.attacks,first400:structuredClone(session.measure.checkpoint),usedUndo:session.usedUndo,status:session.status,summary:s,officialPlayback:false,
      compatibility:{structure:'v1',rules:19,externalSimulation:'not-verified'},unsupportedStatistics:['finesse']}};
}
