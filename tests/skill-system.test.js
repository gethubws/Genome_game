const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
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
    pick: (items) => items[0],
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    }
  },
  GameConfig: {
    skills: {
      scan: { cooldown: 4.8, duration: 0.82, radius: 350, revealTime: 2 },
      dash: { cooldown: 3.2, duration: 0.46, speed: 540, maxBoost: 1.85 },
      shot: { cooldown: 0.82, speed: 560, life: 1.15, radius: 5, weaken: 0.32 }
    },
    palette: { cyan: '#65e5ff', gold: '#ffd36f', mint: '#64f0b6' }
  },
  GameState: { createParticle: () => ({}) },
  GameUI: { toast: () => {} },
  I18n: { locale: () => 'zh-CN' },
  AudioSystem: { play: () => {} }
};
context.window = context;
vm.createContext(context);

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context);
}

load('src/data/common-words.js');
load('src/data/skill-word-map.js');
load('src/systems/words.js');

['Dash', 'Shot', 'Nova', 'Guard', 'Freeze', 'Scan', 'Growth', 'Splice', 'Echo', 'Corrode'].forEach((name) => {
  context[name + 'Skill'] = { tryStart: () => true, charge: () => 1 };
});
load('src/systems/skills.js');

const skillIds = context.SkillSystem.definitions.map((definition) => definition.id);
assert.deepStrictEqual(Array.from(skillIds), [
  'dash', 'shot', 'nova', 'guard', 'freeze',
  'scan', 'growth', 'splice', 'echo', 'corrode'
]);

const mappedWords = context.WordSystem.all.filter((word) => word.family);
assert(mappedWords.length >= 2000, 'at least 2000 words should map to a skill family');
skillIds.forEach((id) => {
  const coreWord = context.WordSystem.byText[id];
  assert(coreWord, `missing core skill word: ${id}`);
  assert.strictEqual(coreWord.family, id);
  assert.strictEqual(coreWord.skill, id);
  assert.strictEqual(coreWord.variant, 'core');
  assert.strictEqual(coreWord.affinity, 1.65);
});
assert.strictEqual(context.WordSystem.byText.echo.family, 'echo');
assert.strictEqual(context.WordSystem.byText.echo.variant, 'core');
assert.strictEqual(context.WordSystem.byText.echo.affinity, 1.65);

const echoWord = context.WordSystem.byText.echo;
const dashWord = context.WordSystem.byText.dash;
const potencyState = {
  words: {
    unlocked: new Set(['echo']),
    occurrences: [{ word: echoWord }],
    potentialOccurrences: [{ word: dashWord }]
  },
  skillInventory: { unlocked: new Set(), newlyUnlocked: [] },
  player: { activeSlots: [] },
  skills: {},
  uiDirty: false
};
context.SkillSystem.refreshUnlocks(potencyState);
assert.strictEqual(potencyState.skillInventory.unlocked.has('echo'), true);
assert.strictEqual(potencyState.skillInventory.unlocked.has('dash'), false);
assert.strictEqual(context.SkillSystem.rawPotency(potencyState, 'echo'), 1.65);
assert.strictEqual(context.SkillSystem.rawPotency(potencyState, 'dash'), 0);
assert.strictEqual(context.SkillSystem.rawPotency(potencyState, 'dash', 'potential'), 1.65);
assert.strictEqual(context.SkillSystem.localizedName(context.SkillSystem.byId.echo), '回响');

load('src/skills/scan.js');
load('src/skills/dash.js');
load('src/skills/shot.js');

const expressedDashState = {
  paused: false,
  words: { occurrences: [{ word: dashWord }], unlocked: new Set(['dash']) },
  player: { x: 0, y: 0, angle: 0, radius: 20, visualFlags: { dashSkill: true } },
  input: { keys: {}, pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
  skills: {
    dash: { cooldown: 0, active: false, boost: 1, direction: { x: 0, y: 1 } },
    scan: { cooldown: 0, active: false, hits: new Set() },
    shot: { cooldown: 0 }
  },
  particles: [],
  bullets: [],
  enemies: [],
  boss: { active: null }
};
const dashPotency = context.SkillSystem.potency(expressedDashState, 'dash');
assert(dashPotency > 0);
assert.strictEqual(context.DashSkill.tryStart(expressedDashState), true);
assert(expressedDashState.skills.dash.duration > context.GameConfig.skills.dash.duration);

// The dispatcher must work with the real Shot API. Shot historically exposed
// `tryFire` while the other skills used `tryStart`; both names are supported
// so an equipped Shot cannot crash the input handler after a Boss reward.
const shotActivationState = {
  paused: false,
  skillInventory: { unlocked: new Set(['shot']) },
  player: { activeSlots: ['shot'], x: 0, y: 0, angle: 0, radius: 20 },
  input: { pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
  words: { occurrences: [{ word: context.WordSystem.byText.shot }], unlocked: new Set(['shot']) },
  skills: { shot: { cooldown: 0 } },
  bullets: [],
  particles: []
};
assert.doesNotThrow(() => context.SkillSystem.activate(shotActivationState, 'shot'));
assert.strictEqual(shotActivationState.bullets.length, 1);

const originalShotApi = context.ShotSkill;
let legacyTryFireCalled = false;
context.ShotSkill = {
  tryFire: () => { legacyTryFireCalled = true; return true; },
  charge: () => 1
};
assert.strictEqual(context.SkillSystem.activate(shotActivationState, 'shot'), true);
assert.strictEqual(legacyTryFireCalled, true);
context.ShotSkill = originalShotApi;

console.log(JSON.stringify({
  skillFamilies: skillIds.length,
  mappedWords: mappedWords.length,
  echoAffinity: echoWord.affinity,
  dashPotency,
  dashDuration: expressedDashState.skills.dash.duration
}, null, 2));
