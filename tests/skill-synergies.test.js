const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const updateCalls = [];

const context = {
  console,
  Math,
  Number,
  String,
  Array,
  Object,
  Set,
  JSON,
  isFinite,
  GameConfig: {
    skills: {
      splice: { cooldown: 7.6, duration: 0.5, moves: 1 },
      echo: { cooldown: 10.5, duration: 5.4, baseRepeat: 0.85 }
    },
    growth: { hitLoss: 1, fishBase: 1 },
    player: { invulnerableAfterHit: 0.8 },
    combat: { consumeSizeRatio: 1 },
    palette: {
      cyan: '#65e5ff',
      pink: '#ff6fa8',
      gold: '#ffd36f',
      danger: '#ff667c'
    }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    rand: (min, max) => (min + max) / 2,
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    },
    pick: (items) => items[0],
    depthAtY: () => 0,
    powerRadius: () => 20,
    storageSet: () => {}
  },
  GameState: { createParticle: () => ({}) },
  GameUI: {
    toast: () => {},
    showPowerSurge: () => {},
    showEvolution: () => {}
  },
  I18n: {
    locale: () => 'en',
    t: (key, fallback) => fallback
  },
  AudioSystem: { play: () => {} },
  GenomeSystem: {
    isLockedIndex: (genome, index) => (genome.lockedBlocks || []).some((block) => (
      index >= block.start && index < block.start + block.length
    )),
    letterScore: () => 1
  }
};
context.window = context;
vm.createContext(context);

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context);
}

function approx(actual, expected, message, epsilon = 1e-9) {
  assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
}

const skillIds = [
  'dash', 'shot', 'nova', 'guard', 'freeze',
  'scan', 'growth', 'splice', 'echo', 'corrode'
];
const globalNames = {
  dash: 'DashSkill',
  shot: 'ShotSkill',
  nova: 'NovaSkill',
  guard: 'GuardSkill',
  freeze: 'FreezeSkill',
  scan: 'ScanSkill',
  growth: 'GrowthSkill',
  splice: 'SpliceSkill',
  echo: 'EchoSkill',
  corrode: 'CorrodeSkill'
};

skillIds.forEach((id) => {
  context[globalNames[id]] = {
    tryStart: () => true,
    charge: () => 1,
    update: () => { updateCalls.push(id); }
  };
});

load('src/data/common-words.js');
load('src/data/skill-word-map.js');
load('src/systems/words.js');
load('src/systems/skills.js');

function createState(activeSlots = [null, null, null]) {
  return {
    paused: false,
    time: 10,
    dt: 0.1,
    growthPower: 5,
    damageTaken: false,
    uiDirty: false,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 20,
      basePower: 1,
      invulnerable: 0,
      activeSlots: activeSlots.slice()
    },
    skillInventory: {
      unlocked: new Set(skillIds),
      newlyUnlocked: []
    },
    skills: {
      dash: { cooldown: 1, active: false, boost: 1 },
      shot: { cooldown: 0, active: false },
      nova: { cooldown: 0, active: false },
      guard: { cooldown: 0, active: false },
      freeze: { cooldown: 0, active: false },
      scan: { cooldown: 0, active: false },
      growth: { cooldown: 0, active: false, charges: 0 },
      splice: { cooldown: 0, active: false },
      echo: {
        cooldown: 0,
        active: false,
        multiplier: 1,
        boost: 1,
        word: '',
        sourceMultiplier: 1,
        splicePrime: null
      },
      corrode: { cooldown: 0, active: false }
    },
    words: {
      unlocked: new Set(),
      occurrences: [],
      found: [],
      potentialOccurrences: [],
      potentialLogMultiplier: 0,
      potentialMultiplier: 1,
      logMultiplier: 0,
      multiplier: 1
    },
    genome: { letters: [], capacity: 20, lockedBlocks: [] },
    enemies: [],
    boss: { active: null, defeated: 0 },
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    recommendation: { dirty: false }
  };
}

// A synergy exists only while both required skills occupy active slots.
const equipmentState = createState();
assert.strictEqual(context.SkillSystem.equipAt(equipmentState, 'scan', 0), true);
assert.strictEqual(context.SkillSystem.hasSynergy(equipmentState, 'lockOn'), false);
assert.strictEqual(context.SkillSystem.equipAt(equipmentState, 'shot', 1), true);
assert.strictEqual(context.SkillSystem.hasSynergy(equipmentState, 'lockOn'), true);
assert.strictEqual(
  context.SkillSystem.activeSynergies(equipmentState).some((synergy) => synergy.id === 'lockOn'),
  true
);
context.SkillSystem.unequipAt(equipmentState, 0);
assert.strictEqual(context.SkillSystem.hasSynergy(equipmentState, 'lockOn'), false);

// Scan synergies must not reveal or amplify an unrevealed target implicitly.
const scanState = createState(['scan', 'shot', null]);
const hiddenTarget = { x: 20, y: 0, radius: 10, power: 100, revealed: 0 };
const revealedTarget = { x: 20, y: 0, radius: 10, power: 100, revealed: 1 };
const hiddenHit = context.SkillSystem.weakenTarget(scanState, 'shot', hiddenTarget, 0.2, 2);
const revealedHit = context.SkillSystem.weakenTarget(scanState, 'shot', revealedTarget, 0.2, 2);
approx(hiddenHit.weaken, 0.2, 'hidden target uses base Shot weaken');
approx(revealedHit.weaken, 0.2 * 1.28, 'revealed target receives Lock-On bonus');
assert.deepStrictEqual(Array.from(hiddenHit.synergies), []);
assert.deepStrictEqual(Array.from(revealedHit.synergies), ['lockOn']);
assert(revealedTarget.power < hiddenTarget.power);

// Freeze interactions require a live frozen state and consume part of it.
const shatterState = createState(['freeze', 'shot', null]);
const frozenTarget = { x: 20, y: 0, radius: 10, power: 100, frozen: 4 };
const thawedTarget = { x: 20, y: 0, radius: 10, power: 100, frozen: 0 };
const frozenHit = context.SkillSystem.weakenTarget(shatterState, 'shot', frozenTarget, 0.2, 2);
const thawedHit = context.SkillSystem.weakenTarget(shatterState, 'shot', thawedTarget, 0.2, 2);
approx(frozenHit.weaken, 0.2 * 1.35, 'frozen target receives Shatter bonus');
approx(frozenTarget.frozen, 4 * 0.3, 'Shatter consumes Freeze duration');
approx(thawedHit.weaken, 0.2, 'thawed target receives base Shot weaken');
assert.deepStrictEqual(Array.from(frozenHit.synergies), ['shatter']);
assert.deepStrictEqual(Array.from(thawedHit.synergies), []);

// Counterwave is inert without Guard, then affects only targets in range.
const noGuardState = createState(['nova', null, null]);
noGuardState.enemies = [{ x: 80, y: 0, radius: 10, power: 100 }];
assert.strictEqual(context.SkillSystem.onGuardAbsorbed(noGuardState), 0);
assert.strictEqual(noGuardState.enemies[0].power, 100);

const counterwaveState = createState(['guard', 'nova', null]);
counterwaveState.enemies = [
  { x: 80, y: 0, radius: 10, power: 100, attackState: 'charge', attackAge: 2, attackCooldown: 0 },
  { x: 320, y: 0, radius: 10, power: 100, attackState: 'charge', attackAge: 2, attackCooldown: 0 }
];
counterwaveState.boss.active = { x: 180, y: 0, radius: 30, power: 200, boss: true };
assert.strictEqual(context.SkillSystem.onGuardAbsorbed(counterwaveState), 2);
approx(counterwaveState.enemies[0].power, 84, 'Counterwave weakens a nearby enemy');
assert.strictEqual(counterwaveState.enemies[0].attackState, 'idle');
assert.strictEqual(counterwaveState.enemies[1].power, 100);
approx(counterwaveState.boss.active.power, 184, 'Counterwave weakens a nearby Boss');
assert.strictEqual(counterwaveState.shockwaves.length, 1);

// Feeding Rush needs an equipped, currently active Dash.
const feedingState = createState(['growth', 'dash', null]);
feedingState.skills.dash.active = false;
feedingState.skills.dash.cooldown = 1;
let growthResult = context.SkillSystem.modifyGrowthGain(feedingState, 10);
assert.deepStrictEqual({ amount: growthResult.amount, triggered: growthResult.triggered }, { amount: 10, triggered: false });
assert.strictEqual(feedingState.skills.dash.cooldown, 1);
feedingState.skills.dash.active = true;
growthResult = context.SkillSystem.modifyGrowthGain(feedingState, 10);
approx(growthResult.amount, 13.5, 'Feeding Rush boosts growth gain');
assert.strictEqual(growthResult.triggered, true);
approx(feedingState.skills.dash.cooldown, 0.65, 'Feeding Rush refunds Dash cooldown');

// Unequipping must end effects that otherwise outlive their inventory slot.
[
  {
    id: 'dash',
    seed: { active: true, boost: 1.8 },
    verify: (skill) => {
      assert.strictEqual(skill.active, false);
      assert.strictEqual(skill.boost, 1);
    }
  },
  {
    id: 'guard',
    seed: { active: true },
    verify: (skill) => { assert.strictEqual(skill.active, false); }
  },
  {
    id: 'growth',
    seed: { active: true, charges: 4 },
    verify: (skill) => {
      assert.strictEqual(skill.active, false);
      assert.strictEqual(skill.charges, 0);
    }
  },
  {
    id: 'echo',
    seed: {
      active: true,
      multiplier: 2.4,
      boost: 2.4,
      word: 'ware',
      sourceMultiplier: 2,
      splicePrime: { word: { text: 'ware', mult: 2 } }
    },
    verify: (skill) => {
      assert.strictEqual(skill.active, false);
      assert.strictEqual(skill.multiplier, 1);
      assert.strictEqual(skill.boost, 1);
      assert.strictEqual(skill.word, '');
      assert.strictEqual(skill.sourceMultiplier, 1);
      assert.strictEqual(skill.splicePrime, null);
    }
  }
].forEach((testCase) => {
  const state = createState([testCase.id, null, null]);
  Object.assign(state.skills[testCase.id], testCase.seed);
  assert.strictEqual(context.SkillSystem.unequipAt(state, 0), testCase.id);
  assert.strictEqual(state.player.activeSlots[0], null);
  testCase.verify(state.skills[testCase.id]);
});

// Variant potency counts every matching occurrence and ignores sibling variants.
const variantState = createState();
variantState.words.occurrences = [
  { word: { text: 'shot', family: 'shot', variant: 'bolt', affinity: 1.5 } },
  { word: { text: 'bolt', family: 'shot', variant: 'bolt', affinity: 1.5 } },
  { word: { text: 'bite', family: 'shot', variant: 'bite', affinity: 1.5 } },
  { word: { text: 'pulse', family: 'nova', variant: 'pulse', affinity: 1.5 } }
];
assert.strictEqual(context.SkillSystem.rawVariantPotency(variantState, 'shot', 'bolt'), 3);
assert.strictEqual(context.SkillSystem.variantPotency(variantState, 'shot', 'bolt'), 4);
assert.strictEqual(context.SkillSystem.rawVariantPotency(variantState, 'shot', 'bite'), 1.5);

// Registry updates all skills, while combat multipliers include equipped skills only.
updateCalls.length = 0;
context.SkillSystem.updateAll(createState());
assert.strictEqual(updateCalls.length, skillIds.length);
assert.deepStrictEqual(updateCalls.slice().sort(), skillIds.slice().sort());
context.DashSkill = { getPowerMultiplier: () => 2 };
context.ShotSkill = { getLogPowerMultiplier: () => Math.log(3) };
context.NovaSkill = { getPowerMultiplier: () => 99 };
const multiplierState = createState(['dash', 'shot', null]);
approx(context.SkillSystem.logPowerMultiplier(multiplierState), Math.log(6), 'temporary multipliers compose in log space');

// Use the real Splice and Echo APIs to verify the constructive synergy hook.
load('src/skills/splice.js');
load('src/skills/echo.js');

const originalPreview = context.WordSystem.preview;
const primedWord = { text: 'ware', mult: 2.2, family: 'echo', variant: 'word', affinity: 1.5 };
context.WordSystem.preview = (state) => {
  const changed = state.genome.letters.join('') === 'warex';
  state.words.potentialOccurrences = changed ? [{ word: primedWord, index: 0 }] : [];
  state.words.potentialLogMultiplier = changed ? Math.log(2.2) : 0;
  state.words.potentialMultiplier = changed ? 2.2 : 1;
};
const productiveSplice = createState(['splice', 'echo', null]);
productiveSplice.genome.letters = ['x', 'w', 'a', 'r', 'e'];
productiveSplice.words.potentialOccurrences = [];
productiveSplice.words.potentialLogMultiplier = 0;
assert.strictEqual(context.SpliceSkill.tryStart(productiveSplice), true);
assert(productiveSplice.skills.echo.splicePrime, 'productive Splice should prime Echo');
assert.strictEqual(productiveSplice.skills.echo.splicePrime.word.text, 'ware');

context.WordSystem.preview = (state) => {
  state.words.potentialOccurrences = [{ word: primedWord, index: 0 }];
  state.words.potentialLogMultiplier = Math.log(2.2);
  state.words.potentialMultiplier = 2.2;
};
const ineffectiveSplice = createState(['splice', 'echo', null]);
ineffectiveSplice.genome.letters = ['x', 'w', 'a', 'r', 'e'];
ineffectiveSplice.words.potentialOccurrences = [{ word: primedWord, index: 0 }];
ineffectiveSplice.words.potentialLogMultiplier = Math.log(2.2);
assert.strictEqual(context.SpliceSkill.tryStart(ineffectiveSplice), true);
assert.strictEqual(ineffectiveSplice.skills.echo.splicePrime, null);

productiveSplice.skills.splice.active = false;
productiveSplice.words.occurrences = [{ word: { text: 'current', mult: 5 } }];
assert.strictEqual(context.EchoSkill.tryStart(productiveSplice), true);
assert.strictEqual(productiveSplice.skills.echo.word, 'ware');
assert.strictEqual(productiveSplice.skills.echo.splicePrime, null);
assert(productiveSplice.skills.echo.duration > context.GameConfig.skills.echo.duration);
context.WordSystem.preview = originalPreview;

console.log(JSON.stringify({
  activeSynergies: context.SkillSystem.synergies.length,
  revealedShotWeaken: revealedHit.weaken,
  frozenAfterShatter: frozenTarget.frozen,
  counterwaveTargets: 2,
  feedingRushGain: growthResult.amount,
  boltVariantPotency: context.SkillSystem.variantPotency(variantState, 'shot', 'bolt'),
  registryUpdates: updateCalls.length,
  splicePrimeConsumedBy: productiveSplice.skills.echo.word
}, null, 2));
