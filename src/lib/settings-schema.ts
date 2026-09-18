// Language-neutral field and action descriptors.
export const TOGGLE_FIELDS = [
        ['progression','setup.progression'],['cancelCorrection','setup.cancelCorrection'],['targetingGrace','setup.targetingGrace'],['timeCancelFatigue','setup.timeCancelFatigue'],['fatigue','setup.fatigue'],['garbageQueue','setup.garbageQueue'],['noSameHole','setup.noSameHole'],['attackIncrease','setup.attackIncrease'],['receiveIncrease','setup.receiveIncrease'],['lockDecrease','setup.lockDecrease']
      ] as const;
export const NUMERIC_FIELDS = [
          ['altitude','setup.altitude',0,100000,0.1],['senderAltitude','setup.senderAltitude',0,100000,0.1],['garbagePhase','setup.garbagePhase',0,36000,1],
          ['garbageSpeed','setup.garbageSpeed',0,36000,1],['absoluteCap','setup.absoluteCap',0,10000,1],['are','setup.are',0,300,1],['lineClearAre','setup.lineClearAre',0,300,1],['garbageAre','setup.garbageAre',1,300,1],['garbageAreBump','setup.garbageAreBump',0,300,1],
          ['messinessInner','setup.messinessInner',0,10,0.01],['messinessChange','setup.messinessChange',0,10,0.01],['garbageFavor','setup.garbageFavor',-1000,1000,1],
          ['attackCap','setup.attackCap',0,10000,1],['allClearGarbage','setup.allClearGarbage',0,10000,1],['allClearB2B','setup.allClearB2B',0,100,1],['initialPending','setup.initialPending',0,1000,1],['startGrace','setup.startGrace',0,36000,1],['maxDuration','setup.maxDuration',0,86400,1],
          ['attackRate','setup.attackRate',0,100,0.01],['receiveRate','setup.receiveRate',0,100,0.01],['lockRate','setup.lockRate',0,100,0.01],['lockMinimum','setup.lockMinimum',0,3600,1]
        ] as const;
export const KEY_ACTIONS = [['moveLeft','action.moveLeft'],['moveRight','action.moveRight'],['softDrop','action.softDrop'],['hardDrop','action.hardDrop'],['rotateCW','action.rotateCW'],['rotateCCW','action.rotateCCW'],['rotate180','action.rotate180'],['hold','action.hold'],['retry','action.retry'],['pause','status.paused'],['undo','play.undo'],['redo','play.redo']] as const;
