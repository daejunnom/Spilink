/*! Triangle.js 7837ee5bde8de2719472e0de3458abe6708593f5
Copyright (c) 2025 halp

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

// .cache/triangle/src/utils/events/hook.ts
var Hook = class {
  #emitter;
  #listeners = [];
  constructor(emitter) {
    this.#emitter = emitter;
  }
  on(event, cb) {
    this.#emitter.on(event, cb);
    this.#listeners.push([event, cb]);
    return this;
  }
  once(event, cb) {
    this.#emitter.once(event, cb);
    this.#listeners.push([event, cb]);
    return this;
  }
  off(event, cb) {
    this.#emitter.off(event, cb);
    this.#listeners = this.#listeners.filter(
      ([e, c]) => e !== event || c !== cb
    );
    return this;
  }
  destroy() {
    this.#listeners.forEach(([event, cb]) => {
      this.#emitter.off(event, cb);
    });
    this.#listeners = [];
  }
};

// .cache/triangle/src/utils/events/index.ts
var EventEmitter = class {
  #listeners;
  #maxListeners = {
    default: 10,
    overrides: /* @__PURE__ */ new Map()
  };
  /** Enables more debugging logs for memory leaks */
  verbose = false;
  constructor() {
    this.#listeners = [];
  }
  on(event, cb) {
    this.#listeners.push([event, cb, false]);
    const listeners = this.#listeners.filter(([e]) => e === event);
    if (listeners.length > (this.#maxListeners.overrides.get(event) ?? this.#maxListeners.default)) {
      console.warn(
        `Max listeners exceeded for event "${String(event)}". Current: ${this.#listeners.filter(([e]) => e === event).length}, Max: ${this.#maxListeners.overrides.get(event) ?? this.#maxListeners.default}. 
Trace: ${new Error().stack}`
      );
      if (this.verbose)
        console.warn(
          `Trace: ${new Error().stack}

Listeners:
`,
          listeners.map(([_, fn]) => fn.toString()).join("\n\n")
        );
    }
    return this;
  }
  off(event, cb) {
    this.#listeners = this.#listeners.filter(
      ([e, c]) => e !== event || c !== cb
    );
    return this;
  }
  emit(event, data) {
    const toRemove = /* @__PURE__ */ new Set();
    const listeners = [...this.#listeners];
    listeners.forEach(([e, cb, once], idx) => {
      if (e !== event) return;
      cb(data);
      if (once) toRemove.add(idx);
    });
    this.#listeners = this.#listeners.filter((_, idx) => !toRemove.has(idx));
    return this;
  }
  once(event, cb) {
    this.#listeners.push([event, cb, true]);
    return this;
  }
  removeAllListeners(event) {
    if (event) {
      this.#listeners = this.#listeners.filter(([e]) => e !== event);
    } else {
      this.#listeners = [];
    }
  }
  setMaxListeners(eventOrN, n) {
    const count = n ?? eventOrN;
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError("Max listeners must be a positive integer");
    }
    if (typeof eventOrN === "number") {
      this.#maxListeners.default = eventOrN;
    } else if (Array.isArray(eventOrN)) {
      eventOrN.forEach((event) => {
        this.#maxListeners.overrides.set(event, count);
      });
    } else {
      this.#maxListeners.overrides.set(eventOrN, count);
    }
  }
  get maxListeners() {
    return this.#maxListeners;
  }
  /**
   * @internal
   */
  set _maxListeners(data) {
    this.#maxListeners = data;
  }
  hook() {
    return new Hook(this);
  }
  export() {
    return {
      listeners: this.#listeners.map(([event, cb, once]) => ({
        event,
        cb,
        once
      })),
      maxListeners: this.#maxListeners,
      verbose: this.verbose
    };
  }
  import(data) {
    data.listeners.forEach(({ event, cb, once }) => {
      if (once) {
        this.once(event, cb);
      } else {
        this.on(event, cb);
      }
    });
    this.#maxListeners = data.maxListeners;
    this.verbose = data.verbose;
    return this;
  }
};

// .cache/triangle/src/engine/queue/types.ts
var Mino = /* @__PURE__ */ ((Mino6) => {
  Mino6["I"] = "i";
  Mino6["J"] = "j";
  Mino6["L"] = "l";
  Mino6["O"] = "o";
  Mino6["S"] = "s";
  Mino6["T"] = "t";
  Mino6["Z"] = "z";
  Mino6["GARBAGE"] = "gb";
  Mino6["BOMB"] = "bomb";
  return Mino6;
})(Mino || {});

// .cache/triangle/src/engine/utils/damageCalc/index.ts
var garbageData = {
  single: 0,
  double: 1,
  triple: 2,
  quad: 4,
  penta: 5,
  tspinMini: 0,
  tspin: 0,
  tspinMiniSingle: 0,
  tspinSingle: 2,
  tspinMiniDouble: 1,
  tspinMiniTriple: 2,
  tspinDouble: 4,
  tspinTriple: 6,
  tspinQuad: 10,
  tspinPenta: 12,
  backtobackBonus: 1,
  backtobackBonusLog: 0.8,
  comboMinifier: 1,
  comboMinifierLog: 1.25,
  comboBonus: 0.25,
  allClear: 10,
  comboTable: {
    none: [0],
    "classic guideline": [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
    "modern guideline": [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4]
  }
};
var garbageCalcV2 = (data, config) => {
  let garbage = 0;
  const { spin: rawSpin, lines, piece, combo, b2b, enemies } = data;
  const {
    spinBonuses,
    comboTable,
    garbageTargetBonus,
    b2b: b2bOptions
  } = config;
  const spin = rawSpin === "none" ? null : rawSpin;
  switch (lines) {
    case 0:
      garbage = spin === "mini" ? garbageData.tspinMini : spin === "normal" ? garbageData.tspin : 0;
      break;
    case 1:
      garbage = spin === "mini" ? garbageData.tspinMiniSingle : spin === "normal" ? garbageData.tspinSingle : garbageData.single;
      break;
    case 2:
      garbage = spin === "mini" ? garbageData.tspinMiniDouble : spin === "normal" ? garbageData.tspinDouble : garbageData.double;
      break;
    case 3:
      garbage = spin === "mini" ? garbageData.tspinMiniTriple : spin === "normal" ? garbageData.tspinTriple : garbageData.triple;
      break;
    case 4:
      garbage = spin ? garbageData.tspinQuad : garbageData.quad;
      break;
    case 5:
      garbage = spin ? garbageData.tspinPenta : garbageData.penta;
      break;
    default: {
      const t = lines - 5;
      garbage = spin ? garbageData.tspinPenta + 2 * t : garbageData.penta + t;
      break;
    }
  }
  if (spin && spinBonuses === "handheld" && piece.toUpperCase() !== "T") {
    garbage /= 2;
  }
  if (lines > 0 && b2b > 0) {
    if (b2bOptions.chaining) {
      const b2bGains = garbageData.backtobackBonus * (Math.floor(1 + Math.log1p(b2b * garbageData.backtobackBonusLog)) + (b2b == 1 ? 0 : (1 + Math.log1p(b2b * garbageData.backtobackBonusLog) % 1) / 3));
      garbage += b2bGains;
    } else {
      garbage += garbageData.backtobackBonus;
    }
  }
  if (combo > 0) {
    if (comboTable === "multiplier") {
      garbage *= 1 + garbageData.comboBonus * combo;
      if (combo > 1) {
        garbage = Math.max(
          Math.log1p(
            garbageData.comboMinifier * combo * garbageData.comboMinifierLog
          ),
          garbage
        );
      }
    } else {
      const comboTableData = garbageData.comboTable[comboTable] || [0];
      garbage += comboTableData[Math.max(0, Math.min(combo - 1, comboTableData.length - 1))];
    }
  }
  let garbageBonus = 0;
  if (lines > 0 && garbageTargetBonus !== "none") {
    let targetBonus = 0;
    switch (enemies) {
      case 0:
      case 1:
        break;
      case 2:
        targetBonus += 1;
        break;
      case 3:
        targetBonus += 3;
        break;
      case 4:
        targetBonus += 5;
        break;
      case 5:
        targetBonus += 7;
        break;
      default:
        targetBonus += 9;
    }
    if (garbageTargetBonus === "normal") {
      garbage += targetBonus;
    } else {
      garbageBonus = targetBonus;
    }
  }
  return {
    garbage,
    bonus: garbageBonus
  };
};

// .cache/triangle/src/engine/utils/increase/index.ts
var IncreaseTracker = class {
  #value;
  base;
  increase;
  margin;
  frame;
  constructor(base, increase, margin) {
    this.#value = this.base = base;
    this.increase = increase;
    this.margin = margin;
    this.frame = 0;
  }
  reset() {
    this.#value = this.base;
    this.frame = 0;
  }
  tick() {
    this.frame++;
    if (this.frame > this.margin) this.#value += this.increase / 60;
    return this.get();
  }
  get() {
    return this.#value;
  }
  set(value) {
    this.#value = value;
  }
};

// .cache/triangle/src/engine/utils/kicks/data.ts
var kicks = {
  SRS: {
    kicks: {
      "01": [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      10: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      12: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      21: [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      23: [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      32: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      30: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      "03": [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      "02": [
        [0, -1],
        [1, -1],
        [-1, -1],
        [1, 0],
        [-1, 0]
      ],
      13: [
        [1, 0],
        [1, -2],
        [1, -1],
        [0, -2],
        [0, -1]
      ],
      20: [
        [0, 1],
        [-1, 1],
        [1, 1],
        [-1, 0],
        [1, 0]
      ],
      31: [
        [-1, 0],
        [-1, -2],
        [-1, -1],
        [0, -2],
        [0, -1]
      ]
    },
    i_kicks: {
      "01": [
        [-2, 0],
        [1, 0],
        [-2, 1],
        [1, -2]
      ],
      10: [
        [2, 0],
        [-1, 0],
        [2, -1],
        [-1, 2]
      ],
      12: [
        [-1, 0],
        [2, 0],
        [-1, -2],
        [2, 1]
      ],
      21: [
        [1, 0],
        [-2, 0],
        [1, 2],
        [-2, -1]
      ],
      23: [
        [2, 0],
        [-1, 0],
        [2, -1],
        [-1, 2]
      ],
      32: [
        [-2, 0],
        [1, 0],
        [-2, 1],
        [1, -2]
      ],
      30: [
        [1, 0],
        [-2, 0],
        [1, 2],
        [-2, -1]
      ],
      "03": [
        [-1, 0],
        [2, 0],
        [-1, -2],
        [2, 1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i2_kicks: {
      "01": [
        [0, -1],
        [-1, 0],
        [-1, -1]
      ],
      10: [
        [0, 1],
        [1, 0],
        [1, 1]
      ],
      12: [
        [1, 0],
        [0, -1],
        [1, 0]
      ],
      21: [
        [-1, 0],
        [0, 1],
        [-1, 0]
      ],
      23: [
        [0, 1],
        [1, 0],
        [1, -1]
      ],
      32: [
        [0, -1],
        [-1, 0],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, 1],
        [-1, 2]
      ],
      "03": [
        [1, 0],
        [0, -1],
        [1, -2]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i3_kicks: {
      "01": [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ],
      10: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ],
      12: [
        [1, 0],
        [-1, 0],
        [0, -2],
        [0, 2]
      ],
      21: [
        [-1, 0],
        [1, 0],
        [0, 2],
        [0, -2]
      ],
      23: [
        [-1, 0],
        [1, 0],
        [0, 1],
        [0, -1]
      ],
      32: [
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1]
      ],
      30: [
        [-1, 0],
        [1, 0],
        [0, 0],
        [0, 0]
      ],
      "03": [
        [1, 0],
        [-1, 0],
        [0, 0],
        [0, 0]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    l3_kicks: {
      "01": [
        [-1, 0],
        [1, 0]
      ],
      10: [
        [1, 0],
        [-1, 0]
      ],
      12: [
        [0, -1],
        [0, 1]
      ],
      21: [
        [0, 1],
        [0, -1]
      ],
      23: [
        [1, 0],
        [-1, 0]
      ],
      32: [
        [-1, 0],
        [1, 0]
      ],
      30: [
        [0, 1],
        [0, -1]
      ],
      "03": [
        [0, -1],
        [0, 1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i5_kicks: {
      "01": [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      10: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      12: [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      21: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      23: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      32: [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      30: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      "03": [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    oo_kicks: {
      "01": [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      10: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      12: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      21: [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      23: [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      32: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      "03": [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      "02": [[0, -1]],
      13: [[1, 0]],
      20: [[0, 1]],
      31: [[-1, 0]]
    },
    additional_offsets: {},
    spawn_rotation: {},
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {}
  },
  "SRS+": {
    kicks: {
      "01": [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      10: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      12: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      21: [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      23: [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      32: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      30: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      "03": [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      "02": [
        [0, -1],
        [1, -1],
        [-1, -1],
        [1, 0],
        [-1, 0]
      ],
      13: [
        [1, 0],
        [1, -2],
        [1, -1],
        [0, -2],
        [0, -1]
      ],
      20: [
        [0, 1],
        [-1, 1],
        [1, 1],
        [-1, 0],
        [1, 0]
      ],
      31: [
        [-1, 0],
        [-1, -2],
        [-1, -1],
        [0, -2],
        [0, -1]
      ]
    },
    i_kicks: {
      "01": [
        [1, 0],
        [-2, 0],
        [-2, 1],
        [1, -2]
      ],
      10: [
        [-1, 0],
        [2, 0],
        [-1, 2],
        [2, -1]
      ],
      12: [
        [-1, 0],
        [2, 0],
        [-1, -2],
        [2, 1]
      ],
      21: [
        [-2, 0],
        [1, 0],
        [-2, -1],
        [1, 2]
      ],
      23: [
        [2, 0],
        [-1, 0],
        [2, -1],
        [-1, 2]
      ],
      32: [
        [1, 0],
        [-2, 0],
        [1, -2],
        [-2, 1]
      ],
      30: [
        [1, 0],
        [-2, 0],
        [1, 2],
        [-2, -1]
      ],
      "03": [
        [-1, 0],
        [2, 0],
        [2, 1],
        [-1, -2]
      ],
      "02": [[0, -1]],
      13: [[1, 0]],
      20: [[0, 1]],
      31: [[-1, 0]]
    },
    i2_kicks: {
      "01": [
        [0, -1],
        [-1, 0],
        [-1, -1]
      ],
      10: [
        [0, 1],
        [1, 0],
        [1, 1]
      ],
      12: [
        [1, 0],
        [0, -1],
        [1, 0]
      ],
      21: [
        [-1, 0],
        [0, 1],
        [-1, 0]
      ],
      23: [
        [0, 1],
        [1, 0],
        [1, -1]
      ],
      32: [
        [0, -1],
        [-1, 0],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, 1],
        [-1, 2]
      ],
      "03": [
        [1, 0],
        [0, -1],
        [1, -2]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i3_kicks: {
      "01": [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ],
      10: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ],
      12: [
        [1, 0],
        [-1, 0],
        [0, -2],
        [0, 2]
      ],
      21: [
        [-1, 0],
        [1, 0],
        [0, 2],
        [0, -2]
      ],
      23: [
        [-1, 0],
        [1, 0],
        [0, 1],
        [0, -1]
      ],
      32: [
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1]
      ],
      30: [
        [-1, 0],
        [1, 0],
        [0, 0],
        [0, 0]
      ],
      "03": [
        [1, 0],
        [-1, 0],
        [0, 0],
        [0, 0]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    l3_kicks: {
      "01": [
        [-1, 0],
        [1, 0]
      ],
      10: [
        [1, 0],
        [-1, 0]
      ],
      12: [
        [0, -1],
        [0, 1]
      ],
      21: [
        [0, 1],
        [0, -1]
      ],
      23: [
        [1, 0],
        [-1, 0]
      ],
      32: [
        [-1, 0],
        [1, 0]
      ],
      30: [
        [0, 1],
        [0, -1]
      ],
      "03": [
        [0, -1],
        [0, 1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i5_kicks: {
      "01": [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      10: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      12: [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      21: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      23: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      32: [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      30: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      "03": [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    oo_kicks: {
      "01": [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      10: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      12: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      21: [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      23: [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      32: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      "03": [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      "02": [[0, -1]],
      13: [[1, 0]],
      20: [[0, 1]],
      31: [[-1, 0]]
    },
    additional_offsets: {},
    spawn_rotation: {},
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {}
  },
  "SRS-X": {
    kicks: {
      "01": [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      10: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      12: [
        [1, 0],
        [1, 1],
        [0, -2],
        [1, -2]
      ],
      21: [
        [-1, 0],
        [-1, -1],
        [0, 2],
        [-1, 2]
      ],
      23: [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      32: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      30: [
        [-1, 0],
        [-1, 1],
        [0, -2],
        [-1, -2]
      ],
      "03": [
        [1, 0],
        [1, -1],
        [0, 2],
        [1, 2]
      ],
      "02": [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [-1, 0],
        [-2, 0],
        [-1, 1],
        [-2, 1],
        [0, -1],
        [3, 0],
        [-3, 0]
      ],
      13: [
        [0, 1],
        [0, 2],
        [-1, 1],
        [-1, 2],
        [0, -1],
        [0, -2],
        [-1, -1],
        [-1, -2],
        [1, 0],
        [0, 3],
        [0, -3]
      ],
      20: [
        [-1, 0],
        [-2, 0],
        [-1, -1],
        [-2, -1],
        [1, 0],
        [2, 0],
        [1, -1],
        [2, -1],
        [0, 1],
        [-3, 0],
        [3, 0]
      ],
      31: [
        [0, 1],
        [0, 2],
        [1, 1],
        [1, 2],
        [0, -1],
        [0, -2],
        [1, -1],
        [1, -2],
        [-1, 0],
        [0, 3],
        [0, -3]
      ]
    },
    i_kicks: {
      "01": [
        [-2, 0],
        [1, 0],
        [-2, 1],
        [1, -2]
      ],
      10: [
        [2, 0],
        [-1, 0],
        [2, -1],
        [-1, 2]
      ],
      12: [
        [-1, 0],
        [2, 0],
        [-1, -2],
        [2, 1]
      ],
      21: [
        [1, 0],
        [-2, 0],
        [1, 2],
        [-2, -1]
      ],
      23: [
        [2, 0],
        [-1, 0],
        [2, -1],
        [-1, 2]
      ],
      32: [
        [-2, 0],
        [1, 0],
        [-2, 1],
        [1, -2]
      ],
      30: [
        [1, 0],
        [-2, 0],
        [1, 2],
        [-2, -1]
      ],
      "03": [
        [-1, 0],
        [2, 0],
        [-1, -2],
        [2, 1]
      ],
      "02": [
        [-1, 0],
        [-2, 0],
        [1, 0],
        [2, 0],
        [0, 1]
      ],
      13: [
        [0, 1],
        [0, 2],
        [0, -1],
        [0, -2],
        [-1, 0]
      ],
      20: [
        [1, 0],
        [2, 0],
        [-1, 0],
        [-2, 0],
        [0, -1]
      ],
      31: [
        [0, 1],
        [0, 2],
        [0, -1],
        [0, -2],
        [1, 0]
      ]
    },
    i2_kicks: {
      "01": [
        [0, -1],
        [-1, 0],
        [-1, -1]
      ],
      10: [
        [0, 1],
        [1, 0],
        [1, 1]
      ],
      12: [
        [1, 0],
        [0, -1],
        [1, 0]
      ],
      21: [
        [-1, 0],
        [0, 1],
        [-1, 0]
      ],
      23: [
        [0, 1],
        [1, 0],
        [1, -1]
      ],
      32: [
        [0, -1],
        [-1, 0],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, 1],
        [-1, 2]
      ],
      "03": [
        [1, 0],
        [0, -1],
        [1, -2]
      ],
      "02": [
        [-1, 0],
        [-2, 0],
        [1, 0],
        [2, 0],
        [0, 1]
      ],
      13: [
        [0, 1],
        [0, 2],
        [0, -1],
        [0, -2],
        [-1, 0]
      ],
      20: [
        [1, 0],
        [2, 0],
        [-1, 0],
        [-2, 0],
        [0, -1]
      ],
      31: [
        [0, 1],
        [0, 2],
        [0, -1],
        [0, -2],
        [1, 0]
      ]
    },
    i3_kicks: {
      "01": [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ],
      10: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ],
      12: [
        [1, 0],
        [-1, 0],
        [0, -2],
        [0, 2]
      ],
      21: [
        [-1, 0],
        [1, 0],
        [0, 2],
        [0, -2]
      ],
      23: [
        [-1, 0],
        [1, 0],
        [0, 1],
        [0, -1]
      ],
      32: [
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1]
      ],
      30: [
        [-1, 0],
        [1, 0],
        [0, 0],
        [0, 0]
      ],
      "03": [
        [1, 0],
        [-1, 0],
        [0, 0],
        [0, 0]
      ],
      "02": [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [-1, 0],
        [-2, 0],
        [-1, 1],
        [-2, 1],
        [0, -1],
        [3, 0],
        [-3, 0]
      ],
      13: [
        [0, 1],
        [0, 2],
        [-1, 1],
        [-1, 2],
        [0, -1],
        [0, -2],
        [-1, -1],
        [-1, -2],
        [1, 0],
        [0, 3],
        [0, -3]
      ],
      20: [
        [-1, 0],
        [-2, 0],
        [-1, -1],
        [-2, -1],
        [1, 0],
        [2, 0],
        [1, -1],
        [2, -1],
        [0, 1],
        [-3, 0],
        [3, 0]
      ],
      31: [
        [0, 1],
        [0, 2],
        [1, 1],
        [1, 2],
        [0, -1],
        [0, -2],
        [1, -1],
        [1, -2],
        [-1, 0],
        [0, 3],
        [0, -3]
      ]
    },
    l3_kicks: {
      "01": [
        [-1, 0],
        [1, 0]
      ],
      10: [
        [1, 0],
        [-1, 0]
      ],
      12: [
        [0, -1],
        [0, 1]
      ],
      21: [
        [0, 1],
        [0, -1]
      ],
      23: [
        [1, 0],
        [-1, 0]
      ],
      32: [
        [-1, 0],
        [1, 0]
      ],
      30: [
        [0, 1],
        [0, -1]
      ],
      "03": [
        [0, -1],
        [0, 1]
      ],
      "02": [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [-1, 0],
        [-2, 0],
        [-1, 1],
        [-2, 1],
        [0, -1],
        [3, 0],
        [-3, 0]
      ],
      13: [
        [0, 1],
        [0, 2],
        [-1, 1],
        [-1, 2],
        [0, -1],
        [0, -2],
        [-1, -1],
        [-1, -2],
        [1, 0],
        [0, 3],
        [0, -3]
      ],
      20: [
        [-1, 0],
        [-2, 0],
        [-1, -1],
        [-2, -1],
        [1, 0],
        [2, 0],
        [1, -1],
        [2, -1],
        [0, 1],
        [-3, 0],
        [3, 0]
      ],
      31: [
        [0, 1],
        [0, 2],
        [1, 1],
        [1, 2],
        [0, -1],
        [0, -2],
        [1, -1],
        [1, -2],
        [-1, 0],
        [0, 3],
        [0, -3]
      ]
    },
    i5_kicks: {
      "01": [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      10: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      12: [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      21: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      23: [
        [2, 0],
        [-2, 0],
        [2, -1],
        [-2, 2]
      ],
      32: [
        [-2, 0],
        [2, 0],
        [-2, 1],
        [2, -2]
      ],
      30: [
        [2, 0],
        [-2, 0],
        [2, 2],
        [-2, -1]
      ],
      "03": [
        [-2, 0],
        [2, 0],
        [-2, -2],
        [2, 1]
      ],
      "02": [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
        [-1, 0],
        [-2, 0],
        [-1, 1],
        [-2, 1],
        [0, -1],
        [3, 0],
        [-3, 0]
      ],
      13: [
        [0, 1],
        [0, 2],
        [-1, 1],
        [-1, 2],
        [0, -1],
        [0, -2],
        [-1, -1],
        [-1, -2],
        [1, 0],
        [0, 3],
        [0, -3]
      ],
      20: [
        [-1, 0],
        [-2, 0],
        [-1, -1],
        [-2, -1],
        [1, 0],
        [2, 0],
        [1, -1],
        [2, -1],
        [0, 1],
        [-3, 0],
        [3, 0]
      ],
      31: [
        [0, 1],
        [0, 2],
        [1, 1],
        [1, 2],
        [0, -1],
        [0, -2],
        [1, -1],
        [1, -2],
        [-1, 0],
        [0, 3],
        [0, -3]
      ]
    },
    oo_kicks: {
      "01": [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      10: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      12: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      21: [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      23: [
        [0, -1],
        [-1, -1],
        [0, 1],
        [-1, 1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      32: [
        [1, 0],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      30: [
        [-1, 0],
        [0, -1],
        [-1, 1],
        [-1, -1],
        [1, 0],
        [1, -1],
        [1, 1]
      ],
      "03": [
        [0, -1],
        [1, -1],
        [0, 1],
        [1, 1],
        [-1, 0],
        [-1, -1],
        [-1, 1]
      ],
      "02": [[0, -1]],
      13: [[1, 0]],
      20: [[0, 1]],
      31: [[-1, 0]]
    },
    additional_offsets: {},
    spawn_rotation: {},
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {}
  },
  "TETRA-X": {
    kicks: {
      "01": [
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
        [0, -1],
        [-1, -1],
        [1, -1]
      ],
      10: [
        [0, 1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
        [0, -1],
        [1, -1],
        [-1, -1]
      ],
      12: [
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
        [0, -1],
        [-1, -1],
        [1, -1]
      ],
      21: [
        [0, 1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
        [0, -1],
        [1, -1],
        [-1, -1]
      ],
      23: [
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
        [0, -1],
        [-1, -1],
        [1, -1]
      ],
      32: [
        [0, 1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
        [0, -1],
        [1, -1],
        [-1, -1]
      ],
      30: [
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
        [0, -1],
        [-1, -1],
        [1, -1]
      ],
      "03": [
        [0, 1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [-1, 1],
        [0, -1],
        [1, -1],
        [-1, -1]
      ],
      "02": [
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0]
      ],
      13: [
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0]
      ],
      20: [
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0]
      ],
      31: [
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0]
      ]
    },
    i_kicks: {
      "01": [
        [0, -1],
        [0, -2],
        [0, 1],
        [1, -1],
        [-1, -1],
        [1, -2],
        [-1, -2]
      ],
      10: [
        [0, -1],
        [0, -2],
        [0, 1],
        [-1, 0],
        [1, 0],
        [2, 0]
      ],
      12: [
        [0, -1],
        [0, -2],
        [0, 1],
        [-1, 0],
        [1, 0],
        [2, 0]
      ],
      21: [
        [0, 1],
        [0, 2],
        [0, -1],
        [-1, 1],
        [1, 1],
        [-1, 2],
        [1, 2]
      ],
      23: [
        [0, 1],
        [0, 2],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, 2],
        [-1, 2]
      ],
      32: [
        [0, -1],
        [0, -2],
        [0, 1],
        [1, 0],
        [-1, 0],
        [-2, 0]
      ],
      30: [
        [0, -1],
        [0, -2],
        [0, 1],
        [1, 0],
        [-1, 0],
        [-2, 0]
      ],
      "03": [
        [0, -1],
        [0, -2],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, -2],
        [1, -2]
      ],
      "02": [
        [0, -1],
        [0, 1]
      ],
      13: [
        [0, -1],
        [0, 1]
      ],
      20: [
        [0, -1],
        [0, 1]
      ],
      31: [
        [0, -1],
        [0, 1]
      ]
    },
    additional_offsets: {},
    spawn_rotation: {},
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "o",
      o: "s",
      s: "i",
      i: "l",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {}
  },
  NRS: {
    kicks: {
      "01": [],
      10: [],
      12: [],
      21: [],
      23: [],
      32: [],
      30: [],
      "03": [],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    additional_offsets: {
      z: [
        [1, 1],
        [1, 0],
        [1, 0],
        [2, 0]
      ],
      l: [
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0]
      ],
      o: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      s: [
        [1, 1],
        [1, 0],
        [1, 0],
        [2, 0]
      ],
      i: [
        [0, 1],
        [0, 0],
        [0, 0],
        [1, 0]
      ],
      j: [
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0]
      ],
      t: [
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0]
      ]
    },
    spawn_rotation: { z: 0, l: 2, o: 0, s: 0, i: 0, j: 2, t: 2 },
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {
      l: [
        [0, 0, 201],
        [1, 0, 68],
        [2, 0, 124],
        [0, 1, 31]
      ],
      j: [
        [0, 0, 199],
        [1, 0, 68],
        [2, 0, 114],
        [2, 1, 31]
      ],
      t: [
        [0, 0, 199],
        [1, 0, 74],
        [2, 0, 124],
        [1, 1, 31]
      ]
    }
  },
  ARS: {
    kicks: {
      "01": [
        [1, 0],
        [-1, 0]
      ],
      10: [
        [1, 0],
        [-1, 0]
      ],
      12: [
        [1, 0],
        [-1, 0]
      ],
      21: [
        [1, 0],
        [-1, 0]
      ],
      23: [
        [1, 0],
        [-1, 0]
      ],
      32: [
        [1, 0],
        [-1, 0]
      ],
      30: [
        [1, 0],
        [-1, 0]
      ],
      "03": [
        [1, 0],
        [-1, 0]
      ],
      "02": [
        [1, 0],
        [-1, 0]
      ],
      13: [
        [1, 0],
        [-1, 0]
      ],
      20: [
        [1, 0],
        [-1, 0]
      ],
      31: [
        [1, 0],
        [-1, 0]
      ]
    },
    additional_offsets: {
      i1: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      z: [
        [0, 1],
        [0, 0],
        [0, 0],
        [1, 0]
      ],
      l: [
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      o: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      s: [
        [0, 1],
        [-1, 0],
        [0, 0],
        [0, 0]
      ],
      i: [
        [0, 0],
        [0, 0],
        [0, -1],
        [1, 0]
      ],
      j: [
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      t: [
        [0, 1],
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    },
    spawn_rotation: { z: 0, l: 2, o: 0, s: 0, i: 0, j: 2, t: 2 },
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "s",
      l: "l",
      o: "o",
      s: "t",
      i: "z",
      j: "j",
      t: "i",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    preview_overrides: {
      l: [
        [0, 0, 201],
        [1, 0, 68],
        [2, 0, 124],
        [0, 1, 31]
      ],
      j: [
        [0, 0, 199],
        [1, 0, 68],
        [2, 0, 114],
        [2, 1, 31]
      ],
      t: [
        [0, 0, 199],
        [1, 0, 74],
        [2, 0, 124],
        [1, 1, 31]
      ]
    },
    center_column: [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1]
    ]
  },
  ASC: {
    kicks: {
      "01": [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      10: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      12: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      21: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      23: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      32: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      30: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      "03": [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    i_kicks: {
      "01": [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      10: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      12: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      21: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      23: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      32: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      30: [
        [-1, 0],
        [0, 1],
        [-1, 1],
        [0, 2],
        [-1, 2],
        [-2, 0],
        [-2, 1],
        [-2, 2],
        [1, 0],
        [1, 1],
        [0, -1],
        [-1, -1],
        [-2, -1],
        [1, 2],
        [2, 0],
        [0, -2],
        [-1, -2],
        [-2, -2],
        [2, 1],
        [2, 2],
        [1, -1]
      ],
      "03": [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [1, -1],
        [2, -1],
        [-1, 2],
        [-2, 0],
        [0, -2],
        [1, -2],
        [2, -2],
        [-2, 1],
        [-2, 2],
        [-1, -1]
      ],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    allow_o_kick: true,
    additional_offsets: {
      i1: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      z: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      l: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      o: [
        [0, 0],
        [0, 1],
        [-1, 1],
        [-1, 0]
      ],
      s: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      i: [
        [0, 0],
        [0, -1],
        [1, -1],
        [1, 0]
      ],
      j: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      t: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    },
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    spawn_rotation: {},
    preview_overrides: {}
  },
  none: {
    kicks: {
      "01": [],
      10: [],
      12: [],
      21: [],
      23: [],
      32: [],
      30: [],
      "03": [],
      "02": [],
      13: [],
      20: [],
      31: []
    },
    additional_offsets: {},
    colorMap: {
      i1: "i",
      i2: "i",
      i3: "i",
      l3: "j",
      i5: "i",
      z: "z",
      l: "l",
      o: "o",
      s: "s",
      i: "i",
      j: "j",
      t: "t",
      oo: "o",
      g: "g",
      d: "d",
      gb: "gb",
      gbd: "gbd"
    },
    spawn_rotation: {},
    preview_overrides: {}
  }
};
var cornerTable = {
  z: [
    [
      [-2, -1],
      [1, -1],
      [2, 0],
      [-1, 0]
    ],
    [
      [0, -1],
      [1, -2],
      [0, 2],
      [1, 1]
    ],
    [
      [-2, 0],
      [1, 0],
      [2, 1],
      [-1, 1]
    ],
    [
      [-1, -1],
      [0, -2],
      [0, 1],
      [-1, 2]
    ]
  ],
  l: [
    [
      [-1, -1],
      [0, -1],
      [1, 1],
      [-1, 1]
    ],
    [
      [-1, -1],
      [1, -1],
      [1, 0],
      [-1, 1]
    ],
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [0, 1]
    ],
    [
      [-1, 0],
      [1, -1],
      [1, 1],
      [-1, 1]
    ]
  ],
  s: [
    [
      [-1, -1],
      [2, -1],
      [1, 0],
      [-2, 0]
    ],
    [
      [0, -2],
      [1, -1],
      [1, 2],
      [0, 1]
    ],
    [
      [-1, 0],
      [2, 0],
      [1, 1],
      [-2, 1]
    ],
    [
      [-1, -2],
      [0, -1],
      [-1, 1],
      [0, 2]
    ]
  ],
  j: [
    [
      [0, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ],
    [
      [-1, -1],
      [1, 0],
      [1, 1],
      [-1, 1]
    ],
    [
      [-1, -1],
      [1, -1],
      [0, 1],
      [-1, 1]
    ],
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 0]
    ]
  ],
  t: [
    [
      [-1, -1, 3, 0],
      [1, -1, 0, 1],
      [1, 1, 1, 2],
      [-1, 1, 2, 3]
    ],
    [
      [-1, -1, 3, 0],
      [1, -1, 0, 1],
      [1, 1, 1, 2],
      [-1, 1, 2, 3]
    ],
    [
      [-1, -1, 3, 0],
      [1, -1, 0, 1],
      [1, 1, 1, 2],
      [-1, 1, 2, 3]
    ],
    [
      [-1, -1, 3, 0],
      [1, -1, 0, 1],
      [1, 1, 1, 2],
      [-1, 1, 2, 3]
    ]
  ]
};
var spinbonusRules = {
  none: {},
  stupid: {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  all: {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  "all+": {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  "all-mini": {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  "all-mini+": {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  "mini-only": {
    types: [
      "i1",
      "i2",
      "i3",
      "l3",
      "i5",
      "z",
      "l",
      "o",
      "s",
      "i",
      "j",
      "t",
      "oo"
    ],
    types_mini: ["t"]
  },
  handheld: { types: ["t", "s", "z", "l", "j"], types_mini: ["t"] },
  "T-spins": { types: ["t"], types_mini: ["t"] },
  "T-spins+": { types: ["t"], types_mini: ["t"] }
};

// .cache/triangle/src/engine/utils/kicks/index.ts
var legal = (blocks, board) => {
  if (board.length === 0) return false;
  const boardWidth = board[0].length;
  const boardHeight = board.length;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const x = block[0];
    const y = block[1];
    if (x < 0) return false;
    if (x >= boardWidth) return false;
    if (y < 0) return false;
    if (y >= boardHeight) return false;
    if (board[y][x]) return false;
  }
  return true;
};
var performKick = (kicktable, piece, pieceLocation, ao, maxMovement, blocks, startRotation, endRotation, board) => {
  try {
    const floorPieceY = Math.floor(pieceLocation[1]);
    const baseX = pieceLocation[0] - ao[0];
    const baseY = floorPieceY - ao[1];
    const initialBlocks = new Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      initialBlocks[i] = [baseX + block[0], baseY - block[1]];
    }
    if (legal(initialBlocks, board)) return true;
    const kickID = `${startRotation}${endRotation}`;
    const table = kicks[kicktable];
    const customKicksetID = `${piece.toLowerCase()}_kicks`;
    const kickset = customKicksetID in table ? table[customKicksetID][kickID] : table.kicks[kickID];
    const testBlocks = new Array(blocks.length);
    for (let i = 0; i < kickset.length; i++) {
      const [dx, dy] = kickset[i];
      const newY = maxMovement ? pieceLocation[1] - dy - ao[1] : Math.ceil(pieceLocation[1]) - 0.1 - dy - ao[1];
      const floorNewY = Math.floor(newY);
      const movedBaseX = baseX + dx;
      for (let j = 0; j < blocks.length; j++) {
        const block = blocks[j];
        testBlocks[j] = [movedBaseX + block[0], floorNewY - block[1]];
      }
      if (legal(testBlocks, board)) {
        return {
          newLocation: [pieceLocation[0] + dx - ao[0], newY],
          kick: [dx, -dy],
          id: kickID,
          index: i
        };
      }
    }
    return false;
  } catch {
    return false;
  }
};

// .cache/triangle/src/engine/utils/tetromino/data.ts
var tetrominoes = {
  i1: {
    matrix: {
      w: 1,
      h: 1,
      dx: 0,
      dy: 1,
      data: [[[0, 0, 255]], [[0, 0, 255]], [[0, 0, 255]], [[0, 0, 255]]]
    },
    preview: { w: 1, h: 1, data: [[0, 0, 255]] }
  },
  i2: {
    matrix: {
      w: 2,
      h: 2,
      dx: 0,
      dy: 1,
      data: [
        [
          [0, 0, 199],
          [1, 0, 124]
        ],
        [
          [1, 0, 241],
          [1, 1, 31]
        ],
        [
          [1, 1, 124],
          [0, 1, 199]
        ],
        [
          [0, 1, 31],
          [0, 0, 241]
        ]
      ]
    },
    preview: {
      w: 2,
      h: 1,
      data: [
        [0, 0, 199],
        [1, 0, 124]
      ]
    }
  },
  i3: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [0, 1, 199],
          [1, 1, 68],
          [2, 1, 124]
        ],
        [
          [1, 0, 241],
          [1, 1, 17],
          [1, 2, 31]
        ],
        [
          [2, 1, 124],
          [1, 1, 68],
          [0, 1, 199]
        ],
        [
          [1, 2, 31],
          [1, 1, 17],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 1,
      data: [
        [0, 0, 199],
        [1, 0, 68],
        [2, 0, 124]
      ]
    }
  },
  l3: {
    matrix: {
      w: 2,
      h: 2,
      dx: 0,
      dy: 1,
      data: [
        [
          [0, 0, 241],
          [0, 1, 39],
          [1, 1, 124]
        ],
        [
          [1, 0, 124],
          [0, 0, 201],
          [0, 1, 31]
        ],
        [
          [1, 1, 31],
          [1, 0, 114],
          [0, 0, 199]
        ],
        [
          [0, 1, 199],
          [1, 1, 156],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 2,
      h: 2,
      data: [
        [0, 0, 241],
        [0, 1, 39],
        [1, 1, 124]
      ]
    }
  },
  i5: {
    matrix: {
      w: 5,
      h: 5,
      dx: 2,
      dy: 2,
      data: [
        [
          [0, 2, 199],
          [1, 2, 68],
          [2, 2, 68],
          [3, 2, 68],
          [4, 2, 124]
        ],
        [
          [2, 0, 241],
          [2, 1, 17],
          [2, 2, 17],
          [2, 3, 17],
          [2, 4, 31]
        ],
        [
          [4, 2, 124],
          [3, 2, 68],
          [2, 2, 68],
          [1, 2, 68],
          [0, 2, 199]
        ],
        [
          [2, 4, 31],
          [2, 3, 17],
          [2, 2, 17],
          [2, 1, 17],
          [2, 0, 241]
        ]
      ]
    },
    preview: {
      w: 5,
      h: 1,
      data: [
        [0, 0, 199],
        [1, 0, 68],
        [2, 0, 68],
        [3, 0, 68],
        [4, 0, 124]
      ]
    }
  },
  z: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [0, 0, 199],
          [1, 0, 114],
          [1, 1, 39],
          [2, 1, 124]
        ],
        [
          [2, 0, 241],
          [2, 1, 156],
          [1, 1, 201],
          [1, 2, 31]
        ],
        [
          [2, 2, 124],
          [1, 2, 39],
          [1, 1, 114],
          [0, 1, 199]
        ],
        [
          [0, 2, 31],
          [0, 1, 201],
          [1, 1, 156],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 2,
      data: [
        [0, 0, 199],
        [1, 0, 114],
        [1, 1, 39],
        [2, 1, 124]
      ]
    }
  },
  l: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [2, 0, 241],
          [0, 1, 199],
          [1, 1, 68],
          [2, 1, 156]
        ],
        [
          [2, 2, 124],
          [1, 0, 241],
          [1, 1, 17],
          [1, 2, 39]
        ],
        [
          [0, 2, 31],
          [2, 1, 124],
          [1, 1, 68],
          [0, 1, 201]
        ],
        [
          [0, 0, 199],
          [1, 2, 31],
          [1, 1, 17],
          [1, 0, 114]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 2,
      data: [
        [2, 0, 241],
        [0, 1, 199],
        [1, 1, 68],
        [2, 1, 156]
      ]
    }
  },
  o: {
    matrix: {
      w: 2,
      h: 2,
      dx: 0,
      dy: 1,
      data: [
        [
          [0, 0, 193],
          [1, 0, 112],
          [0, 1, 7],
          [1, 1, 28]
        ],
        [
          [1, 0, 112],
          [1, 1, 28],
          [0, 0, 193],
          [0, 1, 7]
        ],
        [
          [1, 1, 28],
          [0, 1, 7],
          [1, 0, 112],
          [0, 0, 193]
        ],
        [
          [0, 1, 7],
          [0, 0, 193],
          [1, 1, 28],
          [1, 0, 112]
        ]
      ]
    },
    preview: {
      w: 2,
      h: 2,
      data: [
        [0, 0, 193],
        [1, 0, 112],
        [0, 1, 7],
        [1, 1, 28]
      ]
    }
  },
  s: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [1, 0, 201],
          [2, 0, 124],
          [0, 1, 199],
          [1, 1, 156]
        ],
        [
          [2, 1, 114],
          [2, 2, 31],
          [1, 0, 241],
          [1, 1, 39]
        ],
        [
          [1, 2, 156],
          [0, 2, 199],
          [2, 1, 124],
          [1, 1, 201]
        ],
        [
          [0, 1, 39],
          [0, 0, 241],
          [1, 2, 31],
          [1, 1, 114]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 2,
      data: [
        [1, 0, 201],
        [2, 0, 124],
        [0, 1, 199],
        [1, 1, 156]
      ]
    }
  },
  i: {
    matrix: {
      w: 4,
      h: 4,
      dx: 1,
      dy: 1,
      data: [
        [
          [0, 1, 199],
          [1, 1, 68],
          [2, 1, 68],
          [3, 1, 124]
        ],
        [
          [2, 0, 241],
          [2, 1, 17],
          [2, 2, 17],
          [2, 3, 31]
        ],
        [
          [3, 2, 124],
          [2, 2, 68],
          [1, 2, 68],
          [0, 2, 199]
        ],
        [
          [1, 3, 31],
          [1, 2, 17],
          [1, 1, 17],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 4,
      h: 1,
      data: [
        [0, 0, 199],
        [1, 0, 68],
        [2, 0, 68],
        [3, 0, 124]
      ]
    }
  },
  j: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [0, 0, 241],
          [0, 1, 39],
          [1, 1, 68],
          [2, 1, 124]
        ],
        [
          [2, 0, 124],
          [1, 0, 201],
          [1, 1, 17],
          [1, 2, 31]
        ],
        [
          [2, 2, 31],
          [2, 1, 114],
          [1, 1, 68],
          [0, 1, 199]
        ],
        [
          [0, 2, 199],
          [1, 2, 156],
          [1, 1, 17],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 2,
      data: [
        [0, 0, 241],
        [0, 1, 39],
        [1, 1, 68],
        [2, 1, 124]
      ]
    }
  },
  t: {
    matrix: {
      w: 3,
      h: 3,
      dx: 1,
      dy: 1,
      data: [
        [
          [1, 0, 241],
          [0, 1, 199],
          [1, 1, 164],
          [2, 1, 124]
        ],
        [
          [2, 1, 124],
          [1, 0, 241],
          [1, 1, 41],
          [1, 2, 31]
        ],
        [
          [1, 2, 31],
          [2, 1, 124],
          [1, 1, 74],
          [0, 1, 199]
        ],
        [
          [0, 1, 199],
          [1, 2, 31],
          [1, 1, 146],
          [1, 0, 241]
        ]
      ]
    },
    preview: {
      w: 3,
      h: 2,
      data: [
        [1, 0, 241],
        [0, 1, 199],
        [1, 1, 164],
        [2, 1, 124]
      ]
    }
  },
  oo: {
    matrix: {
      w: 4,
      h: 4,
      dx: 1,
      dy: 1,
      data: [
        [
          [0, 1, 193],
          [1, 1, 64],
          [2, 1, 64],
          [3, 1, 112],
          [0, 2, 7],
          [1, 2, 4],
          [2, 2, 4],
          [3, 2, 28]
        ],
        [
          [2, 0, 112],
          [2, 1, 16],
          [2, 2, 16],
          [2, 3, 28],
          [1, 0, 193],
          [1, 1, 1],
          [1, 2, 1],
          [1, 3, 7]
        ],
        [
          [3, 2, 28],
          [2, 2, 68],
          [1, 2, 68],
          [0, 2, 7],
          [3, 1, 112],
          [2, 1, 64],
          [1, 1, 64],
          [0, 1, 193]
        ],
        [
          [1, 3, 7],
          [1, 2, 1],
          [1, 1, 1],
          [1, 0, 193],
          [2, 3, 28],
          [2, 2, 16],
          [2, 1, 16],
          [2, 0, 112]
        ]
      ]
    },
    preview: {
      w: 4,
      h: 2,
      data: [
        [0, 0, 193],
        [1, 0, 64],
        [2, 0, 64],
        [3, 0, 112],
        [0, 1, 7],
        [1, 1, 4],
        [2, 1, 4],
        [3, 1, 28]
      ]
    },
    xweight: 1
  }
};

// .cache/triangle/src/engine/utils/tetromino/index.ts
var Tetromino = class {
  #rotation;
  symbol;
  states;
  location;
  locking;
  lockResets;
  rotResets;
  safeLock;
  highestY;
  fallingRotations;
  totalRotations;
  irs;
  ihs;
  aox;
  aoy;
  keys;
  #legalAt(board, x, y) {
    const blocks = this.blocks;
    const abs = new Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      abs[i] = [block[0] + x, -block[1] + y];
    }
    return legal(abs, board);
  }
  constructor(options) {
    this.rotation = options.initialRotation;
    this.symbol = options.symbol;
    const tetromino = tetrominoes[this.symbol.toLowerCase()];
    this.states = tetromino.matrix.data;
    this.location = [
      Math.floor(options.boardWidth / 2 - tetromino.matrix.w / 2),
      options.boardHeight + 2.04
    ];
    this.locking = 0;
    this.lockResets = 0;
    this.rotResets = 0;
    this.safeLock = options.from?.safeLock ?? 0;
    this.highestY = options.boardHeight + 2;
    this.fallingRotations = 0;
    this.totalRotations = 0;
    this.irs = options.from?.irs ?? 0;
    this.ihs = options.from?.ihs ?? false;
    this.aox = 0;
    this.aoy = 0;
    this.keys = 0;
  }
  get blocks() {
    return this.states[Math.min(this.rotation, this.states.length)];
  }
  get absoluteBlocks() {
    const blocks = this.blocks;
    const abs = new Array(blocks.length);
    const x = this.location[0];
    const y = this.y;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      abs[i] = [block[0] + x, -block[1] + y];
    }
    return abs;
  }
  absoluteAt({
    x = this.location[0],
    y = this.location[1],
    rotation = this.rotation
  }) {
    const normalizedRotation = (rotation % 4 + 4) % 4;
    const state = this.states[normalizedRotation];
    const abs = new Array(state.length);
    const yFloor = Math.floor(y);
    for (let i = 0; i < state.length; i++) {
      const block = state[i];
      abs[i] = [block[0] + x, -block[1] + yFloor];
    }
    return abs;
  }
  get rotation() {
    return this.#rotation % 4;
  }
  set rotation(value) {
    this.#rotation = value % 4;
  }
  get x() {
    return this.location[0];
  }
  set x(value) {
    this.location[0] = value;
  }
  get y() {
    return Math.floor(this.location[1]);
  }
  set y(value) {
    this.location[1] = value;
  }
  isStupidSpinPosition(board) {
    return !this.#legalAt(board, this.location[0], this.y - 1);
  }
  isAllSpinPosition(board) {
    return !this.#legalAt(board, this.location[0] - 1, this.y) && !this.#legalAt(board, this.location[0] + 1, this.y) && !this.#legalAt(board, this.location[0], this.y + 1) && !this.#legalAt(board, this.location[0], this.y - 1);
  }
  rotate(board, kickTable, amt, maxMovement) {
    const rotatedBlocks = this.states[(this.rotation + amt) % 4];
    const kickRes = performKick(
      kickTable,
      this.symbol,
      this.location,
      [this.aox, this.aoy],
      maxMovement,
      rotatedBlocks,
      this.rotation,
      (this.rotation + amt) % 4,
      board
    );
    if (typeof kickRes === "object") {
      this.location = [...kickRes.newLocation];
    }
    if (kickRes) {
      this.rotation = this.rotation + amt;
      return kickRes;
    }
    return false;
  }
  moveRight(board) {
    if (this.#legalAt(board, this.location[0] + 1, this.y)) {
      this.location[0]++;
      return true;
    }
    return false;
  }
  moveLeft(board) {
    if (this.#legalAt(board, this.location[0] - 1, this.y)) {
      this.location[0]--;
      return true;
    }
    return false;
  }
  dasRight(board) {
    if (this.moveRight(board)) {
      while (this.moveRight(board)) {
      }
      return true;
    }
    return false;
  }
  dasLeft(board) {
    if (this.moveLeft(board)) {
      while (this.moveLeft(board)) {
      }
      return true;
    }
    return false;
  }
  softDrop(board) {
    const start = this.location[1];
    while (this.#legalAt(board, this.location[0], this.y - 1)) {
      this.location[1]--;
    }
    return start !== this.location[1];
  }
  snapshot() {
    return {
      aox: this.aox,
      aoy: this.aoy,
      fallingRotations: this.fallingRotations,
      highestY: this.highestY,
      ihs: this.ihs,
      irs: this.irs,
      keys: this.keys,
      rotation: this.rotation,
      location: deepCopy(this.location),
      locking: this.locking,
      lockResets: this.lockResets,
      rotResets: this.rotResets,
      safeLock: this.safeLock,
      symbol: this.symbol,
      totalRotations: this.totalRotations
    };
  }
};

// .cache/triangle/src/engine/utils/seed.ts
var randomSeed = () => Math.floor(Math.random() * 2147483646);

// .cache/triangle/src/engine/utils/polyfills/index.ts
var polyfills;
((polyfills2) => {
  class Map2 {
    #entries = [];
    constructor(iterable) {
      if (iterable) {
        for (const [key, value] of iterable) {
          this.set(key, value);
        }
      }
    }
    get size() {
      return this.#entries.length;
    }
    set = (key, value) => {
      const index = this.#entries.findIndex(([k]) => k === key);
      if (index !== -1) {
        this.#entries[index][1] = value;
      } else {
        this.#entries.push([key, value]);
      }
      return this;
    };
    get = (key) => {
      const entry = this.#entries.find(([k]) => k === key);
      return entry ? entry[1] : void 0;
    };
    has = (key) => {
      return this.#entries.some(([k]) => k === key);
    };
    delete = (key) => {
      const index = this.#entries.findIndex(([k]) => k === key);
      if (index !== -1) {
        this.#entries.splice(index, 1);
        return true;
      }
      return false;
    };
    clear = () => {
      this.#entries = [];
    };
    forEach = (callback, thisArg) => {
      const entriesCopy = this.#entries.slice();
      for (const [key, value] of entriesCopy) {
        callback.call(thisArg, value, key, this);
      }
    };
    *entries() {
      for (const entry of this.#entries) {
        yield entry;
      }
    }
    *keys() {
      for (const [key] of this.#entries) {
        yield key;
      }
    }
    *values() {
      for (const [, value] of this.#entries) {
        yield value;
      }
    }
    [Symbol.iterator] = function* () {
      yield* this.entries();
    };
  }
  polyfills2.Map = Map2;
})(polyfills || (polyfills = {}));

// .cache/triangle/src/engine/utils/rng/index.ts
var RNG = class _RNG {
  static #MODULUS = 2147483647;
  static #MULTIPLIER = 16807;
  static #MAX_FLOAT = 2147483646;
  #value;
  index = 0;
  constructor(seed) {
    this.#value = seed % _RNG.#MODULUS;
    if (this.#value <= 0) {
      this.#value += _RNG.#MAX_FLOAT;
    }
    this.next = this.next.bind(this);
    this.nextFloat = this.nextFloat.bind(this);
    this.shuffleArray = this.shuffleArray.bind(this);
    this.updateFromIndex = this.updateFromIndex.bind(this);
    this.clone = this.clone.bind(this);
  }
  next() {
    this.index++;
    return this.#value = _RNG.#MULTIPLIER * this.#value % _RNG.#MODULUS;
  }
  nextFloat() {
    return (this.next() - 1) / _RNG.#MAX_FLOAT;
  }
  shuffleArray(array) {
    if (array.length === 0) {
      return array;
    }
    for (let i = array.length - 1; i !== 0; i--) {
      const r = Math.floor(this.nextFloat() * (i + 1));
      [array[i], array[r]] = [array[r], array[i]];
    }
    return array;
  }
  get seed() {
    return this.#value;
  }
  set seed(value) {
    this.#value = value % _RNG.#MODULUS;
    if (this.#value <= 0) {
      this.#value += _RNG.#MAX_FLOAT;
    }
  }
  updateFromIndex(index) {
    while (this.index < index) {
      this.next();
    }
  }
  clone() {
    return new _RNG(this.#value);
  }
};

// .cache/triangle/src/engine/utils/index.ts
function deepCopy(obj, handlers) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (handlers) {
    for (let i = 0, n = handlers.length; i < n; i++) {
      const h = handlers[i];
      if (obj instanceof h.type) {
        return h.copy(obj);
      }
    }
  }
  if (Array.isArray(obj)) {
    const arr = obj;
    const len = arr.length;
    const out2 = new Array(len);
    for (let i = 0; i < len; i++) {
      out2[i] = deepCopy(arr[i], handlers);
    }
    return out2;
  }
  const src = obj;
  const out = {};
  for (const k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      out[k] = deepCopy(src[k], handlers);
    }
  }
  return out;
}

// .cache/triangle/src/engine/queue/rng/core.ts
var Bag = class {
  rng;
  id = 0;
  extra = [];
  lastGenerated = null;
  constructor(seed) {
    this.rng = new RNG(seed);
  }
  snapshot() {
    return {
      rng: this.rng.seed,
      id: this.id,
      extra: this.extra.slice(),
      lastGenerated: this.lastGenerated
    };
  }
  // note: not static because of inheritance
  fromSnapshot(snapshot) {
    this.rng = new RNG(snapshot.rng);
    this.id = snapshot.id;
    this.extra = snapshot.extra.slice();
    this.lastGenerated = snapshot.lastGenerated;
  }
};

// .cache/triangle/src/engine/queue/rng/bag7.ts
var Bag7 = class extends Bag {
  next() {
    return this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */
    ]);
  }
};

// .cache/triangle/src/engine/queue/rng/bag7-1.ts
var Bag7Plus1 = class extends Bag {
  next() {
    return this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */,
      ["z" /* Z */, "l" /* L */, "o" /* O */, "s" /* S */, "i" /* I */, "j" /* J */, "t" /* T */][Math.floor(this.rng.nextFloat() * 7)]
    ]);
  }
};

// .cache/triangle/src/engine/queue/rng/bag7-2.ts
var Bag7Plus2 = class extends Bag {
  next() {
    return this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */,
      ["z" /* Z */, "l" /* L */, "o" /* O */, "s" /* S */, "i" /* I */, "j" /* J */, "t" /* T */][Math.floor(this.rng.nextFloat() * 7)],
      ["z" /* Z */, "l" /* L */, "o" /* O */, "s" /* S */, "i" /* I */, "j" /* J */, "t" /* T */][Math.floor(this.rng.nextFloat() * 7)]
    ]);
  }
};

// .cache/triangle/src/engine/queue/rng/bag7-x.ts
var Bag7PlusX = class _Bag7PlusX extends Bag {
  static #extraPieceCount = [3, 2, 1, 1];
  next() {
    const extra = _Bag7PlusX.#extraPieceCount[this.id++] ?? 0;
    if (this.extra.length < extra)
      this.extra = this.rng.shuffleArray([
        "z" /* Z */,
        "l" /* L */,
        "o" /* O */,
        "s" /* S */,
        "i" /* I */,
        "j" /* J */,
        "t" /* T */
      ]);
    return this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */,
      ...this.extra.splice(0, extra)
    ]);
  }
};

// .cache/triangle/src/engine/queue/rng/bag14.ts
var Bag14 = class extends Bag {
  next() {
    return this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */,
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */
    ]);
  }
};

// .cache/triangle/src/engine/queue/rng/classic.ts
var Classic = class _Classic extends Bag {
  static #TETROMINOS = [
    "z" /* Z */,
    "l" /* L */,
    "o" /* O */,
    "s" /* S */,
    "i" /* I */,
    "j" /* J */,
    "t" /* T */
  ];
  next() {
    let index = Math.floor(
      this.rng.nextFloat() * (_Classic.#TETROMINOS.length + 1)
    );
    if (index === this.lastGenerated || index >= _Classic.#TETROMINOS.length) {
      index = Math.floor(this.rng.nextFloat() * _Classic.#TETROMINOS.length);
    }
    this.lastGenerated = index;
    return [_Classic.#TETROMINOS[index]];
  }
};

// .cache/triangle/src/engine/queue/rng/pairs.ts
var Pairs = class extends Bag {
  next() {
    const s = this.rng.shuffleArray([
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */
    ]);
    const pairs = this.rng.shuffleArray([s[0], s[0], s[0], s[1], s[1], s[1]]);
    return pairs;
  }
};

// .cache/triangle/src/engine/queue/rng/random.ts
var Random = class extends Bag {
  next() {
    const TETROMINOS = [
      "z" /* Z */,
      "l" /* L */,
      "o" /* O */,
      "s" /* S */,
      "i" /* I */,
      "j" /* J */,
      "t" /* T */
    ];
    return [TETROMINOS[Math.floor(this.rng.nextFloat() * TETROMINOS.length)]];
  }
};

// .cache/triangle/src/engine/queue/rng/index.ts
var rngMap = {
  "7-bag": Bag7,
  "14-bag": Bag14,
  classic: Classic,
  pairs: Pairs,
  "total mayhem": Random,
  "7+1-bag": Bag7Plus1,
  "7+2-bag": Bag7Plus2,
  "7+x-bag": Bag7PlusX
};

// .cache/triangle/src/engine/queue/index.ts
var Queue = class extends Array {
  seed;
  type;
  bag;
  #minLength;
  repopulateListener = null;
  static get [Symbol.species]() {
    return Array;
  }
  constructor(options) {
    super();
    this.seed = options.seed;
    this.type = options.type;
    this.reset();
    this.minLength = options.minLength;
  }
  reset() {
    this.bag = new rngMap[this.type](this.seed);
    this.#repopulate();
  }
  /** @internal */
  clear() {
    this.length = 0;
  }
  onRepopulate(listener) {
    this.repopulateListener = listener;
  }
  get minLength() {
    return this.#minLength;
  }
  set minLength(val) {
    this.#minLength = val;
    this.#repopulate();
  }
  get next() {
    return this[0];
  }
  shift() {
    this.#repopulate();
    const val = super.shift();
    return val;
  }
  /** @internal */
  repopulateOnce() {
    const newValues = this.bag.next();
    this.push(...newValues);
    return [...newValues];
  }
  #repopulate() {
    const added = [];
    while (this.length < this.minLength) {
      added.push(...this.repopulateOnce());
    }
    if (this.repopulateListener && added.length) {
      this.repopulateListener(added);
    }
  }
  snapshot() {
    return {
      value: Array.from(this),
      bag: this.bag.snapshot()
    };
  }
  fromSnapshot(snapshot) {
    this.bag.fromSnapshot(snapshot.bag);
    this.splice(0, this.length, ...snapshot.value);
  }
  raw() {
    return Array.from(this);
  }
};

// .cache/triangle/src/engine/board/index.ts
var BoardConnections = /* @__PURE__ */ ((BoardConnections2) => {
  BoardConnections2[BoardConnections2["TOP"] = 8] = "TOP";
  BoardConnections2[BoardConnections2["RIGHT"] = 4] = "RIGHT";
  BoardConnections2[BoardConnections2["BOTTOM"] = 2] = "BOTTOM";
  BoardConnections2[BoardConnections2["LEFT"] = 1] = "LEFT";
  BoardConnections2[BoardConnections2["CORNER"] = 16] = "CORNER";
  BoardConnections2[BoardConnections2["ALL"] = 15] = "ALL";
  return BoardConnections2;
})(BoardConnections || {});
var Board = class {
  state;
  #height;
  #width;
  #buffer;
  constructor(options) {
    this.#width = options.width;
    this.#height = options.height;
    this.#buffer = options.buffer;
    const fullHeight = this.fullHeight;
    const width = this.width;
    this.state = new Array(fullHeight);
    for (let y = 0; y < fullHeight; y++) {
      this.state[y] = new Array(width).fill(null);
    }
  }
  get height() {
    return this.#height;
  }
  set height(value) {
    this.#height = value;
  }
  get width() {
    return this.#width;
  }
  set width(value) {
    this.#width = value;
  }
  get buffer() {
    return this.#buffer;
  }
  set buffer(value) {
    this.#buffer = value;
  }
  get fullHeight() {
    return this.height + this.buffer;
  }
  occupied(x, y) {
    return x < 0 || y < 0 || x >= this.width || y >= this.fullHeight || this.state[y][x] !== null;
  }
  add(...blocks) {
    for (let i = 0; i < blocks.length; i++) {
      const [item, x, y] = blocks[i];
      if (y < 0 || y >= this.fullHeight || x < 0 || x >= this.width) continue;
      this.state[y][x] = item;
    }
  }
  clearLines() {
    let garbageCleared = 0;
    const lines = [];
    const fullHeight = this.fullHeight;
    const width = this.width;
    for (let idx = 0; idx < fullHeight; idx++) {
      const row = this.state[idx];
      let isFullLine = true;
      let hasGarbage = false;
      for (let x = 0; x < width; x++) {
        const block = row[x];
        if (block === null || block.mino === "bomb" /* BOMB */) {
          isFullLine = false;
          break;
        }
        if (block.mino === "gb" /* GARBAGE */) hasGarbage = true;
      }
      if (isFullLine) {
        lines.push(idx);
        if (idx > 0) {
          const rowAbove = this.state[idx - 1];
          for (let x = 0; x < width; x++) {
            const block = rowAbove[x];
            if (block) {
              block.connections |= 8;
              if (block.connections & 2) block.connections &= 15;
            }
          }
        }
        if (idx < fullHeight - 1) {
          const rowBelow = this.state[idx + 1];
          for (let x = 0; x < width; x++) {
            const block = rowBelow[x];
            if (block) {
              block.connections |= 2;
              if (block.connections & 8) block.connections &= 15;
            }
          }
        }
        if (hasGarbage) garbageCleared++;
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      this.state.splice(line, 1);
      this.state.push(new Array(this.width).fill(null));
    }
    return { lines: lines.length, garbageCleared };
  }
  clearBombs(placedBlocks) {
    let lowestY = this.fullHeight;
    for (let i = 0; i < placedBlocks.length; i++) {
      const y = placedBlocks[i][1];
      if (y < lowestY) lowestY = y;
    }
    if (lowestY === 0) return { lines: 0, garbageCleared: 0 };
    const bombColumns = [];
    for (let i = 0; i < placedBlocks.length; i++) {
      const [x, y] = placedBlocks[i];
      if (y === lowestY && this.state[y - 1][x]?.mino === "bomb" /* BOMB */) {
        bombColumns.push(x);
      }
    }
    if (bombColumns.length === 0) return { lines: 0, garbageCleared: 0 };
    const lines = [];
    while (lowestY > 0) {
      let hasBomb = false;
      for (let i = 0; i < bombColumns.length; i++) {
        const col = bombColumns[i];
        if (this.state[lowestY - 1][col]?.mino === "bomb" /* BOMB */) {
          hasBomb = true;
          break;
        }
      }
      if (!hasBomb) break;
      lines.push(--lowestY);
    }
    if (lines.length === 0) return { lines: 0, garbageCleared: 0 };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.state.splice(line, 1);
      this.state.push(new Array(this.width).fill(null));
    }
    return { lines: lines.length, garbageCleared: lines.length };
  }
  clearBombsAndLines(placedBlocks) {
    const bombs = this.clearBombs(placedBlocks);
    const lines = this.clearLines();
    return {
      lines: lines.lines + bombs.lines,
      garbageCleared: bombs.garbageCleared + lines.garbageCleared
    };
  }
  get perfectClear() {
    return this.state.every((row) => row.every((block) => block === null));
  }
  insertGarbage({
    amount,
    size,
    column,
    bombs,
    isBeginning,
    isEnd
  }) {
    const width = this.width;
    const rows = new Array(amount);
    for (let y = 0; y < amount; y++) {
      const row = new Array(width);
      for (let x = 0; x < width; x++) {
        if (x >= column && x < column + size) {
          row[x] = bombs ? { mino: "bomb" /* BOMB */, connections: 0 } : null;
        } else {
          let connection = 0;
          if (isEnd && y === 0) connection |= 2;
          if (isBeginning && y === amount - 1) connection |= 8;
          if (x === 0) connection |= 1;
          if (x === width - 1) connection |= 4;
          if (x === column - 1) connection |= 4;
          if (x === column + size) connection |= 1;
          row[x] = { mino: "gb" /* GARBAGE */, connections: connection };
        }
      }
      rows[y] = row;
    }
    this.state.splice(0, 0, ...rows);
    this.state.splice(this.fullHeight - amount - 1, amount);
  }
  reset() {
    const fullHeight = this.fullHeight;
    const width = this.width;
    this.state = new Array(fullHeight);
    for (let y = 0; y < fullHeight; y++) {
      this.state[y] = new Array(width).fill(null);
    }
  }
};

// .cache/triangle/src/engine/constants/index.ts
var constants;
((constants2) => {
  let flags;
  ((flags2) => {
    flags2.ROTATION_LEFT = 1;
    flags2.ROTATION_RIGHT = 2;
    flags2.ROTATION_180 = 4;
    flags2.ROTATION_SPIN = 8;
    flags2.ROTATION_MINI = 16;
    flags2.ROTATION_SPIN_ALL = 32;
    flags2.ROTATION_ALL = flags2.ROTATION_LEFT | flags2.ROTATION_RIGHT | flags2.ROTATION_180 | flags2.ROTATION_SPIN | flags2.ROTATION_MINI | flags2.ROTATION_SPIN_ALL;
    flags2.STATE_WALL = 64;
    flags2.STATE_SLEEP = 128;
    flags2.STATE_FLOOR = 256;
    flags2.STATE_NODRAW = 512;
    flags2.STATE_ALL = flags2.STATE_WALL | flags2.STATE_SLEEP | flags2.STATE_FLOOR | flags2.STATE_NODRAW;
    flags2.ACTION_IHS = 1024;
    flags2.ACTION_FORCELOCK = 2048;
    flags2.ACTION_SOFTDROP = 4096;
    flags2.ACTION_MOVE = 8192;
    flags2.ACTION_ROTATE = 16384;
    flags2.FLAGS_COUNT = 15;
  })(flags = constants2.flags || (constants2.flags = {}));
})(constants || (constants = {}));

// .cache/triangle/src/engine/garbage/legacy.ts
var columnWidth = (width, garbageHoleSize) => {
  return Math.max(0, width - (garbageHoleSize - 1));
};
var LegacyGarbageQueue = class {
  options;
  queue;
  lastTankTime = 0;
  lastColumn = null;
  rng;
  // for opener phase calculations
  sent = 0;
  constructor(options) {
    this.options = deepCopy(options);
    if (!this.options.cap.absolute)
      this.options.cap.absolute = Number.MAX_SAFE_INTEGER;
    this.queue = [];
    this.rng = new RNG(this.options.seed);
  }
  snapshot() {
    return {
      seed: this.rng.seed,
      lastTankTime: this.lastTankTime,
      lastColumn: this.lastColumn,
      sent: this.sent,
      queue: deepCopy(this.queue),
      hasChangedColumn: false,
      lastReceivedCount: 0
    };
  }
  fromSnapshot(snapshot) {
    this.queue = deepCopy(snapshot.queue);
    this.lastTankTime = snapshot.lastTankTime;
    this.lastColumn = snapshot.lastColumn;
    this.rng = new RNG(snapshot.seed);
    this.sent = snapshot.sent;
  }
  rngex() {
    return this.rng.nextFloat();
  }
  get size() {
    let total = 0;
    for (let i = 0; i < this.queue.length; i++) total += this.queue[i].amount;
    return total;
  }
  receive(...args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.amount > 0) this.queue.push(arg);
    }
    const cap = this.options.cap.absolute;
    let total = 0;
    for (let i = 0; i < this.queue.length; i++) total += this.queue[i].amount;
    while (total > cap) {
      const excess = total - cap;
      const lastIndex = this.queue.length - 1;
      const last = this.queue[lastIndex];
      if (last.amount <= excess) {
        total -= last.amount;
        this.queue.pop();
      } else {
        last.amount -= excess;
        total -= excess;
      }
    }
  }
  confirm(cid, gameid, frame) {
    const obj = this.queue.find((g) => g.cid === cid && g.gameid === gameid);
    if (!obj) return false;
    obj.frame = frame;
    obj.confirmed = true;
    return true;
  }
  cancel(amount, pieceCount, legacy = {}) {
    let send = amount, cancel = 0;
    const cancelled = [];
    let currentSize = 0;
    for (let i = 0; i < this.queue.length; i++)
      currentSize += this.queue[i].amount;
    if (pieceCount + 1 <= this.options.openerPhase - (legacy.openerPhase ? 1 : 0) && currentSize >= this.sent)
      cancel += amount;
    while ((send > 0 || cancel > 0) && this.queue.length > 0) {
      this.queue[0].amount--;
      currentSize--;
      if (cancelled.length === 0 || cancelled[cancelled.length - 1].cid !== this.queue[0].cid) {
        cancelled.push({ ...this.queue[0], amount: 1 });
      } else {
        cancelled[cancelled.length - 1].amount++;
      }
      if (this.queue[0].amount <= 0) this.queue.shift();
      if (send > 0) send--;
      else cancel--;
    }
    this.sent += send;
    return [send, cancelled];
  }
  /**
   * This function does NOT take into account messiness on timeout.
   * The first garbage hole will be correct,
   * but subsequent holes depend on whether or not garbage is cancelled.
   */
  predict() {
    const rng = this.rng.clone();
    const rngex = rng.nextFloat.bind(rng);
    let lastColumn = this.lastColumn;
    const reroll = () => {
      lastColumn = this.#__internal_rerollColumn(lastColumn, rngex);
      return lastColumn;
    };
    const result = this.#__internal_tank(
      deepCopy(this.queue),
      () => lastColumn,
      rngex,
      reroll,
      -Number.MIN_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      false
    );
    return result.res;
  }
  get nextColumn() {
    const rng = this.rng.clone();
    if (this.lastColumn === null)
      return this.#__internal_rerollColumn(null, rng.nextFloat.bind(rng));
    return this.lastColumn;
  }
  #__internal_rerollColumn(current, rngex) {
    let col;
    const cols = columnWidth(
      this.options.boardWidth,
      this.options.garbage.holeSize
    );
    if (this.options.messiness.nosame && current !== null) {
      col = Math.floor(rngex() * (cols - 1));
      if (col >= current) col++;
    } else {
      col = Math.floor(rngex() * cols);
    }
    return col;
  }
  #rerollColumn() {
    const col = this.#__internal_rerollColumn(
      this.lastColumn,
      this.rngex.bind(this)
    );
    this.lastColumn = col;
    return col;
  }
  #__internal_tank(queue, lastColumn, rngex, reroll, frame, cap, hard) {
    if (queue.length === 0) return { res: [], lastColumn, queue };
    const res = [];
    queue = queue.sort((a, b) => a.frame - b.frame);
    if (this.options.messiness.timeout && frame >= this.lastTankTime + this.options.messiness.timeout) {
      reroll();
      this.lastTankTime = frame;
    }
    let total = 0;
    while (total < cap && queue.length > 0) {
      const item = deepCopy(queue[0]);
      if (item.frame + this.options.garbage.speed > (hard ? frame : frame - 1))
        break;
      total += item.amount;
      let exausted = false;
      if (total > cap) {
        const excess = total - cap;
        queue[0].amount = excess;
        item.amount -= excess;
      } else {
        queue.shift();
        exausted = true;
      }
      for (let i = 0; i < item.amount; i++) {
        const r = lastColumn() === null || rngex() < this.options.messiness.within;
        res.push({
          ...item,
          id: item.cid,
          amount: 1,
          column: r ? reroll() : lastColumn()
        });
      }
      if (exausted && rngex() < this.options.messiness.change) {
        reroll();
      }
    }
    return {
      res,
      queue
    };
  }
  tank(frame, cap, hard) {
    const { res, queue } = this.#__internal_tank(
      this.queue,
      () => this.lastColumn,
      this.rngex.bind(this),
      this.#rerollColumn.bind(this),
      frame,
      cap,
      hard
    );
    this.queue = queue;
    const output = new Array(res.length);
    for (let i = 0; i < res.length; i++) {
      output[i] = { ...res[i], bombs: this.options.bombs };
    }
    return output;
  }
  round(amount) {
    switch (this.options.rounding) {
      case "down":
        return Math.floor(amount);
      case "rng": {
        const floored = Math.floor(amount);
        if (floored === amount) return floored;
        const decimal = amount - floored;
        return floored + (this.rngex() < decimal ? 1 : 0);
      }
      default:
        throw new Error(`Invalid rounding mode ${this.options.rounding}`);
    }
  }
  reset() {
    this.queue = [];
  }
};

// .cache/triangle/src/engine/garbage/index.ts
var GarbageQueue = class {
  options;
  queue;
  lastTankTime = 0;
  lastColumn = null;
  hasChangedColumn = false;
  lastReceivedCount = 0;
  rng;
  // for opener phase calculations
  sent = 0;
  constructor(options) {
    this.options = deepCopy(options);
    if (!this.options.cap.absolute)
      this.options.cap.absolute = Number.MAX_SAFE_INTEGER;
    this.queue = [];
    this.rng = new RNG(this.options.seed);
  }
  snapshot() {
    return {
      seed: this.rng.seed,
      lastTankTime: this.lastTankTime,
      lastColumn: this.lastColumn,
      sent: this.sent,
      hasChangedColumn: this.hasChangedColumn,
      lastReceivedCount: this.lastReceivedCount,
      queue: deepCopy(this.queue)
    };
  }
  fromSnapshot(snapshot) {
    this.queue = deepCopy(snapshot.queue);
    this.lastTankTime = snapshot.lastTankTime;
    this.lastColumn = snapshot.lastColumn;
    this.rng = new RNG(snapshot.seed);
    this.sent = snapshot.sent;
    this.hasChangedColumn = snapshot.hasChangedColumn;
    this.lastReceivedCount = snapshot.lastReceivedCount;
  }
  rngex() {
    return this.rng.nextFloat();
  }
  get size() {
    let total = 0;
    for (let i = 0; i < this.queue.length; i++) total += this.queue[i].amount;
    return total;
  }
  resetReceivedCount() {
    this.lastReceivedCount = 0;
  }
  receive(...args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.amount > 0) this.queue.push(arg);
    }
    const cap = this.options.cap.absolute;
    let total = 0;
    for (let i = 0; i < this.queue.length; i++) total += this.queue[i].amount;
    while (total > cap) {
      const excess = total - cap;
      const lastIndex = this.queue.length - 1;
      const last = this.queue[lastIndex];
      if (last.amount <= excess) {
        total -= last.amount;
        this.queue.pop();
      } else {
        last.amount -= excess;
        total -= excess;
      }
    }
  }
  confirm(cid, gameid, frame) {
    const obj = this.queue.find((g) => g.cid === cid && g.gameid === gameid);
    if (!obj) return false;
    obj.frame = frame;
    obj.confirmed = true;
    return true;
  }
  cancel(amount, pieceCount, legacy = {}) {
    let send = amount, cancel = 0;
    const cancelled = [];
    let currentSize = 0;
    for (let i = 0; i < this.queue.length; i++)
      currentSize += this.queue[i].amount;
    if (pieceCount + 1 <= this.options.openerPhase - (legacy.openerPhase ? 1 : 0) && currentSize >= this.sent)
      cancel += amount;
    while ((send > 0 || cancel > 0) && this.queue.length > 0) {
      this.queue[0].amount--;
      if (cancelled.length === 0 || cancelled[cancelled.length - 1].cid !== this.queue[0].cid) {
        cancelled.push({ ...this.queue[0], amount: 1 });
      } else {
        cancelled[cancelled.length - 1].amount++;
      }
      if (this.queue[0].amount <= 0) {
        this.queue.shift();
        if (this.rngex() < this.options.messiness.change) {
          this.#reroll_column();
          this.hasChangedColumn = true;
        }
      }
      if (send > 0) send--;
      else cancel--;
    }
    this.sent += send;
    return [send, cancelled];
  }
  get #columnWidth() {
    return Math.max(
      0,
      this.options.boardWidth - (this.options.garbage.holeSize - 1)
    );
  }
  #reroll_column() {
    const centerBuffer = this.options.messiness.center ? Math.round(this.options.boardWidth / 5) : 0;
    let col;
    if (this.options.messiness.nosame && this.lastColumn !== null) {
      col = centerBuffer + Math.floor(this.rngex() * (this.#columnWidth - 1 - 2 * centerBuffer));
      if (col >= this.lastColumn) col++;
    } else {
      col = centerBuffer + Math.floor(this.rngex() * (this.#columnWidth - 2 * centerBuffer));
    }
    this.lastColumn = col;
    return col;
  }
  tank(frame, cap, hard) {
    if (this.queue.length === 0) return [];
    const res = [];
    this.queue = this.queue.sort((a, b) => a.frame - b.frame);
    if (this.options.messiness.timeout && frame >= this.lastTankTime + this.options.messiness.timeout) {
      this.#reroll_column();
      this.hasChangedColumn = true;
    }
    const tankAll = false;
    const lines = tankAll ? 400 : Math.floor(Math.min(cap, this.options.cap.max));
    for (let i = 0; i < lines && this.queue.length !== 0; i++) {
      const item = this.queue[0];
      if (item.frame + this.options.garbage.speed > (hard ? frame : frame - 1))
        break;
      item.amount--;
      this.lastReceivedCount++;
      let col = this.lastColumn;
      if ((col === null || this.rngex() < this.options.messiness.within) && !this.hasChangedColumn) {
        col = this.#reroll_column();
        this.hasChangedColumn = true;
      }
      res.push({
        ...item,
        amount: 1,
        column: col,
        id: item.cid
      });
      this.hasChangedColumn = false;
      if (item.amount <= 0) {
        this.queue.shift();
        if (this.rngex() < this.options.messiness.change) {
          this.#reroll_column();
          this.hasChangedColumn = true;
        }
      }
    }
    return res;
  }
  round(amount) {
    switch (this.options.rounding) {
      case "down":
        return Math.floor(amount);
      case "rng": {
        const floored = Math.floor(amount);
        if (floored === amount) return floored;
        const decimal = amount - floored;
        return floored + (this.rngex() < decimal ? 1 : 0);
      }
      default:
        throw new Error(`Invalid rounding mode ${this.options.rounding}`);
    }
  }
  reset() {
    this.queue = [];
  }
};

// .cache/triangle/src/engine/multiplayer/ige.ts
var IGEHandler = class {
  #players;
  #iid = 0;
  /**
   * Manages network IGE cancelling
   * @param players - list of player ids
   */
  constructor(players) {
    this.#players = new polyfills.Map();
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      this.#players.set(player, { incoming: 0, outgoing: [] });
    }
  }
  /**
   * Sends a message to a player.
   * Adds the player to the players list if it does not exist.
   * @param options - info on sending player
   * @param options.playerID - The ID of the player to send the message to.
   * @param options.amount - The amount of the message.
   */
  send({ playerID, amount }) {
    if (amount === 0) return;
    let player = this.#players.get(playerID);
    const iid = ++this.#iid;
    if (!player) {
      player = { incoming: 0, outgoing: [] };
      this.#players.set(playerID, player);
    }
    player.outgoing.push({ iid, amount });
  }
  /**
   * Receives a garbage from a player and processes it.
   * Adds the player to the players list if it does not exist.
   * @param garbage - garbage object of data
   * @param garbage.playerID - The ID of the player sending the garbage.
   * @param garbage.ackiid - The IID of the last acknowledged item.
   * @param garbage.iid - The IID of the incoming item.
   * @param garbage.amount - The amount of the incoming item.
   * @returns The remaining amount after processing the message.
   */
  receive({
    playerID,
    ackiid,
    iid,
    amount
  }) {
    let player = this.#players.get(playerID);
    if (!player) {
      player = { incoming: 0, outgoing: [] };
      this.#players.set(playerID, player);
    }
    const incomingIID = Math.max(iid, player.incoming ?? 0);
    const newIGEs = [];
    let runningAmount = amount;
    for (let i = 0; i < player.outgoing.length; i++) {
      const item = player.outgoing[i];
      if (item.iid <= ackiid) continue;
      const amt = Math.min(item.amount, runningAmount);
      item.amount -= amt;
      runningAmount -= amt;
      if (item.amount > 0) newIGEs.push(item);
    }
    this.#players.set(playerID, { incoming: incomingIID, outgoing: newIGEs });
    return runningAmount;
  }
  snapshot() {
    return {
      players: Object.fromEntries(this.#players.entries()),
      iid: this.#iid
    };
  }
  fromSnapshot(snapshot) {
    this.#players = new polyfills.Map();
    const entries = Object.entries(snapshot.players);
    for (let i = 0; i < entries.length; i++) {
      const [k, v] = entries[i];
      this.#players.set(Number(k), v);
    }
    this.#iid = snapshot.iid;
  }
};

// console-colors:chalk
var identity = (value) => value;
var chalk = new Proxy(identity, { get: (_, key) => key === "bgHex" || key === "hex" ? () => identity : identity });
var chalk_default = chalk;

// .cache/triangle/src/engine/index.ts
var Engine = class _Engine {
  queue;
  // internal queue matching tetrio length for handling resets correctly
  #queue;
  held;
  holdLocked;
  falling;
  #kickTable;
  #undoHook;
  board;
  lastSpin;
  lastWasClear;
  stats;
  gameOptions;
  garbageQueue;
  frame;
  subframe;
  initializer;
  handling;
  input;
  pc;
  b2b;
  dynamic;
  glock;
  multiplayer;
  igeHandler;
  misc;
  state;
  stock;
  practice;
  time;
  spike;
  events = new EventEmitter();
  /** @internal */
  resCache;
  constructor(options) {
    this.initializer = deepCopy(options, [
      { type: Date, copy: (d) => new Date(d) }
    ]);
    this.init();
  }
  init() {
    const options = deepCopy(this.initializer, [
      { type: Date, copy: (d) => new Date(d) }
    ]);
    this.queue = new Queue(options.queue);
    this.#queue = new Queue(options.queue);
    this.#queue.minLength = 14;
    this.queue.onRepopulate(this.#onQueueRepopulate.bind(this));
    this.#kickTable = options.kickTable;
    this.board = new Board(options.board);
    this.garbageQueue = new ((options.misc.date ?? /* @__PURE__ */ new Date()) > /* @__PURE__ */ new Date("2025-05-06T15:00:00-04:00") ? GarbageQueue : LegacyGarbageQueue)(options.garbage);
    this.igeHandler = new IGEHandler(options.multiplayer?.opponents || []);
    if (options.multiplayer)
      this.multiplayer = {
        options: options.multiplayer,
        targets: [],
        passthrough: {
          network: ["consistent", "zero"].includes(
            options.multiplayer.passthrough
          ),
          replay: options.multiplayer.passthrough !== "full",
          travel: ["zero", "limited"].includes(options.multiplayer.passthrough)
        }
      };
    this.held = null;
    this.holdLocked = false;
    this.lastSpin = null;
    this.lastWasClear = false;
    this.stats = {
      combo: -1,
      b2b: -1,
      pieces: 0,
      lines: 0,
      garbage: {
        sent: 0,
        attack: 0,
        receive: 0,
        cleared: 0
      }
    };
    this.pc = options.pc;
    this.b2b = {
      chaining: options.b2b.chaining,
      charging: options.b2b.charging
    };
    this.dynamic = {
      gravity: new IncreaseTracker(
        options.gravity.value,
        options.gravity.increase,
        options.gravity.marginTime
      ),
      garbageMultiplier: new IncreaseTracker(
        options.garbage.multiplier.value,
        options.garbage.multiplier.increase,
        options.garbage.multiplier.marginTime
      ),
      garbageCap: new IncreaseTracker(
        options.garbage.cap.value,
        options.garbage.cap.increase,
        options.garbage.cap.marginTime
      )
    };
    this.glock = 0;
    this.stock = options.options.stock;
    this.misc = options.misc;
    this.practice = {
      redo: [],
      undo: [],
      retry: false,
      retryIter: 0,
      lastPiece: null
    };
    this.time = {
      frameOffset: 0
    };
    this.gameOptions = options.options;
    this.handling = options.handling;
    this.input = {
      lShift: { held: false, arr: 0, das: 0, dir: -1 },
      rShift: { held: false, arr: 0, das: 0, dir: 1 },
      lastShift: -1,
      firstInputTime: -1,
      time: { start: 0, zero: true, locked: false, prev: 0 },
      lastPieceTime: 0,
      keys: {
        softDrop: false,
        hold: false,
        rotateCW: false,
        rotateCCW: false,
        rotate180: false
      }
    };
    this.frame = 0;
    this.subframe = 0;
    this.state = 0;
    this.spike = {
      count: 0,
      timer: 0
    };
    this.#flushRes();
    if (this.#undoHook) this.#undoHook.destroy();
    this.#undoHook = new Hook(this.events);
    if (this.misc.allowed.undo) {
      this.#undoHook.on(
        "falling.lock.pre",
        this.undoPieceLockHandler.bind(this)
      );
      this.#undoHook.on("falling.new", this.undoPieceSpawnHandler.bind(this));
    }
    this.nextPiece();
    this.bindAll();
  }
  #flushRes() {
    let res = null;
    if (this.resCache) {
      res = {
        pieces: this.resCache.pieces,
        garbage: {
          sent: [...this.resCache.garbage.sent],
          received: [...this.resCache.garbage.received]
        },
        keys: [...this.resCache.keys],
        lastLock: this.resCache.lastLock
      };
    }
    this.resCache = {
      pieces: 0,
      garbage: {
        sent: [],
        received: []
      },
      keys: [],
      lastLock: res?.lastLock ?? 0
    };
    return res;
  }
  reset() {
    this.init();
  }
  bindAll() {
    this.moveRight = this.moveRight.bind(this);
    this.moveLeft = this.moveLeft.bind(this);
    this.dasRight = this.dasRight.bind(this);
    this.dasLeft = this.dasLeft.bind(this);
    this.softDrop = this.softDrop.bind(this);
    this.hardDrop = this.hardDrop.bind(this);
    this.hold = this.hold.bind(this);
    this.rotateCW = this.rotateCW.bind(this);
    this.rotateCCW = this.rotateCCW.bind(this);
    this.rotate180 = this.rotate180.bind(this);
    this.undo = this.undo.bind(this);
    this.redo = this.redo.bind(this);
    this.retry = this.retry.bind(this);
    this.snapshot = this.snapshot.bind(this);
    this.fromSnapshot = this.fromSnapshot.bind(this);
    this.nextPiece = this.nextPiece.bind(this);
  }
  #onQueueRepopulate(pieces) {
    this.events.emit("queue.add", pieces);
  }
  snapshot({ isUndoRedo = false } = {}) {
    return {
      __meta: {
        isUndoRedo
      },
      board: deepCopy(this.board.state),
      falling: this.falling.snapshot(),
      frame: this.frame,
      garbage: this.garbageQueue.snapshot(),
      hold: this.held,
      holdLocked: this.holdLocked,
      lastSpin: deepCopy(this.lastSpin),
      lastWasClear: this.lastWasClear,
      queue: this.queue.snapshot(),
      _queue: this.#queue.snapshot(),
      input: deepCopy(this.input),
      subframe: this.subframe,
      targets: this.multiplayer?.targets,
      stats: deepCopy(this.stats),
      glock: this.glock,
      stock: this.stock,
      ige: this.igeHandler.snapshot(),
      state: this.state,
      spike: deepCopy(this.spike),
      time: deepCopy(this.time),
      resCache: deepCopy(this.resCache),
      practice: isUndoRedo ? {
        lastPiece: null,
        redo: [],
        undo: [],
        retry: this.practice.retry,
        retryIter: this.practice.retryIter
      } : deepCopy(this.practice)
    };
  }
  fromSnapshot(snapshot) {
    const options = this.initializer;
    this.board.state = deepCopy(snapshot.board);
    this.falling = new Tetromino({
      boardHeight: this.board.height,
      boardWidth: this.board.width,
      initialRotation: this.kickTable.spawn_rotation[snapshot.falling.symbol.toLowerCase()] ?? 0,
      symbol: snapshot.falling.symbol,
      from: snapshot.falling
    });
    for (const key of Object.keys(snapshot.falling)) {
      this.falling[key] = deepCopy(snapshot.falling[key]);
    }
    if (!snapshot.__meta.isUndoRedo) {
      this.frame = snapshot.frame;
      this.subframe = snapshot.subframe;
    }
    this.garbageQueue.fromSnapshot(snapshot.garbage);
    this.held = snapshot.hold;
    this.holdLocked = snapshot.holdLocked;
    this.lastSpin = deepCopy(snapshot.lastSpin);
    this.lastWasClear = snapshot.lastWasClear;
    this.queue.fromSnapshot(snapshot.queue);
    this.#queue.fromSnapshot(snapshot._queue);
    this.dynamic = {
      gravity: new IncreaseTracker(
        options.gravity.value,
        options.gravity.increase,
        options.gravity.marginTime
      ),
      garbageMultiplier: new IncreaseTracker(
        options.garbage.multiplier.value,
        options.garbage.multiplier.increase,
        options.garbage.multiplier.marginTime
      ),
      garbageCap: new IncreaseTracker(
        options.garbage.cap.value,
        options.garbage.cap.increase,
        options.garbage.cap.marginTime
      )
    };
    for (let i = 0; i < this.frame; i++) {
      this.dynamic.gravity.tick();
      this.dynamic.garbageMultiplier.tick();
      this.dynamic.garbageCap.tick();
    }
    if (!snapshot.__meta.isUndoRedo) {
      this.input = deepCopy(snapshot.input);
    } else {
      this.input.firstInputTime = snapshot.input.firstInputTime;
      this.input.time = deepCopy(snapshot.input.time);
      this.input.lastPieceTime = snapshot.input.lastPieceTime;
      this.input.keys = {
        ...deepCopy(snapshot.input.keys),
        softDrop: this.input.keys.softDrop
      };
    }
    if (this.multiplayer && snapshot.targets && !snapshot.__meta.isUndoRedo)
      this.multiplayer.targets = [...snapshot.targets];
    this.stats = deepCopy(snapshot.stats);
    this.glock = snapshot.glock;
    this.stock = snapshot.stock;
    this.state = snapshot.state;
    this.spike = deepCopy(snapshot.spike);
    this.time = deepCopy(snapshot.time);
    this.igeHandler.fromSnapshot(snapshot.ige);
    this.resCache = deepCopy(snapshot.resCache);
    this.practice = {
      retry: snapshot.practice.retry,
      retryIter: snapshot.practice.retryIter,
      lastPiece: !snapshot.__meta.isUndoRedo ? deepCopy(snapshot.practice.lastPiece) : this.practice.lastPiece,
      redo: !snapshot.__meta.isUndoRedo ? deepCopy(snapshot.practice.redo) : this.practice.redo,
      undo: !snapshot.__meta.isUndoRedo ? deepCopy(snapshot.practice.undo) : this.practice.undo
    };
  }
  get kickTable() {
    return kicks[this.#kickTable];
  }
  get kickTableName() {
    return this.#kickTable;
  }
  set kickTable(value) {
    this.#kickTable = value;
  }
  get dynamicStats() {
    const frame = this.frame - this.time.frameOffset;
    return {
      apm: this.stats.garbage.attack / (frame / 60 / 60) || 0,
      pps: this.stats.pieces / (frame / 60) || 0,
      vs: (this.stats.garbage.attack + this.stats.garbage.cleared) / (frame / 60) * 100 || 0,
      surgePower: this.b2b.charging ? Math.floor(
        this.stats.b2b - this.b2b.charging.at + this.b2b.charging.base + 1
      ) : 0
    };
  }
  #getEffectiveGravity() {
    return this.glock <= 0 ? this.dynamic.gravity.get() : this.glock <= 180 ? (1 - this.glock / 180) ** 2 * this.dynamic.gravity.get() : 0;
  }
  #hasHitWall() {
    return !!(this.state & constants.flags.STATE_WALL);
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #hasRotated() {
    return !!(this.state & (constants.flags.ROTATION_LEFT | constants.flags.ROTATION_RIGHT));
  }
  // @ts-expect-error
  // eslint-disable-next-line no-unused-private-class-members
  #hasRotated180() {
    return !!(this.state & constants.flags.ROTATION_180);
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isSpin() {
    return !!(this.state & constants.flags.ROTATION_SPIN);
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isSpinMini() {
    return !(~this.state & (constants.flags.ROTATION_SPIN | constants.flags.ROTATION_MINI));
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isSpinAll() {
    return !!(this.state & constants.flags.ROTATION_SPIN_ALL);
  }
  #isSleep() {
    return !!(this.state & constants.flags.STATE_SLEEP);
  }
  #setSleep(sleep) {
    if (sleep) this.state |= constants.flags.STATE_SLEEP;
    else this.state &= ~constants.flags.STATE_SLEEP;
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isFloored() {
    return !!(this.state & constants.flags.STATE_FLOOR);
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isVisible() {
    return !(this.state & constants.flags.STATE_NODRAW);
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #isSoftDropped() {
    return !!(this.state & constants.flags.ACTION_SOFTDROP);
  }
  #isForcedToLock() {
    return !!(this.state & constants.flags.ACTION_FORCELOCK);
  }
  #is20G() {
    const is20G = this.dynamic.gravity.get() > this.board.height;
    const mode20G = this.misc.movement.may20G;
    if (this.input.keys.softDrop) {
      const preferSoftDrop = this.handling.may20g || is20G && mode20G;
      return (this.handling.sdf === 41 || this.dynamic.gravity.get() * this.handling.sdf > this.board.height) && preferSoftDrop;
    }
    return is20G && mode20G;
  }
  #shouldLock() {
    return !this.misc.movement.infinite && this.falling.lockResets >= this.misc.movement.lockResets;
  }
  #shouldFallFaster() {
    return this.misc.movement.infinite ? false : this.falling.rotResets > this.misc.movement.lockResets + 15;
  }
  #clearFlags(e) {
    this.state &= ~e;
  }
  #__internal_lock(subframe = 1 - this.subframe) {
    this.falling.locking += subframe;
    return this.falling.locking > this.misc.movement.lockTime || !!this.#isForcedToLock() || this.#shouldLock();
  }
  #__internal_fall(value) {
    let y1 = Math.round(1e6 * (this.falling.location[1] - value)) / 1e6, y2 = this.falling.location[1] - 1;
    if (y1 % 1 === 0) y1 -= 1e-6;
    if (y2 % 1 === 0) y2 += 2e-6;
    if (!legal(this.falling.absoluteAt({ y: y1 }), this.board.state) || !legal(this.falling.absoluteAt({ y: y2 }), this.board.state))
      return false;
    const { highestY } = this.falling;
    if (highestY > y1) this.falling.highestY = Math.floor(y1);
    this.falling.location[1] = y1;
    if (this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    this.state &= ~constants.flags.STATE_FLOOR;
    if (y1 < highestY || this.misc.movement.infinite) {
      this.falling.lockResets = 0;
      this.falling.rotResets = 0;
    }
    return true;
  }
  // @ts-expect-error unused
  // eslint-disable-next-line no-unused-private-class-members
  #__internal_lockout() {
  }
  #__internal_dcd() {
    if (!this.#hasHitWall() || !this.handling.dcd) return;
    this.input.lShift.das = Math.min(
      this.input.lShift.das,
      this.handling.das - this.handling.dcd
    );
    this.input.lShift.arr = this.handling.arr;
    this.input.rShift.das = Math.min(
      this.input.rShift.das,
      this.handling.das - this.handling.dcd
    );
    this.input.rShift.arr = this.handling.arr;
  }
  #fall(subframe = 1 - this.subframe) {
    if (this.falling.safeLock > 0) this.falling.safeLock--;
    if (this.#isSleep()) return;
    let fall = this.#getEffectiveGravity() * subframe;
    if (this.glock > 0) this.glock -= subframe;
    if (this.glock < 0) this.glock = 0;
    if (this.input.keys.softDrop) {
      if (this.handling.sdf === 41) fall = 400 * subframe;
      else {
        fall *= this.handling.sdf;
        fall = Math.max(fall, 0.05 * this.handling.sdf);
      }
    }
    if (this.#shouldLock() && !legal(
      this.falling.absoluteAt({ y: this.falling.location[1] - 1 }),
      this.board.state
    )) {
      fall = 20;
      this.state |= constants.flags.ACTION_FORCELOCK;
    }
    if (this.#shouldFallFaster()) {
      fall += 0.5 * subframe * (this.falling.rotResets - (this.misc.movement.lockResets + 15));
    }
    for (let dropFactor = fall; dropFactor > 0; dropFactor -= Math.min(1, dropFactor)) {
      const y = this.falling.location[1];
      if (!this.#__internal_fall(Math.min(1, dropFactor))) {
        if (this.#__internal_lock(subframe)) {
          if (this.handling.safelock) this.falling.safeLock = 7;
          this.#lock(false);
        }
        return;
      }
      if (Math.floor(y) !== Math.floor(this.falling.location[1])) {
        this.state &= ~constants.flags.ROTATION_ALL;
      }
    }
  }
  #clampRotation(amount) {
    return ((this.falling.rotation + amount) % 4 + 4) % 4;
  }
  #__internal_rotate(newX, newY, newRotation, rotationDirection, kick, _isIRS = false) {
    if (rotationDirection >= 2) {
      rotationDirection = newRotation > this.falling.rotation ? 1 : -1;
      this.state |= constants.flags.ROTATION_180;
    }
    this.falling.x = newX;
    this.falling.y = newY;
    this.falling.rotation = newRotation;
    this.state |= rotationDirection === 1 ? constants.flags.ROTATION_RIGHT : constants.flags.ROTATION_LEFT;
    this.state &= ~(constants.flags.ROTATION_SPIN | constants.flags.ROTATION_MINI | constants.flags.ROTATION_SPIN_ALL);
    if (this.falling.lockResets < 31) this.falling.lockResets++;
    if (this.falling.rotResets < 63) this.falling.rotResets++;
    const spin = this.#detectSpin(this.#isTSpinKick(kick));
    this.lastSpin = spin;
    if (spin) {
      this.state |= constants.flags.ROTATION_SPIN;
      if (spin === "mini") {
        this.state |= constants.flags.ROTATION_MINI;
      }
    }
    this.falling.totalRotations++;
    this.#__internal_dcd();
    if (!this.#shouldLock()) {
      this.falling.locking = 0;
    }
    return true;
  }
  #kick(to) {
    const kick = performKick(
      this.kickTableName,
      this.falling.symbol,
      this.falling.location,
      [this.falling.aox, this.falling.aoy],
      !this.misc.movement.infinite && this.falling.totalRotations > this.misc.movement.lockResets + 15,
      this.falling.states[to],
      this.falling.rotation,
      to,
      this.board.state
    );
    if (typeof kick === "object") return kick;
    else
      return kick === false ? false : {
        kick: [0, 0],
        newLocation: [this.falling.location[0], this.falling.location[1]],
        id: "00",
        index: 0
      };
  }
  #rotate(amount, isIRS = false) {
    if (this.#isSleep()) {
      if (this.handling.irs === "tap")
        this.falling.irs = ((this.falling.irs + amount) % 4 + 4) % 4;
      return false;
    }
    const to = this.#clampRotation(amount);
    this.state |= constants.flags.ACTION_MOVE;
    this.state |= constants.flags.ACTION_ROTATE;
    const kick = this.#kick(to);
    return kick ? this.#__internal_rotate(
      kick.newLocation[0],
      kick.newLocation[1],
      to,
      amount,
      kick,
      isIRS
    ) : false;
  }
  nextPiece(ignoreBlockout = false, isHold = false) {
    const newTetromino = this.queue.shift();
    this.#queue.shift();
    this.initiatePiece(newTetromino, ignoreBlockout, isHold);
  }
  // TODO: finish
  // @ts-expect-error wip
  // eslint-disable-next-line no-unused-private-class-members
  #loseStockOrGameOver(_reason) {
    if (this.stock <= 0) {
    } else {
      this.#setSleep(true);
    }
  }
  initiatePiece(piece, ignoreBlockout = false, isHold = false) {
    if (this.handling.irs === "hold" && this.falling) {
      let rotationState = 0;
      if (this.input.keys.rotateCCW) rotationState -= 1;
      if (this.input.keys.rotateCW) rotationState += 1;
      if (this.input.keys.rotate180) rotationState += 2;
      this.falling.irs = (rotationState % 4 + 4) % 4;
    }
    if (this.handling.ihs === "hold" && this.input.keys.hold && !isHold) {
      this.state |= constants.flags.ACTION_IHS;
    }
    this.#__internal_dcd();
    this.state &= ~(constants.flags.ROTATION_ALL | constants.flags.STATE_ALL | constants.flags.ACTION_FORCELOCK | constants.flags.ACTION_SOFTDROP | constants.flags.ACTION_MOVE | constants.flags.ACTION_ROTATE);
    this.input.firstInputTime = -1;
    if (!isHold) this.holdLocked = false;
    this.falling = new Tetromino({
      boardHeight: this.board.height,
      boardWidth: this.board.width,
      initialRotation: this.kickTable.spawn_rotation[piece.toLowerCase()] ?? 0,
      symbol: piece,
      from: this.falling
    });
    if (!ignoreBlockout && this.#considerBlockout(isHold)) {
      this.state ^= constants.flags.ACTION_IHS;
      this.falling.irs = 0;
    } else {
      if (this.state & constants.flags.ACTION_IHS) {
        this.state ^= constants.flags.ACTION_IHS;
        this.hold(true, ignoreBlockout);
      } else {
        if (this.falling.irs !== 0) {
          this.#rotate(this.falling.irs, true);
          this.falling.irs = 0;
        }
        if (this.#considerBlockout(!ignoreBlockout || isHold)) {
        } else {
          if (this.#is20G()) {
            this.#slamToFloor();
          }
        }
      }
    }
    this.events.emit("falling.new", { piece: this.falling.symbol, isHold });
  }
  #considerBlockout(isSilent = false) {
    if (legal(this.falling.absoluteBlocks, this.board.state)) {
      return false;
    }
    let clutched = false;
    if (this.lastWasClear && this.gameOptions.clutch !== false) {
      const originalY = this.falling.location[1];
      const originalHy = this.falling.highestY;
      while (this.falling.y < this.board.fullHeight) {
        this.falling.location[1]++;
        this.falling.highestY++;
        if (legal(this.falling.absoluteBlocks, this.board.state)) {
          clutched = true;
          break;
        }
      }
      if (!clutched) {
        this.falling.location[1] = originalY;
        this.falling.highestY = originalHy;
      }
    }
    if (!clutched) return true;
    if (!isSilent) {
    }
    return false;
  }
  hold(_ihs = false, ignoreBlockout = false) {
    if (this.#isSleep()) {
      if (this.handling.ihs === "tap") this.state |= constants.flags.ACTION_IHS;
      return false;
    }
    if (this.holdLocked || !this.misc.allowed.hold) return false;
    this.holdLocked = !this.misc.infiniteHold;
    if (this.held) {
      const save = this.held;
      this.held = this.falling.symbol;
      this.initiatePiece(save, ignoreBlockout, true);
    } else {
      this.held = this.falling.symbol;
      this.nextPiece(ignoreBlockout, true);
    }
    this.holdLocked = !this.misc.infiniteHold;
    return true;
  }
  #slamToFloor() {
    while (this.#__internal_fall(1)) {
    }
  }
  get toppedOut() {
    try {
      for (const block of this.falling.blocks) {
        if (this.board.state[-block[1] + this.falling.y][block[0] + this.falling.location[0]] !== null)
          return true;
      }
      return false;
    } catch {
      return true;
    }
  }
  #isTSpinKick(kick) {
    if (typeof kick === "object") {
      return (
        // fin cw and tst ccw
        (kick.id === "23" || kick.id === "03") && kick.kick[0] === 1 && kick.kick[1] === -2 || // fin ccw and tst cw
        (kick.id === "21" || kick.id === "01") && kick.kick[0] === -1 && kick.kick[1] === -2
      );
    }
    return false;
  }
  rotateCW() {
    return this.#processRotate(1);
  }
  rotateCCW() {
    return this.#processRotate(-1);
  }
  rotate180() {
    return this.#processRotate(2);
  }
  moveRight() {
    const res = this.falling.moveRight(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }
  moveLeft() {
    const res = this.falling.moveLeft(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }
  dasRight() {
    const res = this.falling.dasRight(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }
  dasLeft() {
    const res = this.falling.dasLeft(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }
  softDrop() {
    const res = this.falling.softDrop(this.board.state);
    if (res && this.gameOptions.spinBonuses !== "stupid") this.lastSpin = null;
    return res;
  }
  undoPieceSpawnHandler({ isHold }) {
    if (isHold) return;
    this.practice.lastPiece = this.snapshot({ isUndoRedo: true });
  }
  undoPieceLockHandler() {
    this.practice.undo.push(this.practice.lastPiece);
    if (this.practice.undo.length > 100) this.practice.undo.shift();
    this.practice.redo.length = 0;
  }
  undo() {
    if (!this.misc.allowed.undo || this.practice.undo.length === 0)
      return false;
    this.practice.redo.push(this.practice.lastPiece);
    this.practice.lastPiece = this.practice.undo.pop();
    this.fromSnapshot(this.practice.lastPiece);
    this.practice.retry = false;
    this.practice.retryIter = 0;
  }
  redo() {
    if (!this.misc.allowed.undo || this.practice.redo.length === 0)
      return false;
    this.practice.undo.push(this.practice.lastPiece);
    this.practice.lastPiece = this.practice.redo.pop();
    this.fromSnapshot(this.practice.lastPiece);
    this.practice.retry = false;
    this.practice.retryIter = 0;
  }
  retry() {
    if (this.misc.allowed.undo) this.undoPieceLockHandler();
    this.practice.retry = false;
    this.practice.retryIter = 0;
    this.held = null;
    this.holdLocked = false;
    this.#queue.clear();
    this.#queue.repopulateOnce();
    this.queue.fromSnapshot(this.#queue.snapshot());
    this.board.reset();
    this.garbageQueue.reset();
    this.stats = {
      combo: -1,
      b2b: -1,
      pieces: 0,
      lines: 0,
      garbage: {
        sent: 0,
        attack: 0,
        receive: 0,
        cleared: 0
      }
    };
    this.time.frameOffset = this.frame;
    this.nextPiece();
  }
  #maxSpin(...spins) {
    let best = spins[0];
    let bestScore = best === "normal" ? 2 : best === "mini" ? 1 : 0;
    for (let i = 1; i < spins.length; i++) {
      const spin = spins[i];
      const score = spin === "normal" ? 2 : spin === "mini" ? 1 : 0;
      if (score >= bestScore) {
        best = spin;
        bestScore = score;
      }
    }
    return best;
  }
  #detectSpin(finOrTst) {
    if (this.gameOptions.spinBonuses === "none") return "none";
    const tSpin = [
      "all",
      "all-mini",
      "all-mini+",
      "all+",
      "T-spins",
      "T-spins+"
    ].includes(this.gameOptions.spinBonuses) && this.falling.symbol === "t" ? this.#detectSpinFromCorners(finOrTst) : false;
    const allSpin = this.falling.isAllSpinPosition(this.board.state);
    switch (this.gameOptions.spinBonuses) {
      case "stupid":
        return this.falling.isStupidSpinPosition(this.board.state) ? "normal" : "none";
      case "T-spins":
        return tSpin || "none";
      case "T-spins+":
        return this.#maxSpin(
          tSpin || "none",
          allSpin ? this.falling.symbol === "t" ? "mini" : "none" : "none"
        );
      case "all":
        return tSpin || (allSpin ? "normal" : "none");
      case "all-mini":
        return tSpin || (allSpin ? "mini" : "none");
      case "all+":
        return this.#maxSpin(
          tSpin || "none",
          allSpin ? this.falling.symbol === "t" ? "mini" : "normal" : "none"
        );
      case "all-mini+":
        return this.#maxSpin(tSpin || "none", allSpin ? "mini" : "none");
      case "mini-only":
        return tSpin === "normal" ? "mini" : this.#maxSpin(tSpin || "none", allSpin ? "mini" : "none");
      case "handheld":
        return this.#detectSpinFromCorners(finOrTst);
    }
  }
  #spinbonuses(piece) {
    const p = tetrominoes[piece];
    const rules = spinbonusRules[this.gameOptions.spinBonuses];
    return p?.spinbonus_override ? (
      // @ts-expect-error
      p.spinbonus_override?.mini
    ) : (
      // @ts-expect-error
      !!rules?.types_mini?.includes(piece)
    );
  }
  #detectSpinFromCorners(finOrTst) {
    const blocks = this.falling.blocks;
    const absolute = new Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      absolute[i] = [
        block[0] + this.falling.location[0],
        -block[1] + this.falling.y - 1
      ];
    }
    if (legal(absolute, this.board.state)) return "none";
    let corners = 0;
    let frontCorners = 0;
    for (let i = 0; i < 4; i++) {
      const table = cornerTable[this.falling.symbol]?.[this.falling.rotation];
      if (!table) break;
      if (this.board.occupied(
        this.falling.x + table[i][0] + 1,
        this.falling.y - table[i][1] - 1
      )) {
        corners++;
        if (this.falling.rotation === table[i][2] || this.falling.rotation === table[i][3]) {
          frontCorners++;
        }
      }
    }
    if (corners < 3) return "none";
    let spin = "normal";
    if (this.#spinbonuses(this.falling.symbol) && frontCorners !== 2)
      spin = "mini";
    if (finOrTst) spin = "normal";
    return spin;
  }
  /** */
  hardDrop() {
    while (this.#__internal_fall(1)) ;
    return this.#lock(true);
  }
  #lock(hard) {
    this.holdLocked = false;
    const blocks = this.falling.blocks;
    const placed = new Array(blocks.length);
    const placedPos = new Array(blocks.length);
    const connectInput = new Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const x = this.falling.location[0] + block[0];
      const y = this.falling.y - block[1];
      placed[i] = [this.falling.symbol, x, y];
      placedPos[i] = [x, y];
      connectInput[i] = [x, -y];
    }
    const connected = this.connect(connectInput);
    const boardAddParams = new Array(connected.length);
    for (let i = 0; i < connected.length; i++) {
      const c = connected[i];
      boardAddParams[i] = [
        { mino: this.falling.symbol, connections: c[2] },
        c[0],
        -c[1]
      ];
    }
    this.board.add(...boardAddParams);
    const { lines, garbageCleared } = this.board.clearBombsAndLines(placedPos);
    const pc = this.board.perfectClear;
    if (this.spilinkHooks) return this.spilinkHooks.clear({
      lines,
      garbageCleared,
      pc,
      hard,
      mino: this.falling.symbol,
      spin: this.lastSpin || "none"
    });
    this.stats.garbage.cleared += garbageCleared;
    let brokeB2B = this.stats.b2b;
    if (lines > 0) {
      this.stats.combo++;
      if ((this.lastSpin && this.lastSpin !== "none" || lines >= 4) && !(pc && this.pc && this.pc.b2b)) {
        this.stats.b2b++;
        brokeB2B = false;
      }
      if (pc && this.pc && this.pc.b2b) {
        this.stats.b2b += this.pc.b2b;
        brokeB2B = false;
      }
      if (brokeB2B !== false) {
        this.stats.b2b = -1;
      }
    } else {
      this.stats.combo = -1;
      brokeB2B = false;
    }
    const gSpecialBonus = this.garbageQueue.options.specialBonus && garbageCleared > 0 && (this.lastSpin && this.lastSpin !== "none" || lines >= 4) ? 1 : 0;
    const garbage = garbageCalcV2(
      {
        b2b: Math.max(this.stats.b2b, 0),
        combo: Math.max(this.stats.combo, 0),
        enemies: 0,
        lines,
        piece: this.falling.symbol,
        spin: this.lastSpin ? this.lastSpin : "none"
      },
      {
        ...this.gameOptions,
        b2b: { chaining: this.b2b.chaining, charging: !!this.b2b.charging }
      }
    );
    const gEvents = garbage.garbage > 0 || gSpecialBonus > 0 ? [
      this.garbageQueue.round(
        garbage.garbage * this.dynamic.garbageMultiplier.get() + gSpecialBonus
      )
    ] : [];
    let surged = 0;
    if (brokeB2B !== false) {
      const btb = brokeB2B;
      if (this.b2b.charging !== false && btb + 1 > this.b2b.charging.at) {
        surged = Math.floor(
          (btb - this.b2b.charging.at + this.b2b.charging.base + 1) * this.dynamic.garbageMultiplier.get()
        );
        const garbages = [
          Math.round(surged / 3),
          Math.round(surged / 3),
          surged - 2 * Math.round(surged / 3)
        ];
        gEvents.splice(0, 0, ...garbages);
        brokeB2B = false;
      }
    }
    if (pc && this.pc) {
      gEvents.push(
        this.garbageQueue.round(
          this.pc.garbage * this.dynamic.garbageMultiplier.get()
        )
      );
    }
    const filteredGarbage = [];
    for (let i = 0; i < gEvents.length; i++) {
      const g = gEvents[i];
      if (g > 0) filteredGarbage.push(g);
    }
    const res = {
      mino: this.falling.symbol,
      garbageCleared,
      lines,
      spin: this.lastSpin ? this.lastSpin : "none",
      garbage: filteredGarbage,
      rawGarbage: [...filteredGarbage],
      surge: surged,
      stats: this.stats,
      garbageAdded: false,
      topout: false,
      keysPresses: this.resCache.keys.splice(0),
      pieceTime: Math.round((this.frame + this.subframe - this.resCache.lastLock) * 10) / 10
    };
    for (const gb of res.garbage) this.stats.garbage.attack += gb;
    if (lines > 0) {
      const cancelEvents = [];
      this.lastWasClear = true;
      while (res.garbage.length > 0) {
        if (res.garbage[0] === 0) {
          res.garbage.shift();
          continue;
        }
        const [r, cancelled] = this.garbageQueue.cancel(
          res.garbage[0],
          this.stats.pieces,
          {
            openerPhase: (this.misc.date ?? /* @__PURE__ */ new Date()) < new Date(2025, 1, 16)
          }
        );
        for (let i = 0; i < cancelled.length; i++) {
          const c = cancelled[i];
          cancelEvents.push({
            iid: c.cid,
            amount: c.amount,
            size: c.size
          });
        }
        if (r === 0) res.garbage.shift();
        else {
          res.garbage[0] = r;
          break;
        }
      }
      for (let i = 0; i < cancelEvents.length; i++) {
        this.events.emit("garbage.cancel", cancelEvents[i]);
      }
    } else {
      this.lastWasClear = false;
      const garbages = this.garbageQueue.tank(
        this.frame,
        this.dynamic.garbageCap.get(),
        hard
      );
      res.garbageAdded = garbages;
      if (res.garbageAdded) {
        const tankEvent = [];
        for (let idx = 0; idx < garbages.length; idx++) {
          const garbage2 = garbages[idx];
          this.board.insertGarbage({
            ...garbage2,
            bombs: this.garbageQueue.options.bombs,
            isBeginning: idx === 0 || garbages[idx - 1].id !== garbage2.id,
            isEnd: idx === garbages.length - 1 || garbages[idx + 1].id !== garbage2.id
          });
          if (tankEvent.length === 0 || tankEvent[tankEvent.length - 1].iid !== garbage2.id) {
            tankEvent.push({
              iid: garbage2.id,
              column: garbage2.column,
              amount: garbage2.amount,
              size: garbage2.size
            });
          } else {
            tankEvent[tankEvent.length - 1].amount += garbage2.amount;
          }
        }
        for (let i = 0; i < tankEvent.length; i++) {
          this.events.emit("garbage.tank", tankEvent[i]);
        }
      }
    }
    this.events.emit("falling.lock.pre", void 0);
    this.nextPiece();
    this.lastSpin = null;
    try {
      if (!legal(this.falling.absoluteBlocks, this.board.state))
        res.topout = true;
    } catch {
      res.topout = true;
    }
    if (res.garbage.length > 0) {
      if (this.multiplayer) {
        for (let i = 0; i < this.multiplayer.targets.length; i++) {
          const target = this.multiplayer.targets[i];
          for (let j = 0; j < res.garbage.length; j++) {
            this.igeHandler.send({ amount: res.garbage[j], playerID: target });
          }
        }
      }
    }
    let sent = 0;
    for (let i = 0; i < res.garbage.length; i++) {
      sent += res.garbage[i];
    }
    this.stats.garbage.sent += sent;
    if (sent > 0) {
      this.spike.count += sent;
      this.spike.timer = 60;
    }
    this.resCache.pieces++;
    this.resCache.garbage.sent.push(...res.garbage);
    this.resCache.garbage.received.push(...res.garbageAdded || []);
    this.resCache.lastLock = this.frame + this.subframe;
    this.stats.pieces++;
    this.stats.lines += lines;
    this.events.emit("falling.lock", deepCopy(res));
    return res;
  }
  press(key) {
    if (key in this) return this[key]();
    else throw new Error("invalid key: " + key);
  }
  #keydown({ data: event }) {
    this.#processSubframe(event.subframe);
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;
    this.resCache.keys.push(event.key);
    switch (event.key) {
      case "moveLeft":
        this.falling.keys++;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#activateShift("lShift", !!event.hoisted);
        this.#__internal_shift();
        return;
      case "moveRight":
        this.falling.keys++;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#activateShift("rShift", !!event.hoisted);
        this.#__internal_shift();
        return;
      case "softDrop":
        this.input.keys.softDrop = true;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        return;
      // todo: handle exit key somehow?
      // case "exit":
      // 	return;
      case "retry":
        this.practice.retry = true;
        this.practice.retryIter = 0;
        return;
      case "undo":
        this.undo();
        return;
      case "redo":
        this.redo();
        return;
      case "rotateCCW":
        this.input.keys.rotateCCW = true;
        break;
      case "rotateCW":
        this.input.keys.rotateCW = true;
        break;
      case "rotate180":
        this.input.keys.rotate180 = true;
        break;
      case "hold":
        this.input.keys.hold = true;
        break;
    }
    switch (event.key) {
      case "rotateCCW":
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(-1);
        break;
      case "rotateCW":
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(1);
        break;
      case "rotate180":
        if (!this.misc.allowed.spin180) return;
        if (this.input.firstInputTime == -1)
          this.input.firstInputTime = this.frame + this.subframe;
        this.#processRotate(2);
        break;
      case "hardDrop":
        if (this.misc.allowed.hardDrop === false || this.falling.safeLock !== 0)
          return;
        this.hardDrop();
        return;
      case "hold":
        this.hold();
        return;
    }
  }
  #keyup({ data: event }) {
    this.#processSubframe(event.subframe);
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;
    switch (event.key) {
      case "moveLeft":
        this.input.lShift.held = false;
        this.input.lShift.das = 0;
        this.input.lastShift = this.input.rShift.held ? this.input.rShift.dir : this.input.lastShift;
        if (this.handling.cancel) {
          this.input.rShift.arr = this.handling.arr;
          this.input.rShift.das = 0;
        }
        break;
      case "moveRight":
        this.input.rShift.held = false;
        this.input.rShift.das = 0;
        this.input.lastShift = this.input.lShift.held ? this.input.lShift.dir : this.input.lastShift;
        if (this.handling.cancel) {
          this.input.lShift.arr = this.handling.arr;
          this.input.lShift.das = 0;
        }
        break;
      case "softDrop":
        this.state |= constants.flags.ACTION_SOFTDROP;
        this.input.keys.softDrop = false;
        break;
      // todo: handle exit key somehow?
      // case "exit":
      // 	return;
      case "retry":
        this.practice.retry = false;
        this.practice.retryIter = 0;
        return;
      case "rotateCCW":
        this.input.keys.rotateCCW = false;
        break;
      case "rotateCW":
        this.input.keys.rotateCW = false;
        break;
      case "rotate180":
        this.input.keys.rotate180 = false;
        break;
      case "hold":
        this.input.keys.hold = false;
        break;
    }
  }
  #activateShift(shift, hoisted) {
    this.input[shift].held = true;
    this.input[shift].das = hoisted ? this.handling.das - this.handling.dcd : 0;
    this.input[shift].arr = this.handling.arr;
    this.input.lastShift = this.input[shift].dir;
  }
  #processRotate(rotation) {
    this.falling.keys += rotation >= 2 ? 2 : 1;
    return this.#rotate(rotation);
  }
  #processSubframe(subframe) {
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;
    if (subframe <= this.subframe) return;
    const delta = subframe - this.subframe;
    this.#processAllShift(delta);
    this.#fall(delta);
    this.subframe = subframe;
  }
  #processInterrupts() {
    if (this.misc.allowed.retry && this.practice.retry) {
      if (this.misc.stride) return this.retry();
      const tick = this.practice.retryIter++;
      if (tick > 15) {
        this.retry();
      }
    }
  }
  #__internal_shift() {
    if (!this.#isSleep()) {
      this.state |= constants.flags.ACTION_MOVE;
      if (legal(
        this.falling.absoluteAt({
          x: this.falling.location[0] + this.input.lastShift
        }),
        this.board.state
      )) {
        this.falling.location[0] += this.input.lastShift;
        if (this.falling.lockResets < 31) this.falling.lockResets++;
        this.#clearFlags(
          constants.flags.ROTATION_ALL | constants.flags.STATE_WALL
        );
        if (this.#is20G()) this.#slamToFloor();
        if (!this.#shouldLock()) this.falling.locking = 0;
        return true;
      } else {
        this.state |= constants.flags.STATE_WALL;
        return false;
      }
    }
  }
  #processShift(shift, delta) {
    if (!this.input[shift].held || this.input.lastShift !== this.input[shift].dir)
      return;
    const arrDelta = Math.max(
      0,
      delta - Math.max(0, this.handling.das - this.input[shift].das)
    );
    this.input[shift].das = Math.min(
      this.input[shift].das + delta,
      this.handling.das
    );
    if (this.input[shift].das < this.handling.das) return;
    if (this.#isSleep()) return;
    this.input[shift].arr += arrDelta;
    if (this.input[shift].arr < this.handling.arr) return;
    const arrMultiplier = this.handling.arr === 0 ? this.board.width : Math.floor(this.input[shift].arr / this.handling.arr);
    this.input[shift].arr -= this.handling.arr * arrMultiplier;
    for (let i = 0; i < arrMultiplier; i++) this.#__internal_shift();
  }
  #processAllShift(subFrameDiff = 1 - this.subframe) {
    this.#processShift("lShift", subFrameDiff);
    this.#processShift("rShift", subFrameDiff);
  }
  #tickSpike() {
    if (this.spike.timer > 0) {
      this.spike.timer--;
      if (this.spike.timer === 0) this.spike.count = 0;
    }
  }
  #run(frames) {
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return;
    for (let i = 0; i < frames.length; i++) {
      if (this.spilinkHooks && !this.spilinkHooks.canTick()) break;
      const frame = frames[i];
      switch (frame.type) {
        case "keydown":
          this.#keydown(frame);
          break;
        case "keyup":
          this.#keyup(frame);
          break;
        case "ige":
          if (frame.data.type === "interaction") {
            if (frame.data.data.type === "garbage") {
              const original = frame.data.data.amt;
              const amount = this.multiplayer?.passthrough?.network ? this.igeHandler.receive({
                playerID: frame.data.data.gameid,
                ackiid: frame.data.data.ackiid,
                amount: frame.data.data.amt,
                iid: frame.data.data.iid
              }) : frame.data.data.amt;
              this.receiveGarbage({
                frame: Number.MAX_SAFE_INTEGER - this.garbageQueue.options.garbage.speed,
                amount,
                size: frame.data.data.size,
                cid: frame.data.data.iid,
                gameid: frame.data.data.gameid,
                confirmed: false
              });
              this.stats.garbage.receive += amount;
              this.events.emit("garbage.receive", {
                iid: frame.data.data.iid,
                amount,
                originalAmount: original
              });
            }
          } else if (frame.data.type === "interaction_confirm") {
            if (frame.data.data.type === "garbage") {
              this.garbageQueue.confirm(
                frame.data.data.iid,
                frame.data.data.gameid,
                frame.frame
              );
              this.events.emit("garbage.confirm", {
                iid: frame.data.data.iid,
                gameid: frame.data.data.gameid,
                frame: frame.frame
              });
            }
          } else if (frame.data.type === "target" && this.multiplayer) {
            this.multiplayer.targets = frame.data.data.targets;
          }
          break;
      }
    }
  }
  tick(frames) {
    this.subframe = 0;
    if (frames.length > 0) this.#run(frames);
    if (this.spilinkHooks && !this.spilinkHooks.canTick()) return this.#flushRes();
    this.frame++;
    this.#processAllShift();
    this.#fall();
    this.#processInterrupts();
    this.#tickSpike();
    this.dynamic.gravity.tick();
    this.dynamic.garbageMultiplier.tick();
    this.dynamic.garbageCap.tick();
    return this.#flushRes();
  }
  receiveGarbage(...garbage) {
    this.garbageQueue.receive(...garbage);
  }
  getPreview(piece) {
    return tetrominoes[piece.toLowerCase()].preview;
  }
  connect(blocks) {
    const exists = (x, y) => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block[0] === x && block[1] === y) return true;
      }
      return false;
    };
    const out = new Array(blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const x = blocks[i][0];
      const y = blocks[i][1];
      let state = 0;
      if (!exists(x, y - 1)) state |= 8 /* TOP */;
      if (!exists(x + 1, y)) state |= 4 /* RIGHT */;
      if (!exists(x, y + 1)) state |= 2 /* BOTTOM */;
      if (!exists(x - 1, y)) state |= 1 /* LEFT */;
      if (state === (8 /* TOP */ | 1 /* LEFT */) && !exists(x + 1, y + 1) || state === (8 /* TOP */ | 4 /* RIGHT */) && !exists(x - 1, y + 1) || state === (2 /* BOTTOM */ | 1 /* LEFT */) && !exists(x + 1, y - 1) || state === (2 /* BOTTOM */ | 4 /* RIGHT */) && !exists(x - 1, y - 1) || state === 2 /* BOTTOM */ && !exists(x + 1, y - 1) && !exists(x - 1, y - 1) || state === 1 /* LEFT */ && !exists(x + 1, y - 1) && !exists(x + 1, y + 1) || state === 8 /* TOP */ && !exists(x - 1, y + 1) && !exists(x + 1, y + 1) || state === 4 /* RIGHT */ && !exists(x - 1, y - 1) && !exists(x - 1, y + 1)) {
        state |= 16 /* CORNER */;
      }
      out[i] = [x, y, state];
    }
    return out;
  }
  getConnectedPreview(piece) {
    const data = tetrominoes[piece.toLowerCase()].preview;
    return {
      ...data,
      data: this.connect(data.data)
    };
  }
  /** @deprecated Engine.onQueuePieces is deprecated and no longer functional. Switch to Engine.events.on("queue.add", (pieces) => {}) instead. */
  onQueuePieces(_listener) {
    console.log(
      `${chalk_default.redBright("[Triangle.js]")} Engine.onQueuePieces is deprecated and no longer functional. Switch to Engine.events.on("queue.add", (pieces) => {}) instead.`
    );
  }
  get currentSpike() {
    return this.spike.count;
  }
  static colorMap = {
    ["i" /* I */]: chalk_default.bgCyan,
    ["j" /* J */]: chalk_default.bgBlue,
    ["l" /* L */]: chalk_default.bgYellow,
    ["o" /* O */]: chalk_default.bgWhite,
    ["s" /* S */]: chalk_default.bgGreenBright,
    ["t" /* T */]: chalk_default.bgMagentaBright,
    ["z" /* Z */]: chalk_default.bgRedBright,
    ["gb" /* GARBAGE */]: chalk_default.bgBlackBright,
    ["bomb" /* BOMB */]: chalk_default.bgHex("#FFA500")
  };
  get text() {
    const boardTop = this.board.state.findIndex(
      (row) => row.every((block) => block === null)
    );
    const height = Math.max(this.garbageQueue.size, boardTop, 0);
    const output = [];
    for (let i = 0; i < height; i++) {
      let str = i % 2 === 0 ? "|" : " ";
      if (i < this.garbageQueue.size) str += " " + chalk_default.bgRed(" ") + " ";
      else str += "   ";
      if (i > boardTop) {
        output.push(
          str + "  ".repeat(this.board.width) + " " + (i % 2 === 0 ? "|" : " ")
        );
        continue;
      }
      for (let j = 0; j < this.board.width; j++) {
        const block = this.board.state[i][j];
        str += block ? _Engine.colorMap[block.mino]("  ") : "  ";
      }
      output.push(str + " " + (i % 2 === 0 ? "|" : " "));
    }
    return output.reverse().join("\n");
  }
  /** Return an engine with the same config. Does not preserve state. */
  clone() {
    return new _Engine(this.initializer);
  }
};
export {
  Bag,
  Bag14,
  Bag7,
  Bag7Plus1,
  Bag7Plus2,
  Bag7PlusX,
  Board,
  BoardConnections,
  Classic,
  Engine,
  GarbageQueue,
  IGEHandler,
  IncreaseTracker,
  LegacyGarbageQueue,
  Mino,
  Pairs,
  Queue,
  RNG,
  Random,
  Tetromino,
  deepCopy,
  garbageCalcV2,
  garbageData,
  kicks as kickData,
  legal,
  performKick,
  polyfills,
  randomSeed,
  rngMap,
  tetrominoes
};
