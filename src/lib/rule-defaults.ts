/** Generic client defaults and explicitly selected practice rules are separate. */
export const CLIENT_TIMING_DEFAULTS = Object.freeze({
  garbageSpeed: 20, garbagePhase: 0, garbageQueue: false,
  garbageAre: 5, garbageAreBump: 12
});
export const SEASON_TWO_PC = Object.freeze({ allClearB2B: 1, duplicateB2B: false, b2bSends: true });
export const PRACTICE_TIMING_DEFAULTS = Object.freeze({ ...CLIENT_TIMING_DEFAULTS, garbagePhase: null });
export const expertPhase = (floor: number): number => 66 - 6 * floor;
export const REPLAY_PROFILE = 'practice-3';
export const REPLAY_VERSION = 3;
export const RULE_REVISION = 'season2-replay-1';
