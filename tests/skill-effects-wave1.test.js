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
  GameConfig: {
    maxGenomeCapacity: 40,
    width: 960,
    height: 640,
    initialGenomeCapacity: 8,
    skills: {
      dash: { duration: 0.5, maxBoost: 1.4, speed: 100, cooldown: 2 },
      shot: { speed: 180, radius: 5, life: 1.5, cooldown: 0.5, weaken: 0.2 },
      nova: { radius: 120, weaken: 0.2, cooldown: 4 },
      guard: { duration: 0.8, cooldown: 5 },
      freeze: { radius: 120, duration: 2, cooldown: 4 },
      scan: { radius: 180, duration: 0.5, revealTime: 3, cooldown: 3 },
      growth: { duration: 4, charges: 3, multiplier: 1.5, cooldown: 8 },
      splice: { duration: 0.5, moves: 1, cooldown: 7 },
      echo: { duration: 5, baseRepeat: 0.8, cooldown: 9 },
      corrode: { duration: 3, cooldown: 5, weaken: 0.25, range: 400 }
    },
    growth: { hitLoss: 1, fishBase: 1, fishPerLayer: 0.5 },
    player: { invulnerableAfterHit: 0.5, startRadius: 20, basePower: 2 },
    combat: { consumeSizeRatio: 1 },
    palette: { cyan: '#65e5ff', pink: '#ff6fa8', gold: '#ffd36f', danger: '#ff667c', mint: '#64f0b6', orange: '#ff8a38' }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    rand: (min, max) => (min + max) / 2,
    normalize: (x, y) => { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; },
    pick: (items) => items[0],
    randInt: (min) => min,
    depthAtY: () => 0,
    powerRadius: () => 20,
    letterValue: () => 1,
    storageSet: () => {}
  },
  GameState: { createParticle: () => ({}) },
  GameUI: { toast: () => {}, showPowerSurge: () => {}, showEvolution: () => {} },
  I18n: { locale: () => 'en', t: (_key, fallback) => fallback },
  AudioSystem: { play: () => {} },
  MapSystem: { nextBossDepth: () => 100, markBossDefeated: () => null },
  RecommendationSystem: { update: () => {} },
  EnemySystem: {
    removeEnemy: (state, enemy) => {
      state.enemies = state.enemies.filter((candidate) => candidate !== enemy);
      if (state.boss.active === enemy) state.boss.active = null;
    }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

load('src/data/common-words.js');
load('src/data/skill-word-map.js');
load('src/systems/words.js');
load('src/systems/genome.js');
load('src/skills/scan.js');
load('src/skills/dash.js');
load('src/skills/shot.js');
load('src/skills/nova.js');
load('src/skills/guard.js');
load('src/skills/freeze.js');
load('src/skills/growth.js');
load('src/skills/splice.js');
load('src/skills/echo.js');
load('src/skills/corrode.js');
load('src/systems/skills.js');
load('src/systems/skill-effects.js');
load('src/skills/effects-wave1.js');
load('src/systems/combat.js');

const allSkillIds = ['dash', 'shot', 'nova', 'guard', 'freeze', 'scan', 'growth', 'splice', 'echo', 'corrode'];

function word(text, family, traits = [], affinity = 1.5) {
  return { text, family, skill: family, variant: traits.length ? traits[0] : 'base', traits, affinity };
}

function createState(activeSlots, occurrences) {
  const state = {
    time: 10,
    dt: 0.1,
    paused: false,
    growthPower: 0,
    damageTaken: false,
    player: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, radius: 20, activeSlots: activeSlots.slice(), invulnerable: 0 },
    input: { keys: {}, pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
    skillInventory: { unlocked: new Set(allSkillIds), newlyUnlocked: [] },
    skills: {
      dash: { cooldown: 0, active: false, age: 0, direction: { x: 1, y: 0 }, boost: 1, duration: 0.5, maxBoost: 1.4, speed: 100 },
      shot: { cooldown: 0 },
      nova: { cooldown: 0, active: false, age: 0, radius: 0, weaken: 0.2 },
      guard: { cooldown: 2, active: true, age: 0.1, duration: 0.8, absorbed: false },
      freeze: { cooldown: 0, lastRadius: 120, lastDuration: 2 },
      scan: { cooldown: 0, active: false, age: 0, hits: new Set(), radius: 180, revealTime: 3 },
      growth: { cooldown: 0, active: true, age: 0, duration: 4, charges: 3, multiplier: 1.5, totalBonus: 0 },
      splice: { cooldown: 2, active: false, age: 0, duration: 0.5, movedCount: 0, lastSequence: '' },
      echo: { cooldown: 0, active: true, age: 0, duration: 5, multiplier: 1.5, boost: 1.5, word: 'word', sourceMultiplier: 1.5, splicePrime: null },
      corrode: { cooldown: 0, active: false, age: 0, duration: 0.5, effectDuration: 3, target: null, weaken: 0.25 }
    },
    words: { revision: 1, potentialOccurrences: occurrences.slice(), occurrences: occurrences.slice(), found: [], unlocked: new Set(), potentialFound: [], potentialLogMultiplier: 0, potentialMultiplier: 1, multiplier: 1, logMultiplier: 0 },
    genome: { letters: 'abcd'.split(''), capacity: 12, lockedBlocks: [] },
    enemies: [],
    boss: { active: null, defeated: 0 },
    bullets: [],
    enemyBullets: [],
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    map: { currentLayer: 1 }
  };
  return state;
}

function activeIds(state) {
  return context.SkillEffects.active(state).map((entry) => entry.id);
}

// Dash: base undertow and semantic burst branch both compile from the same
// family without limiting overlapping word occurrences.
let state = createState(['dash', null, null], [word('flow', 'dash', []), word('dash', 'dash', ['burst'])]);
state.skills.dash.active = true;
state.skills.dash.direction = { x: 1, y: 0 };
state.enemies = [{ id: 'prey', kind: 'growth', x: -70, y: 20, vx: 0, vy: 0, radius: 10 }];
context.SkillEffects.emit(state, 'dash:update', { skill: state.skills.dash });
assert(state.enemies[0].vx > 0, 'Undertow pulls prey toward the player');
assert(activeIds(state).includes('dash.vector-bend'));
state.input.keys.d = true;
state.skills.dash.redirectsLeft = 1;
assert.strictEqual(context.DashSkill.tryStart(state), true);
assert.strictEqual(state.skills.dash.redirectsLeft, 0);

// Shot: piercing keeps the bullet alive for one extra target, while the
// interruptor adds a real punish window to an attack in progress.
state = createState(['shot', null, null], [word('bolt', 'shot', ['bolt']), word('hunt', 'shot', [])]);
let bullet = { weaken: 0.3, vx: 100, vy: 0, piercesLeft: 0, hitIds: Object.create(null) };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_PREPARE, { id: 'shot', bullet });
assert.strictEqual(bullet.piercesLeft, 1);
const target = { id: 'enemy', power: 100, originalPower: 100, attackState: 'windup', attackAge: 0.4, attackCooldown: 0, x: 20, y: 0, radius: 10 };
let hit = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_HIT, { id: 'shot', bullet, target, weaken: bullet.weaken, duration: 1, consume: true });
assert.strictEqual(hit.consume, false);
assert.strictEqual(target.attackState, 'idle');

// Nova's second beat is delayed and does not recursively schedule a third.
state = createState(['nova', null, null], [word('nova', 'nova', ['nova'])]);
const novaTarget = { id: 'nova-target', x: 50, y: 0, radius: 10, power: 100, originalPower: 100, frozen: 0, revealed: 0 };
state.enemies = [novaTarget];
context.NovaSkill.tryStart(state);
const afterFirst = novaTarget.power;
context.SkillEffects.update(state, 0.6);
assert(novaTarget.power < afterFirst, 'Double Beat applies a second weakening pulse');

// Guard / Freeze / Scan hooks.
state = createState(['guard', null, null], [word('guard', 'guard', ['guard'])]);
const attacker = { id: 'attacker', x: 30, y: 0, radius: 10, power: 100, originalPower: 100, attackState: 'charge', attackAge: 0.2, attackCooldown: 0 };
context.SkillSystem.onGuardAbsorbed(state, attacker, { kind: 'test' });
assert.strictEqual(attacker.attackState, 'idle');
assert(state.skills.guard.cooldown < 2);

state = createState(['freeze', null, null], [word('slow', 'freeze', ['slow'])]);
const frozen = { frozen: 1, weaknessTimer: 2, corrodeTimer: 3 };
let statusTickCount = 0;
context.SkillEffects.register({
  id: 'test.status-counter', requireTrait: false,
  hooks: { 'status:tick': () => { statusTickCount += 1; } }
});
context.CorrodeSkill.update(state);
const tick = context.SkillSystem.tickTargetStatuses(state, frozen);
assert.strictEqual(tick.pauseWeakness, true);
assert.strictEqual(tick.pauseCorrode, true);
assert.strictEqual(statusTickCount, 1, 'each target emits one status tick per frame');
assert.strictEqual(frozen.weaknessTimer, 2);
assert.strictEqual(frozen.corrodeTimer, 3);
context.SkillEffects.unregister('test.status-counter');

state = createState(['scan', null, null], [word('sense', 'scan', [])]);
const marked = { x: 10, y: 0, radius: 10, power: 100, revealed: 1, weaknessTimer: 0 };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, { target: marked });
const weak = context.SkillSystem.weakenTarget(state, 'shot', marked, 0.2, 1);
assert(Math.abs(weak.weaken - 0.232) < 1e-9, 'Weakpoint Matrix amplifies one weakening hit');
assert.strictEqual(marked.weakpointReady, false);

// Growth chain and metabolic cycle.
state = createState(['growth', 'shot', null], [
  word('feed', 'growth', ['feed']),
  word('plain', 'growth', []),
  word('bolt', 'shot', [])
]);
state.skills.shot.cooldown = 2;
const firstGain = context.GrowthSkill.modifyGrowthGain(state, 1, { dropType: 'growth' });
const secondGain = context.GrowthSkill.modifyGrowthGain(state, 1, { dropType: 'growth' });
assert(secondGain > firstGain, 'Feast Chain escalates consecutive growth catches');
assert(state.skills.shot.cooldown < 2, 'Metabolic Cycle refunds the longest powered cooldown');

state = createState(['growth', 'shot', 'nova'], [
  word('plain', 'growth', []),
  word('wave', 'nova', [])
]);
state.skills.shot.cooldown = 10;
state.skills.nova.cooldown = 5;
context.GrowthSkill.modifyGrowthGain(state, 1, { dropType: 'growth' });
assert.strictEqual(state.skills.shot.cooldown, 10, 'Metabolic Cycle skips a slotted Shot with no live support');
assert(state.skills.nova.cooldown < 5, 'Metabolic Cycle redirects its refund to the slowest powered skill');

// Splice hooks are event-driven, so they can be tested independently of the
// full genome animation.
state = createState(['splice', null, null], [word('copy', 'splice', ['copy']), word('plain', 'splice', [])]);
let copied = '';
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved', moved: ['z'], beforeLog: 0, afterLog: 1,
  copyLetter: (letter) => { copied = letter; return true; }
});
assert.strictEqual(copied, 'z');

const spliceRuntimeState = createState(['splice', null, null], []);
spliceRuntimeState.genome.letters = 'copyx'.split('');
spliceRuntimeState.skills.splice.cooldown = 0;
context.WordSystem.preview(spliceRuntimeState);
assert.strictEqual(context.SpliceSkill.tryStart(spliceRuntimeState), true);
assert.strictEqual(spliceRuntimeState.genome.letters.slice(-2).join(''), 'oo', 'Template Copy remains armed while Splice mutates its source word');

// Echo schedules both a skill refrain and a partial harvest replay.
state = createState(['echo', null, null], [word('repeat', 'echo', ['repeat']), word('plain', 'echo', [])]);
state.skills.echo.active = true;
state.bullets.push({ x: 0, y: 0, vx: 100, vy: 0, weaken: 0.4, life: 1, maxLife: 1, radius: 4, color: '#fff' });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'echo', skill: state.skills.echo });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'shot', skill: state.skills.shot || {} });
const beforeBullets = state.bullets.length;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.ENEMY_CONSUMED, { enemy: { dropType: 'growth' }, gain: 2, letter: null, isBoss: false, dropType: 'growth' });
context.SkillEffects.update(state, 0.9);
assert(state.bullets.length > beforeBullets, 'Skill Refrain replays the next skill');
assert(state.growthPower > 0, 'Harvest Echo replays part of a growth reward');

state = createState(['echo', 'dash', null], [word('repeat', 'echo', ['repeat']), word('dash', 'dash', ['burst'])]);
state.skills.echo.active = true;
state.skills.dash.active = true;
state.skills.dash.age = 0;
state.skills.dash.duration = 0.5;
state.skills.dash.maxBoost = 1.8;
state.skills.dash.speed = 500;
state.skills.dash.direction = { x: 1, y: 0 };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'echo', skill: state.skills.echo });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'dash', skill: state.skills.dash });
state.skills.dash.active = false;
context.SkillEffects.update(state, 0.8);
assert.strictEqual(state.skills.dash.active, true, 'Dash refrain starts a reduced second dash after the original ends');
assert(state.skills.dash.duration > 0 && state.skills.dash.duration < 0.5);
assert.strictEqual(state.skills.dash.direction.x, 1);
assert.strictEqual(state.skills.dash.direction.y, 0);

state = createState(['echo', 'corrode', null], [word('repeat', 'echo', ['repeat']), word('drain', 'corrode', ['drain'])]);
state.skills.echo.active = true;
const staleCorrodeTarget = { id: 'stale', x: 20, y: 0, radius: 10, power: 100, originalPower: 100, corrodeTimer: 3, corrodeFactor: 0.25, consumed: false };
state.skills.corrode.target = staleCorrodeTarget;
state.skills.corrode.weaken = 0.25;
state.skills.corrode.effectDuration = 3;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'echo', skill: state.skills.echo });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'corrode', skill: state.skills.corrode });
staleCorrodeTarget.consumed = true;
context.SkillEffects.update(state, 0.8);
assert.strictEqual(staleCorrodeTarget.power, 100, 'Corrode refrain ignores a consumed target');
assert.strictEqual(state.growthPower, 0, 'stale Corrode replay cannot create phantom Power Drain reserve');

state = createState(['echo', 'corrode', null], [word('repeat', 'echo', ['repeat']), word('drain', 'corrode', ['drain'])]);
state.skills.echo.active = true;
const liveCorrodeTarget = { id: 'live', x: 20, y: 0, radius: 10, power: 100, originalPower: 100, corrodeTimer: 0, corrodeFactor: 0, consumed: false };
state.enemies = [liveCorrodeTarget];
state.skills.corrode.target = liveCorrodeTarget;
state.skills.corrode.weaken = 0.25;
state.skills.corrode.effectDuration = 3;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'echo', skill: state.skills.echo });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'corrode', skill: state.skills.corrode });
context.SkillEffects.update(state, 0.8);
assert(liveCorrodeTarget.power < 100 && liveCorrodeTarget.corrodeTimer > 0 && liveCorrodeTarget.corrodeFactor > 0, 'live Corrode refrain reapplies the full status');

// Corrode effects alter both the target and the player reserve.
state = createState(['corrode', null, null], [word('drain', 'corrode', ['drain']), word('acid', 'corrode', [])]);
const corroded = { id: 'corroded', x: 0, y: 0, radius: 10, power: 100, originalPower: 100, corrodeTimer: 3, corrodeFactor: 0.4 };
context.SkillSystem.weakenTarget(state, 'corrode', corroded, 0.25, 3);
assert(state.growthPower > 0, 'Power Drain converts stripped power into reserve');
const nearby = { id: 'nearby', x: 80, y: 0, radius: 10, power: 100, originalPower: 100, corrodeTimer: 0, corrodeFactor: 0 };
state.enemies = [corroded, nearby];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.ENEMY_CONSUMED, { enemy: corroded, isBoss: false });
assert(nearby.corrodeFactor > 0 && nearby.corrodeTimer > 0, 'Contagion transfers corrosion to a nearby target');

state = createState(['corrode', null, null], [word('drain', 'corrode', ['drain'])]);
const depleted = { id: 'depleted', x: 0, y: 0, radius: 10, power: 1, originalPower: 1000, corrodeTimer: 0, corrodeFactor: 0 };
context.SkillSystem.weakenTarget(state, 'corrode', depleted, 0.5, 3);
assert(Math.abs(state.growthPower - 0.04) < 1e-9, 'Power Drain rewards eight percent of power actually removed');

state = createState(['echo', null, null], [word('plain', 'echo', [])]);
state.skills.echo.active = true;
assert(activeIds(state).includes('echo.harvest-echo'));
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'echo', skill: state.skills.echo });
const consumedLetter = { id: 'letter-fish', x: 0, y: 0, radius: 5, power: 0.2, chargeBoost: 1, chargeScale: 1, dropType: 'letter', bias: 'z', consumed: false };
state.enemies = [consumedLetter];
const originalRollDropLetter = context.GenomeSystem.rollDropLetter;
const originalAddLetter = context.GenomeSystem.addLetter;
const addedLetters = [];
context.GenomeSystem.rollDropLetter = () => 'z';
context.GenomeSystem.addLetter = (targetState, letter) => {
  addedLetters.push(letter);
  targetState.words.potentialOccurrences = [];
  targetState.words.revision += 1;
  context.SkillEffects.invalidate(targetState);
  return { accepted: true, displaced: [] };
};
context.CombatSystem.update(state);
assert.strictEqual(state.skillEffectRuntime.scheduled.length, 1, 'Harvest Echo schedules before the reward mutates the genome');
context.SkillEffects.update(state, 0.9);
assert.strictEqual(addedLetters.length, 2, 'the consuming build arms Harvest Echo before the incoming letter changes its traits');
context.GenomeSystem.rollDropLetter = originalRollDropLetter;
context.GenomeSystem.addLetter = originalAddLetter;

const waveIds = context.SkillEffects.definitions.map((definition) => definition.id);
assert.strictEqual(waveIds.length, 20, 'first wave contains twenty registered effects');
console.log(JSON.stringify({ registeredWave1: waveIds.length, firstGain, secondGain, corrodeReserve: state.growthPower }, null, 2));
