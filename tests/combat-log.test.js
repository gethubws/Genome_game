const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console,
  Math,
  Number,
  Set,
  GameConfig: {
    combat: { consumeSizeRatio: 0.96 },
    growth: { fishBase: 0.6, hitLoss: 0.8 },
    player: { invulnerableAfterHit: 0.8 },
    palette: { gold: '#ffd36f', mint: '#64f0b6', danger: '#ff7868' }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    powerRadius: (power) => 16 + Math.log2(1 + power) * 3.6,
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    },
    depthAtY: () => 0
  },
  GenomeSystem: {
    letterScore: () => 10,
    rollDropLetter: () => 'a',
    addLetter: () => {},
    removeFrontFactors: () => [],
    lockCurrentWordBlock: () => null,
    expandCapacity: () => {}
  },
  ShotSkill: { burst: () => {} },
  GrowthSkill: { modifyGrowthGain: (state, amount, enemy) => {
    state.growthCalls = (state.growthCalls || 0) + 1;
    return amount * 3;
  } },
  EchoSkill: { getPowerMultiplier: () => 4 },
  AudioSystem: { play: () => {} },
  GameUI: {
    showPowerSurge: () => {},
    toast: () => {},
    showEvolution: () => {}
  },
  MapSystem: {
    claimRewardSite: () => {},
    markBossDefeated: () => null,
    nextBossDepth: () => 0
  },
  EnemySystem: { removeEnemy: (state, enemy) => {
    state.enemies = state.enemies.filter((candidate) => candidate !== enemy);
  } },
  SkillSystem: { rewardWord: () => ({ text: 'are', mult: 1.1 }) },
  WordSystem: { express: () => {}, randomRewardWord: () => ({ text: 'are', mult: 1.1 }) },
  ImageSystem: { generateClearImage: () => {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/combat.js'), 'utf8'), context);

function createState(overrides = {}) {
  const state = {
    dt: 0.1,
    time: 0,
    tick: 0,
    paused: false,
    runOver: false,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      basePower: 1,
      invulnerable: 0,
      radius: 20
    },
    skills: {
      dash: { active: false, age: 0, duration: 0.5, boost: 1 },
      guard: { active: false }
    },
    growthPower: 3,
    genome: { letters: [], lockedBlocks: [], capacity: 20, maxLockedBlocks: 2 },
    words: {
      multiplier: 1,
      logMultiplier: 0,
      potentialMultiplier: 3,
      potentialLogMultiplier: Math.log(3),
      found: [],
      occurrences: []
    },
    enemies: [],
    boss: { active: null, defeated: 0, depth: 300 },
    shockwaves: [],
    floatingTexts: [],
    damageTaken: false,
    uiDirty: false
  };
  return Object.assign(state, overrides);
}

// The ordinary finite formula remains exact while its log representation is
// used for the actual calculation.
const state = createState();
const expectedSettled = (10 + 1) * 3 + 3;
assert(Math.abs(context.CombatSystem.settledPower(state) - expectedSettled) < 1e-10);
assert(Math.abs(Math.exp(context.CombatSystem.settledLogPower(state)) - expectedSettled) < 1e-10);
const fallbackState = createState({
  words: { multiplier: 1, logMultiplier: 0, found: [], occurrences: [] }
});
assert(Math.abs(context.CombatSystem.settledPower(fallbackState) - ((10 + 1) * 1 + 3)) < 1e-10);
state.skills.dash.boost = 1.5;
assert(Math.abs(context.CombatSystem.effectivePower(state) - expectedSettled * 1.5 * 4) < 1e-10);
assert(Math.abs(Math.exp(context.CombatSystem.effectiveLogPower(state)) - context.CombatSystem.effectivePower(state)) < 1e-10);

// A multiplier far beyond Number.MAX_VALUE must stay comparable and
// format-able without producing NaN or an unusable fixed-point string.
const huge = createState({
  growthPower: 0,
  words: {
    multiplier: Number.MAX_VALUE,
    logMultiplier: Math.log(Number.MAX_VALUE),
    potentialMultiplier: Number.MAX_VALUE,
    potentialLogMultiplier: 1000,
    found: [],
    occurrences: []
  }
});
assert.strictEqual(context.CombatSystem.settledPower(huge), Number.MAX_VALUE);
assert(Number.isFinite(context.CombatSystem.settledLogPower(huge)));
assert(/e\+434$/.test(context.CombatSystem.formatPower(Number.MAX_VALUE, 1000)));

// Growth modifies the gain before it enters the additive growth reserve.
const growthState = createState({ growthPower: 0 });
growthState.enemies.push({
  x: 0,
  y: 0,
  radius: 1,
  power: 1,
  dropType: 'growth',
  growthValue: 2,
  consumed: false,
  chargeScale: 1,
  chargeBoost: 1
});
context.CombatSystem.update(growthState);
assert.strictEqual(growthState.growthCalls, 1);
assert.strictEqual(growthState.growthPower, 6);

// Echo is included in effective power but not settled power.
const echoState = createState();
const settledLog = context.CombatSystem.settledLogPower(echoState);
const effectiveLog = context.CombatSystem.effectiveLogPower(echoState);
assert(Math.abs(effectiveLog - settledLog - Math.log(4)) < 1e-10);
assert(Math.abs(
  context.CombatSystem.visualRadius(echoState) -
  context.Utils.powerRadius(context.CombatSystem.effectivePower(echoState))
) < 1e-10);

console.log('combat log tests passed');
