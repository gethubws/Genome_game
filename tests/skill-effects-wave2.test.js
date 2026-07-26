const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let novaPulseCount = 0;

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
    palette: {
      cyan: '#65e5ff',
      pink: '#ff6fa8',
      gold: '#ffd36f',
      mint: '#64f0b6',
      orange: '#ff8a38'
    }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    normalize: (x, y) => {
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    }
  },
  I18n: { locale: () => 'en' },
  GameState: { createParticle: () => ({}) },
  ShotSkill: { burst: () => {} }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

load('src/systems/skill-effects.js');

context.SkillSystem = {
  weakenTarget(state, sourceId, target, baseWeaken, duration) {
    const before = target.power;
    const event = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
      sourceId,
      target,
      amount: baseWeaken,
      duration
    });
    const amount = Math.max(0, Math.min(0.82, Number(event.amount) || 0));
    target.power = Math.max(0.1, target.power * (1 - amount));
    target.weaknessTimer = Math.max(target.weaknessTimer || 0, Number(event.duration) || 0);
    context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
      sourceId,
      target,
      amount,
      duration: event.duration,
      powerBefore: before,
      powerAfter: target.power,
      powerRemoved: before - target.power
    });
    return { weaken: amount };
  }
};

context.NovaSkill = {
  resolvePulse(state, spec) {
    novaPulseCount += 1;
    const hits = state.enemies.filter((target) => context.Utils.dist(target, spec.origin) <= spec.radius);
    hits.forEach((target) => context.SkillSystem.weakenTarget(state, spec.sourceId || 'nova', target, spec.weaken, spec.duration));
    context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_RESOLVED, {
      id: 'nova',
      origin: spec.origin,
      radius: spec.radius,
      weaken: spec.weaken,
      duration: spec.duration,
      primary: !!spec.primary,
      replay: !!spec.replay,
      targets: hits
    });
    return hits;
  }
};

load('src/skills/effects-wave2.js');

function occurrence(text, family, trait, affinity = 1.5) {
  return {
    index: 0,
    word: { text, family, skill: family, variant: trait, traits: [trait], affinity }
  };
}

function createState(family, traits) {
  const occurrences = (traits || []).map((trait, index) => {
    const entry = occurrence(`${family}-${trait}-${index}`, family, trait);
    entry.index = index;
    return entry;
  });
  return {
    time: 10,
    dt: 0.1,
    growthPower: 0,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 20,
      invulnerable: 0,
      activeSlots: [family, null, null]
    },
    words: {
      revision: 1,
      potentialOccurrences: occurrences,
      occurrences: occurrences,
      found: []
    },
    genome: { letters: ['w', 'a', 'v', 'e'] },
    skills: {
      dash: { cooldown: 1, active: false, age: 0, duration: 0.8, direction: { x: 1, y: 0 } },
      shot: { cooldown: 0.8 },
      nova: { cooldown: 4, active: false },
      guard: { cooldown: 5, active: false, age: 0, duration: 1, absorbed: false }
    },
    enemies: [],
    boss: { active: null },
    bullets: [],
    enemyBullets: [],
    particles: [],
    shockwaves: [],
    floatingTexts: []
  };
}

function replaceOccurrences(state, occurrences) {
  state.words.potentialOccurrences = occurrences.slice();
  state.words.occurrences = occurrences.slice();
  state.words.revision += 1;
  context.SkillEffects.invalidate(state);
}

const expectedTraits = {
  dash: ['feeding-line', 'slipstream', 'breach-phase', 'frost-wake', 'schoolbreaker', 'afterimage', 'wake-collapse', 'momentum-bank'],
  shot: ['ricochet-lock', 'harpoon', 'split-genome', 'quarry-mark', 'primer-shot', 'frost-needle', 'waveguide-shot', 'repeater-circuit'],
  nova: ['repulsion-ring', 'chain-pulse', 'silence-field', 'perimeter-mine', 'forward-lobe', 'feeding-vortex', 'catalytic-pulse', 'cascade-engine'],
  guard: ['mirror-shell', 'layered-carapace', 'anchor-plate', 'last-reserve', 'word-bastion', 'retaliation-seal', 'countercurrent', 'bastion-field']
};

assert.strictEqual(context.SkillEffects.definitions.length, 32, 'wave two registers thirty-two effects');
Object.keys(expectedTraits).forEach((family) => {
  const definitions = Array.from(context.SkillEffects.definitions).filter((definition) => definition.family === family);
  assert.strictEqual(definitions.length, 8, `${family} receives eight effects`);
  const actual = Array.from(definitions, (definition) => definition.trait).sort();
  assert.deepStrictEqual(actual, expectedTraits[family].slice().sort(), `${family} covers every planned trait`);
  definitions.forEach((definition) => {
    assert(definition.name && definition.nameZh, `${definition.id} has localized names`);
    assert(definition.description && definition.descriptionZh, `${definition.id} has localized descriptions`);
  });
});

// Dash can lay down real control and phase through one damaging contact.
let state = createState('dash', ['frost-wake']);
state.skills.dash.active = true;
const chilled = { id: 'chilled', kind: 'hunter', x: 25, y: 0, vx: 20, vy: 0, radius: 10, power: 100, attackState: 'idle' };
state.enemies = [chilled];
context.SkillEffects.emit(state, 'dash:update', { skill: state.skills.dash });
assert(chilled.frozen > 0, 'Frost Wake applies a real frozen status');

state = createState('dash', ['breach-phase']);
state.skills.dash.active = true;
const breacher = { id: 'breacher', kind: 'hunter', x: 10, y: 0, vx: 0, vy: 0, radius: 12, power: 100, attackState: 'charge', attackAge: 0.2 };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'dash', skill: state.skills.dash });
const phased = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, { amount: 2, source: breacher });
assert.strictEqual(phased.cancelled, true, 'Breach Phase cancels the first Dash hit');
assert(breacher.power < 100 && breacher.attackState === 'idle', 'Breach Phase punishes and interrupts the attacker');
const secondHit = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, { amount: 2, source: breacher });
assert.strictEqual(secondHit.cancelled, false, 'Breach Phase is limited to one contact per Dash');

state = createState('dash', ['breach-phase']);
state.skills.dash.active = true;
const alreadyProtected = { id: 'protected-attacker', kind: 'hunter', x: 10, y: 0, vx: 0, vy: 0, radius: 12, power: 100, attackState: 'charge' };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'dash', skill: state.skills.dash });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, { amount: 2, source: alreadyProtected, cancelled: true });
assert.strictEqual(context.SkillEffects.get(state, 'dash.breach-phase').state.used, false, 'Breach Phase is not spent after an earlier defence cancels the hit');
assert.strictEqual(alreadyProtected.power, 100, 'cancelled damage does not fracture the attacker twice');

// Split Genome inherits the projectile build, while Ricochet Lock retargets an expiring bolt.
state = createState('shot', ['split-genome']);
const splitBullet = { x: 0, y: 0, vx: 200, vy: 0, radius: 5, life: 1.5, maxLife: 1.5, weaken: 0.25, hitIds: Object.create(null) };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_PREPARE, { id: 'shot', bullet: splitBullet });
assert.strictEqual(state.bullets.length, 2, 'Split Genome creates two side bolts');
assert(state.bullets.every((bullet) => bullet.splitChild && bullet.weaken < splitBullet.weaken));

state = createState('shot', ['split-genome', 'ricochet-lock', 'waveguide-shot']);
const inheritedBullet = { x: 0, y: 0, vx: 200, vy: 0, radius: 5, life: 1.5, maxLife: 1.5, weaken: 0.25, hitIds: Object.create(null) };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_PREPARE, { id: 'shot', bullet: inheritedBullet });
assert(state.bullets.every((bullet) => bullet.waveguide && bullet.ricochetsLeft > 0), 'Split Genome children inherit earlier projectile preparation');
assert.notStrictEqual(state.bullets[0].hitIds, state.bullets[1].hitIds, 'Split Genome children keep independent hit tracking');

state = createState('shot', ['ricochet-lock']);
const struck = { id: 'struck', kind: 'hunter', x: 0, y: 0, radius: 10, power: 100 };
const ricochetTarget = { id: 'next', kind: 'spitter', x: 120, y: 0, radius: 10, power: 100 };
state.enemies = [struck, ricochetTarget];
const ricochetBullet = { x: 0, y: 0, vx: 180, vy: 0, radius: 4, life: 1, weaken: 0.2, hitIds: Object.create(null) };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_PREPARE, { id: 'shot', bullet: ricochetBullet });
const ricochet = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_HIT, {
  id: 'shot', bullet: ricochetBullet, target: struck, weaken: 0.2, duration: 1, consume: true
});
assert.strictEqual(ricochet.consume, false, 'Ricochet Lock keeps the projectile alive');
assert(ricochetBullet.vx > 0 && Math.abs(ricochetBullet.vy) < 0.001, 'Ricochet Lock redirects toward the next target');

// Timed target state must continue expiring while its source word is
// unpowered. Restoring Harpoon cannot revive an old tether.
state = createState('shot', ['harpoon']);
const harpoonOccurrence = state.words.potentialOccurrences[0];
const harpooned = { id: 'harpooned', kind: 'hunter', x: 100, y: 0, vx: 0, vy: 0, radius: 10, power: 100 };
state.enemies = [harpooned];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_HIT, {
  id: 'shot', target: harpooned, bullet: ricochetBullet
});
const harpoonUntil = harpooned.harpoonUntil;
context.SkillEffects.update(state, 0.1);
assert(harpooned.vx < 0, 'Harpoon pulls while its absolute lifetime is active');
replaceOccurrences(state, []);
state.time = harpoonUntil + 1;
context.SkillEffects.update(state, 1);
replaceOccurrences(state, [harpoonOccurrence]);
harpooned.vx = 0;
harpooned.vy = 0;
context.SkillEffects.update(state, 0.1);
assert.strictEqual(harpooned.vx, 0, 'restoring Harpoon after expiry does not revive the old tether');
assert.strictEqual(harpooned.vy, 0, 'expired Harpoon remains inert after its word returns');

state = createState('shot', ['primer-shot']);
const primed = { id: 'primed', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_HIT, {
  id: 'shot', bullet: ricochetBullet, target: primed, weaken: 0.2, duration: 1, consume: true
});
const detonation = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'nova', target: primed, amount: 0.2, duration: 1
});
assert(detonation.amount > 0.2 && detonation.duration > 1, 'Primer Shot amplifies a different weakening skill');
assert.strictEqual(primed.genePrimerUntil, 0, 'the primer is consumed exactly once');

// Nova can reshape its cast, catalyse existing statuses and leave a live mine.
state = createState('nova', ['forward-lobe', 'catalytic-pulse']);
const preparedPulse = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_PREPARE, {
  id: 'nova', origin: state.player, radius: 120, weaken: 0.2, duration: 1.5, primary: true
});
assert(preparedPulse.origin.x > 0 && preparedPulse.radius < 120 && preparedPulse.weaken > 0.2, 'Forward Lobe shifts and focuses Nova');
const catalystTarget = { id: 'catalyst', kind: 'hunter', x: 30, y: 0, radius: 10, power: 100, frozen: 1, corrodeTimer: 2, revealed: 1 };
const catalysed = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'nova', target: catalystTarget, amount: 0.2, duration: 1
});
assert(catalysed.amount > 0.24, 'Catalytic Pulse stacks multiple existing statuses');

state = createState('nova', ['perimeter-mine']);
const mineTarget = { id: 'mine-target', kind: 'hunter', x: 70, y: 0, vx: 0, vy: 0, radius: 10, power: 100 };
state.enemies = [mineTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_RESOLVED, {
  id: 'nova', origin: { x: 0, y: 0 }, radius: 120, weaken: 0.2, duration: 1.5, primary: true, replay: false, targets: []
});
const pulsesBeforeMine = novaPulseCount;
context.SkillEffects.update(state, 0.4);
assert.strictEqual(novaPulseCount, pulsesBeforeMine + 1, 'Perimeter Mine triggers a delayed Nova pulse');
assert(mineTarget.power < 100, 'the mine pulse weakens targets in its ring');
context.SkillEffects.update(state, 0.4);
assert.strictEqual(novaPulseCount, pulsesBeforeMine + 1, 'a replay pulse cannot recursively arm another Perimeter Mine');

// Feeding Vortex uses the same wall-clock contract: its pull and consume
// refund both stay expired after the word leaves and later returns.
state = createState('nova', ['feeding-vortex']);
const vortexOccurrence = state.words.potentialOccurrences[0];
const vortexPrey = { id: 'vortex-prey', kind: 'growth', x: 100, y: 0, vx: 0, vy: 0, radius: 10, power: 10 };
state.enemies = [vortexPrey];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_RESOLVED, {
  id: 'nova', origin: state.player, radius: 120, weaken: 0.2, duration: 1.5, primary: true, targets: [vortexPrey]
});
const vortexUntil = vortexPrey.feedingVortexUntil;
context.SkillEffects.update(state, 0.1);
assert(vortexPrey.vx < 0, 'Feeding Vortex pulls prey while its absolute lifetime is active');
replaceOccurrences(state, []);
state.time = vortexUntil + 1;
context.SkillEffects.update(state, 1);
replaceOccurrences(state, [vortexOccurrence]);
vortexPrey.vx = 0;
vortexPrey.vy = 0;
state.skills.nova.cooldown = 4;
context.SkillEffects.update(state, 0.1);
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.ENEMY_CONSUMED, { enemy: vortexPrey });
assert.strictEqual(vortexPrey.vx, 0, 'restoring Feeding Vortex after expiry does not revive the old pull');
assert.strictEqual(vortexPrey.vy, 0, 'expired vortex prey remains inert after its word returns');
assert.strictEqual(state.skills.nova.cooldown, 4, 'expired vortex prey cannot refund Nova after the word returns');

state = createState('nova', ['cascade-engine']);
state.player.activeSlots = ['nova', 'shot', 'guard'];
replaceOccurrences(state, state.words.potentialOccurrences.concat([
  occurrence('guard-support', 'guard', 'base')
]));
state.skills.shot.cooldown = 10;
state.skills.guard.cooldown = 5;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_RESOLVED, {
  id: 'nova',
  origin: state.player,
  radius: 120,
  weaken: 0.2,
  duration: 1.5,
  primary: true,
  replay: false,
  targets: [{}, {}, {}, {}, {}]
});
assert.strictEqual(state.skills.shot.cooldown, 10, 'Cascade Engine skips a slotted skill with no live support');
assert(state.skills.guard.cooldown < 5, 'Cascade Engine advances the slowest powered companion skill');

// Guard receives a second physical layer and a passive genome-saving reserve.
state = createState('guard', ['layered-carapace']);
state.words.potentialOccurrences[0].word.affinity = 0.5;
state.skills.guard.active = true;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'guard', skill: state.skills.guard });
state.skills.guard.active = false;
state.player.invulnerable = 0.45;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GUARD_ABSORBED, {
  guard: state.skills.guard,
  source: { id: 'attacker', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 }
});
assert.strictEqual(state.skills.guard.active, true, 'Layered Carapace restores a short inner Guard');
assert(state.skills.guard.age < state.skills.guard.duration, 'the inner layer has real remaining duration');
assert(state.skills.guard.duration - state.skills.guard.age > state.player.invulnerable, 'the inner layer outlasts the block invulnerability window at minimum potency');

state = createState('guard', ['last-reserve']);
state.growthPower = 0;
const reserve = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  source: { id: 'fatal', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 }
});
assert.strictEqual(reserve.cancelled, true, 'Last Reserve prevents a genome-tearing hit');
assert(state.skills.guard.cooldown >= 6.5 && state.player.invulnerable > 0, 'Last Reserve enters cooldown and grants a recovery window');

state = createState('guard', ['last-reserve']);
const cancelledCooldown = state.skills.guard.cooldown;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  cancelled: true,
  source: { id: 'already-blocked', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 }
});
assert.strictEqual(state.skills.guard.cooldown, cancelledCooldown, 'Last Reserve is not spent on damage already cancelled by another defence');
assert.strictEqual(state.player.invulnerable, 0, 'cancelled damage does not add a redundant Last Reserve window');

state = createState('guard', ['countercurrent']);
state.player.activeSlots = ['guard', 'dash', null];
state.skills.dash.cooldown = 2;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GUARD_ABSORBED, {
  guard: state.skills.guard,
  source: { id: 'counter-source', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 }
});
assert.strictEqual(state.skills.dash.cooldown, 2, 'Countercurrent does not refund a slotted Dash with no live support');
replaceOccurrences(state, state.words.potentialOccurrences.concat([
  occurrence('dash-support', 'dash', 'base')
]));
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GUARD_ABSORBED, {
  guard: state.skills.guard,
  source: { id: 'powered-counter-source', kind: 'hunter', x: 20, y: 0, radius: 10, power: 100 }
});
assert(state.skills.dash.cooldown < 2, 'Countercurrent refunds Dash after live support is restored');

state = createState('dash', ['momentum-bank']);
const momentum = context.SkillEffects.get(state, 'dash.momentum-bank');
momentum.state.timeLeft = 1;
momentum.state.bonusLog = Math.log(1.2);
const infinitePower = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.POWER_LOG_MULTIPLIER, { log: Infinity });
assert.strictEqual(infinitePower.log, Infinity, 'Momentum Bank preserves an existing infinite power multiplier');

console.log(JSON.stringify({ registeredWave2: context.SkillEffects.definitions.length, novaPulseCount }, null, 2));
