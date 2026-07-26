const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const starts = [];
const updates = [];
const activeDuringUpdate = {};
let delayedEffectFired = false;

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
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    pick: (items) => items[0],
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    rand: (min, max) => (min + max) / 2
  },
  GameConfig: {
    skills: {
      shot: { cooldown: 0.8, speed: 500, life: 1, radius: 5, weaken: 0.2 },
      freeze: { cooldown: 4, duration: 2, radius: 180 }
    },
    palette: { mint: '#64f0b6', gold: '#ffd36f', cyan: '#65e5ff' }
  },
  GameState: { createParticle: () => ({}) },
  WordSystem: { byText: {}, all: [] },
  GameUI: { toast: () => {} },
  I18n: { locale: () => 'en', t: (_key, fallback) => fallback },
  AudioSystem: { play: () => {} }
};
context.window = context;

const skillIds = [
  'dash', 'shot', 'nova', 'guard', 'freeze',
  'scan', 'growth', 'splice', 'echo', 'corrode'
];

skillIds.forEach((id) => {
  const globalName = id.charAt(0).toUpperCase() + id.slice(1) + 'Skill';
  context[globalName] = {
    tryStart: () => { starts.push(id); return true; },
    update: () => { updates.push(id); },
    charge: () => 1
  };
});
context.ShotSkill.getPowerMultiplier = () => 2;

vm.createContext(context);

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
}

function occurrence(text, family) {
  return { index: 0, word: { text, family, skill: family, affinity: 1.5 } };
}

load('src/systems/skills.js');
load('src/systems/skill-effects.js');
load('src/skills/shot.js');
load('src/skills/freeze.js');

const realShotUpdate = context.ShotSkill.update;
context.ShotSkill.tryStart = () => { starts.push('shot'); return true; };
context.ShotSkill.update = (state) => {
  updates.push('shot');
  activeDuringUpdate.shot = !!state.skills.shot.active;
  return realShotUpdate(state);
};
context.ShotSkill.getPowerMultiplier = () => 2;
const realFreezeUpdate = context.FreezeSkill.update;
context.FreezeSkill.update = (state) => {
  updates.push('freeze');
  return realFreezeUpdate(state);
};

context.SkillEffects.register({
  id: 'shot.supported-passive',
  family: 'shot',
  requireTrait: false,
  hooks: {
    [context.SkillEffects.EVENTS.POWER_LOG_MULTIPLIER]: (event) => {
      event.log += Math.log(3);
    }
  }
});
context.SkillEffects.register({
  id: 'shot.scan-powered',
  family: 'shot',
  requireTrait: false,
  requires: { equipped: ['scan'] },
  hooks: {}
});

const shotWord = occurrence('shot', 'shot');
const scanWord = occurrence('scan', 'scan');
const growthWord = occurrence('growth', 'growth');
const state = {
  time: 0,
  dt: 0.2,
  paused: false,
  uiDirty: false,
  player: { x: 0, y: 0, angle: 0, radius: 20, activeSlots: [null, null, null] },
  input: { pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
  skillInventory: { unlocked: new Set(skillIds), newlyUnlocked: [] },
  words: {
    revision: 1,
    potentialOccurrences: [shotWord, scanWord],
    occurrences: [shotWord, scanWord]
  },
  skills: {},
  enemies: [],
  boss: { active: null },
  bullets: [],
  particles: [],
  floatingTexts: []
};
skillIds.forEach((id) => {
  state.skills[id] = { cooldown: 0, active: false };
});
state.skills.shot.cooldown = 4;
state.skills.shot.target = { id: 'old-target' };

assert.strictEqual(context.SkillSystem.isSupported(state, 'shot'), true);
assert.strictEqual(context.SkillSystem.equipAt(state, 'shot', 0), true);
assert.strictEqual(context.SkillSystem.equipAt(state, 'scan', 1), true);
assert.strictEqual(context.SkillSystem.equipAt(state, 'dash', 2), false, 'an unlocked but unsupported skill cannot be equipped');
assert.strictEqual(context.SkillSystem.hasSynergy(state, 'lockOn'), true);
assert.strictEqual(context.SkillSystem.activate(state, 'shot'), true);
assert.deepStrictEqual(starts, ['shot']);
assert(context.SkillEffects.has(state, 'shot.supported-passive'));
assert(context.SkillEffects.has(state, 'shot.scan-powered'));
assert(Math.abs(context.SkillSystem.logPowerMultiplier(state) - Math.log(6)) < 1e-9);

const passive = context.SkillEffects.get(state, 'shot.supported-passive');
passive.schedule(0.1, () => { delayedEffectFired = true; });
const expiringBullet = {
  x: 0,
  y: 0,
  vx: 10,
  vy: 0,
  radius: 3,
  life: 0.1,
  maxLife: 0.1,
  weaken: 0.2,
  weaknessDuration: 1,
  color: '#64f0b6',
  hitIds: Object.create(null)
};
const frozenEnemy = { id: 'frozen-target', x: 1000, y: 0, vx: 10, vy: 0, radius: 10, frozen: 1 };
state.bullets.push(expiringBullet);
state.enemies.push(frozenEnemy);
state.skills.freeze.cooldown = 1;
state.skills.shot.active = true;
state.words.potentialOccurrences = [scanWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
updates.length = 0;
context.SkillSystem.updateAll(state);

assert.strictEqual(context.SkillSystem.isSupported(state, 'shot'), false);
assert.strictEqual(state.player.activeSlots[0], 'shot', 'the unpowered skill keeps its equipped slot');
assert.strictEqual(state.skills.shot.active, false, 'losing support ends an active skill');
assert.strictEqual(state.skills.shot.target, null, 'losing support clears transient targets');
assert(Math.abs(state.skills.shot.cooldown - 3.8) < 1e-9, 'unsupported skills still advance normal cooldown housekeeping');
assert.strictEqual(delayedEffectFired, false, 'owned delayed effects are cancelled when support is lost');
assert.strictEqual(updates.includes('shot'), true, 'unsupported Shot still performs projectile housekeeping');
assert.strictEqual(activeDuringUpdate.shot, false, 'transient active state is cleared before housekeeping runs');
assert.strictEqual(expiringBullet.x, 2, 'an existing unsupported Shot projectile still advances');
assert.strictEqual(state.bullets.includes(expiringBullet), false, 'an existing unsupported Shot projectile still expires');
assert.strictEqual(context.SkillSystem.isSupported(state, 'freeze'), false);
assert(Math.abs(frozenEnemy.frozen - 0.8) < 1e-9, 'Freeze housekeeping decays status even without a Freeze word');
assert(Math.abs(state.skills.freeze.cooldown - 0.8) < 1e-9, 'unsupported Freeze cooldown still advances');
assert.strictEqual(context.SkillSystem.activate(state, 'shot'), false, 'an equipped but unsupported skill cannot activate');
assert.strictEqual(context.SkillSystem.hasSynergy(state, 'lockOn'), false, 'an unsupported skill cannot complete a synergy');
assert.strictEqual(context.SkillEffects.has(state, 'shot.supported-passive'), false, 'passive effects turn off with their source word');
assert.strictEqual(context.SkillSystem.logPowerMultiplier(state), 0, 'unsupported skills contribute no combat multiplier');

state.words.potentialOccurrences = [shotWord, scanWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
context.SkillSystem.updateAll(state);

assert.strictEqual(state.player.activeSlots[0], 'shot');
assert.strictEqual(context.SkillSystem.isSupported(state, 'shot'), true);
assert.strictEqual(context.SkillSystem.activate(state, 'shot'), true, 'the equipped skill automatically works when its word returns');
assert.strictEqual(context.SkillSystem.hasSynergy(state, 'lockOn'), true);
assert.strictEqual(context.SkillEffects.has(state, 'shot.supported-passive'), true);
assert(Math.abs(context.SkillSystem.logPowerMultiplier(state) - Math.log(6)) < 1e-9);

state.words.potentialOccurrences = [shotWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
assert.strictEqual(context.SkillEffects.isEquipped(state, 'scan'), true, 'the registry keeps pure slot occupancy available');
assert.strictEqual(context.SkillEffects.isPowered(state, 'scan'), false);
assert.strictEqual(context.SkillEffects.has(state, 'shot.supported-passive'), true);
assert.strictEqual(context.SkillEffects.has(state, 'shot.scan-powered'), false, 'requires.equipped also requires live support');

state.words.potentialOccurrences = [shotWord, growthWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
assert.strictEqual(context.SkillSystem.equipAt(state, 'growth', 2), true);
state.skills.growth.active = true;
state.skills.growth.charges = 1;
state.skills.growth.moltPending = true;
state.words.potentialOccurrences = [shotWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
context.SkillSystem.updateAll(state);
assert.strictEqual(state.player.activeSlots[2], 'growth', 'unpowered Growth keeps its equipped slot');
assert.strictEqual(state.skills.growth.active, false);
assert.strictEqual(state.skills.growth.charges, 0);
assert.strictEqual(state.skills.growth.moltPending, false, 'losing Growth support clears a queued Molt Pulse');

state.words.potentialOccurrences = [shotWord, growthWord];
state.words.revision += 1;
context.SkillEffects.invalidate(state);
context.SkillSystem.updateAll(state);
assert.strictEqual(state.skills.growth.moltPending, false, 'restoring Growth support cannot revive the stale pulse');

console.log(JSON.stringify({
  slotPreserved: state.player.activeSlots[0],
  cooldownPreserved: state.skills.shot.cooldown,
  delayedEffectFired,
  restoredActivationCount: starts.length
}, null, 2));
