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
    growth: { fishBase: 1, fishPerLayer: 0.5 },
    palette: {
      cyan: '#65e5ff',
      pink: '#ff6fa8',
      gold: '#ffd36f',
      danger: '#ff667c',
      mint: '#64f0b6'
    }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    }
  },
  I18n: { locale: () => 'en' },
  GameState: {
    createParticle: (x, y, vx, vy, color, life, size) => ({ x, y, vx, vy, color, life, maxLife: life, size })
  },
  ShotSkill: {
    burst: (state, x, y, color, count) => {
      state.testBursts.push({ x, y, color, count });
    }
  },
  CombatSystem: {
    effectivePower: (state) => state.testPlayerPower || 50
  },
  SkillSystem: {}
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

load('src/data/skill-effect-traits.js');
load('src/systems/skill-effects.js');

context.SkillSystem.weakenTarget = (state, sourceId, target, baseAmount, duration) => {
  const powerBefore = target.power;
  const event = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
    sourceId,
    target,
    amount: baseAmount,
    duration
  });
  const amount = Math.max(0, Math.min(0.82, Number(event.amount) || 0));
  target.power = Math.max(0.1, target.power * (1 - amount));
  target.weaknessTimer = Math.max(target.weaknessTimer || 0, Number(event.duration) || 0);
  context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
    sourceId,
    target,
    amount,
    duration: Number(event.duration) || 0,
    powerBefore,
    powerAfter: target.power,
    powerRemoved: powerBefore - target.power
  });
  return { weaken: amount };
};

load('src/skills/effects-wave3.js');

let serial = 0;
function occurrence(family, trait, affinity = 1.5) {
  return {
    index: 0,
    word: {
      text: `${family}-${trait}-${serial += 1}`,
      family,
      skill: family,
      variant: trait,
      traits: [trait],
      affinity
    }
  };
}

function enemy(overrides = {}) {
  return Object.assign({
    id: `enemy-${serial += 1}`,
    x: 80,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 12,
    power: 100,
    originalPower: 100,
    frozen: 0,
    revealed: 0,
    revealScale: 0,
    weaknessTimer: 0,
    corrodeTimer: 0,
    corrodeFactor: 0,
    attackState: 'idle',
    attackAge: 0,
    attackCooldown: 0,
    chargeBoost: 1,
    chargeScale: 1,
    dropType: 'letter',
    kind: 'letter',
    consumed: false
  }, overrides);
}

function createState(family, traits, extraSlots = []) {
  return {
    time: 10,
    dt: 0.1,
    testPlayerPower: 50,
    testBursts: [],
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 20,
      basePower: 2,
      activeSlots: [family].concat(extraSlots).slice(0, 3)
    },
    growthPower: 0,
    genome: { letters: [] },
    words: {
      revision: serial += 1,
      potentialOccurrences: traits.map((trait) => occurrence(family, trait)),
      occurrences: []
    },
    skills: {
      freeze: { cooldown: 3, lastRadius: 150, lastDuration: 2 },
      scan: { cooldown: 3, active: false, radius: 220, revealTime: 3 },
      growth: { cooldown: 8, active: false, age: 0, duration: 5, charges: 0, multiplier: 1.5, totalBonus: 0 },
      dash: { cooldown: 0, active: false, direction: { x: 1, y: 0 }, boost: 1 },
      shot: { cooldown: 0 },
      nova: { cooldown: 0 }
    },
    enemies: [],
    enemyBullets: [],
    bullets: [],
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    boss: { active: null },
    map: { currentLayer: 2 }
  };
}

const wave3Definitions = context.SkillEffects.definitions.slice();
assert.strictEqual(wave3Definitions.length, 24, 'third wave registers exactly twenty-four effects');

['freeze', 'scan', 'growth'].forEach((family) => {
  const registeredTraits = wave3Definitions
    .filter((definition) => definition.family === family)
    .map((definition) => definition.traits[0])
    .sort();
  const expectedTraits = context.SkillEffectTraitCatalog[family].slice(1).sort();
  assert.deepStrictEqual(Array.from(registeredTraits), Array.from(expectedTraits), `${family} covers every remaining trait branch`);
});

wave3Definitions.forEach((definition) => {
  assert(definition.name && definition.nameZh, `${definition.id} has English and Chinese names`);
  assert(definition.description && definition.descriptionZh, `${definition.id} has English and Chinese descriptions`);
});

// Freeze: trail control, brittle damage, chain propagation, time pocket and shard conversion.
let state = createState('freeze', ['frost-trail', 'permafrost'], ['dash', null]);
let trailTarget = enemy({ x: 12, y: 0, weaknessTimer: 1 });
state.enemies = [trailTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'freeze', skill: state.skills.freeze });
context.SkillEffects.update(state, 0.12);
assert(trailTarget.frozen > 0, 'Frost Trail freezes a target crossing the player trail');
assert.strictEqual(trailTarget.permafrost, true, 'Frost Trail emits frozen status for Permafrost and other same-family effects');
const trailFreezeCues = state.floatingTexts.filter((entry) => entry.text === 'TRAIL FREEZE').length;
context.SkillEffects.update(state, 0.05);
assert.strictEqual(
  state.floatingTexts.filter((entry) => entry.text === 'TRAIL FREEZE').length,
  trailFreezeCues,
  'a target remaining inside Frost Trail does not emit frozen status every frame'
);

state = createState('freeze', ['brittle-lattice']);
let brittleTarget = enemy({ frozen: 2 });
let brittleEvent = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'shot', target: brittleTarget, amount: 0.2, duration: 1
});
assert(brittleEvent.amount > 0.2, 'Brittle Lattice amplifies weakening against frozen targets');

state = createState('freeze', ['ice-chain']);
const chainSource = enemy({ x: 35, frozen: 2 });
const chainTarget = enemy({ x: 165, frozen: 0 });
state.enemies = [chainSource, chainTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.STATUS_APPLIED, {
  sourceId: 'freeze', status: 'frozen', target: chainSource, radius: 100, duration: 2, distance: 35
});
assert(chainTarget.frozen > 0, 'Ice Chain jumps to a target beyond the original field');

state = createState('freeze', ['time-pocket']);
const slowedAttacker = enemy({ x: 40, frozen: 2, attackState: 'windup', attackAge: 1, attackCooldown: 0 });
const slowedBullet = { x: 30, y: 0, vx: 100, vy: 0, life: 2 };
state.enemies = [slowedAttacker];
state.enemyBullets = [slowedBullet];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'freeze', skill: state.skills.freeze });
context.SkillEffects.update(state, 0.1);
assert(slowedBullet.vx < 100, 'Time Pocket slows hostile projectiles');
assert(slowedAttacker.attackAge < 1 && slowedAttacker.attackCooldown > 0, 'Time Pocket delays enemy windups');

state = createState('freeze', ['shard-harvest'], ['shot', null]);
state.words.potentialOccurrences.push(occurrence('shot', 'base'));
const frozenCatch = enemy({ x: 0, y: 0, frozen: 1.5, dropType: 'growth', kind: 'growth', growthValue: 2 });
const shardTarget = enemy({ x: 120, y: 0 });
state.enemies = [frozenCatch, shardTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.ENEMY_CONSUMED, {
  enemy: frozenCatch, gain: 2, dropType: 'growth', isBoss: false
});
assert(state.growthPower > 0, 'Shard Harvest converts a frozen catch into reserve power');
assert(state.bullets.some((bullet) => bullet.frostShard), 'Shard Harvest creates seeking shards while Shot is equipped and powered');

state = createState('freeze', ['shard-harvest'], ['shot', null]);
const offlineFrozenCatch = enemy({ x: 0, y: 0, frozen: 1.5, dropType: 'growth', kind: 'growth', growthValue: 2 });
state.enemies = [offlineFrozenCatch, enemy({ x: 120, y: 0 })];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.ENEMY_CONSUMED, {
  enemy: offlineFrozenCatch, gain: 2, dropType: 'growth', isBoss: false
});
assert(state.growthPower > 0, 'Shard Harvest keeps its own reserve reward when Shot is unpowered');
assert(!state.bullets.some((bullet) => bullet.frostShard), 'a slotted but unsupported Shot cannot generate Frost Shards');

// Scan: ecology propagation, deterministic drops, lock-on and delayed radar.
state = createState('scan', ['school-census']);
const censusLead = enemy({ schoolId: 'school-a' });
const censusMember = enemy({ x: 130, schoolId: 'school-a' });
const censusGuard = enemy({ x: 170, kind: 'hunter', guardSchoolId: 'school-a' });
state.enemies = [censusLead, censusMember, censusGuard];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, {
  sourceId: 'scan', target: censusLead, revealTime: 3
});
assert(censusMember.revealed > 0 && censusGuard.revealed > 0, 'School Census reveals schoolmates and guards');

state = createState('scan', ['school-census', 'target-lock']);
const dedupLead = enemy({ schoolId: 'school-dedup' });
const dedupMember = enemy({ x: 130, schoolId: 'school-dedup' });
const dedupGuard = enemy({ x: 170, kind: 'hunter', guardSchoolId: 'school-dedup' });
state.enemies = [dedupLead, dedupMember, dedupGuard];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'scan', skill: state.skills.scan });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, { sourceId: 'scan', target: dedupLead, revealTime: 3 });
const firstLockCues = state.floatingTexts.filter((entry) => entry.text === 'LOCK').length;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, { sourceId: 'scan', target: dedupMember, revealTime: 3 });
const secondLockCues = state.floatingTexts.filter((entry) => entry.text === 'LOCK').length;
assert.strictEqual(firstLockCues, 3, 'the first school contact propagates reveal once to every member');
assert.strictEqual(secondLockCues, firstLockCues + 1, 'later contacts in the same scan do not fan out the school again');

state = createState('scan', ['drop-oracle']);
const oracleTarget = enemy({ bias: 'q', fixedDrop: false, dropChance: 0.25 });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, {
  sourceId: 'scan', target: oracleTarget, revealTime: 3
});
assert.strictEqual(oracleTarget.fixedDrop, true, 'Drop Oracle locks the displayed biased letter');
assert.strictEqual(oracleTarget.dropChance, 1);

state = createState('scan', ['target-lock'], ['shot', null]);
const lockedTarget = enemy({ id: 'locked-target', x: 120, y: 40, vx: 0, vy: 0 });
state.enemies = [lockedTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, {
  sourceId: 'scan', target: lockedTarget, revealTime: 3
});
const lockBullet = { x: 0, y: 0, vx: 200, vy: 0, weaken: 0.2 };
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_PREPARE, { id: 'shot', bullet: lockBullet });
assert.strictEqual(lockBullet.lockedTargetId, lockedTarget.id, 'Target Lock steers a shot toward a revealed target');
const lockedHit = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PROJECTILE_HIT, {
  id: 'shot', bullet: lockBullet, target: lockedTarget, weaken: 0.2
});
assert(lockedHit.weaken > 0.2, 'a locked shot gains extra weakening');

state = createState('scan', ['echo-radar']);
const echoTarget = enemy({ x: 200, y: 0, revealed: 0 });
state.enemies = [echoTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'scan', skill: state.skills.scan });
context.SkillEffects.update(state, 1.1);
assert(echoTarget.revealed > 0, 'Echo Radar reveals targets on its delayed return pulse');
assert(state.skills.scan.cooldown < 3, 'Echo Radar refunds cooldown for new contacts');

state = createState('scan', ['kill-window'], ['shot', null]);
state.testPlayerPower = 100;
const thresholdTarget = enemy({ power: 135, originalPower: 135 });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_REVEALED, {
  sourceId: 'scan', target: thresholdTarget, revealTime: 3
});
const windowHit = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'shot', target: thresholdTarget, amount: 0.08, duration: 1
});
assert(windowHit.amount >= 1 - 100 / 135, 'Kill Window raises the next hit enough to cross the consume threshold');

// Growth: risk/reward routing, cultivation, defensive charge use and final pulse.
state = createState('growth', ['risk-bloom']);
state.skills.growth.active = true;
state.skills.growth.charges = 3;
const riskCatch = enemy({ x: 0, y: 0, kind: 'growth', dropType: 'growth' });
const nearbyThreat = enemy({ x: 80, y: 0, kind: 'hunter', power: 180 });
state.enemies = [riskCatch, nearbyThreat];
const riskGain = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'before', amount: 1, baseAmount: 1, enemy: riskCatch, skill: state.skills.growth, empowered: true
});
assert(riskGain.amount > 1, 'Risk Bloom increases a catch made beside a stronger enemy');

state = createState('growth', ['school-harvest']);
state.skills.growth.active = true;
state.skills.growth.charges = 7;
const schoolCatch = enemy({ schoolId: 'harvest-school', kind: 'growth', dropType: 'growth' });
const schoolHarvest = context.SkillEffects.get(state, 'growth.school-harvest');
schoolHarvest.state.schoolId = schoolCatch.schoolId;
schoolHarvest.state.count = 2;
schoolHarvest.state.expiresAt = state.time + 1;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'before', amount: 1, baseAmount: 1, enemy: schoolCatch, skill: state.skills.growth, empowered: true
});
state.skills.growth.charges -= 1;
assert.strictEqual(state.skills.growth.charges, 7, 'School Harvest preserves the third charge even at the reserve cap');

state = createState('growth', ['cultivation']);
state.skills.growth.active = true;
state.skills.growth.charges = 3;
const cultivated = enemy({ x: 100, y: 0, kind: 'growth', dropType: 'growth', growthValue: 1, vx: 0 });
state.enemies = [cultivated];
context.SkillEffects.update(state, 1);
assert(cultivated.growthValue > 1, 'Cultivation matures nearby growth fish');
assert(cultivated.vx < 0, 'Cultivation draws growth fish toward the player');

state = createState('growth', ['adaptive-digestion']);
state.skills.growth.active = true;
state.skills.growth.charges = 3;
const firstSource = enemy({ schoolId: 'school-one', kind: 'growth', dropType: 'growth' });
const secondSource = enemy({ schoolId: 'school-two', kind: 'growth', dropType: 'growth' });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'before', amount: 1, enemy: firstSource, skill: state.skills.growth, empowered: true
});
const adaptedGain = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'before', amount: 1, enemy: secondSource, skill: state.skills.growth, empowered: true
});
assert(adaptedGain.amount > 1, 'Adaptive Digestion rewards switching to a different school');

state = createState('growth', ['regrowth']);
state.skills.growth.active = true;
state.skills.growth.charges = 2;
state.growthPower = 5;
const damageEvent = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  source: enemy({ frozen: 1 })
});
assert(damageEvent.amount < 1, 'Regrowth spends a charge to substantially reduce incoming damage');
assert.strictEqual(state.skills.growth.charges, 1);

state = createState('growth', ['regrowth']);
state.skills.growth.active = true;
state.skills.growth.charges = 2;
const genomeProtection = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 3.2,
  source: enemy({ frozen: 1 })
});
assert.strictEqual(genomeProtection.amount, 3.2, 'empty-reserve Regrowth preserves the damage value used to calculate factor loss');
assert.strictEqual(genomeProtection.factorLossReduction, 2, 'a frozen attacker lets Regrowth preserve two genome factors');
assert.strictEqual(state.skills.growth.charges, 1, 'genome protection spends exactly one Growth charge');

// The real Last Reserve definition has priority zero, so it cancels before
// Regrowth's later priority and does not waste a Growth charge.
load('src/skills/effects-wave2.js');
state = createState('growth', ['regrowth'], ['guard', null]);
state.words.potentialOccurrences.push(occurrence('guard', 'last-reserve'));
state.genome.letters = ['a'];
state.skills.guard = { active: false, cooldown: 0 };
state.skills.growth.active = true;
state.skills.growth.charges = 2;
const lastReserveFirst = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  source: enemy({ frozen: 1 })
});
assert.strictEqual(lastReserveFirst.cancelled, true, 'Last Reserve cancels an empty-reserve genome hit before Regrowth');
assert.strictEqual(state.skills.growth.charges, 2, 'Regrowth does not spend a charge after Last Reserve cancels the hit');

state = createState('growth', ['regrowth', 'molt-pulse']);
state.skills.growth.active = true;
state.skills.growth.charges = 1;
const cancelledGrowthHit = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  cancelled: true,
  source: enemy({ frozen: 1 })
});
assert.strictEqual(cancelledGrowthHit.amount, 2, 'cancelled damage is not modified by Regrowth');
assert.strictEqual(state.skills.growth.charges, 1, 'cancelled damage does not consume a Growth charge');
assert.strictEqual(state.skills.growth.moltPending, undefined, 'cancelled damage cannot arm a delayed Molt Pulse');

state = createState('growth', ['reserve-cell']);
state.skills.growth.active = true;
state.skills.growth.charges = 2;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'growth', skill: state.skills.growth });
state.skills.growth.active = false;
state.skills.growth.charges = 0;
context.SkillEffects.update(state, 0.1);
assert(state.growthPower > 0, 'Reserve Cell banks charges left behind by natural expiration');
assert(state.skills.growth.cooldown < 8, 'Reserve Cell also refunds Growth cooldown');

state = createState('growth', ['reserve-cell', 'regrowth']);
state.skills.growth.active = true;
state.skills.growth.charges = 1;
state.growthPower = 5;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, { id: 'growth', skill: state.skills.growth });
const reserveBeforeDamage = state.growthPower;
const cooldownBeforeDamage = state.skills.growth.cooldown;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 2,
  source: enemy()
});
assert.strictEqual(state.skills.growth.charges, 0, 'Regrowth spends the final Growth charge');
context.SkillEffects.update(state, 0.1);
assert.strictEqual(state.growthPower, reserveBeforeDamage, 'Reserve Cell cannot bank a charge already spent by Regrowth');
assert.strictEqual(state.skills.growth.cooldown, cooldownBeforeDamage, 'a Regrowth charge does not also refund Growth cooldown');

state = createState('growth', ['molt-pulse'], ['nova', 'freeze']);
state.skills.growth.active = false;
state.skills.growth.charges = 0;
state.skills.growth.totalBonus = 3;
const moltOrigin = enemy({ x: 0, y: 0, kind: 'growth', dropType: 'growth' });
const moltTarget = enemy({ x: 90, y: 0, frozen: 1, power: 100 });
state.enemies = [moltTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'after', amount: 2, enemy: moltOrigin, skill: state.skills.growth, empowered: true, consumedCharge: true
});
assert(moltTarget.power < 100, 'Molt Pulse weakens nearby targets when the final charge is spent');
assert(state.shockwaves.length > 0, 'Molt Pulse has a visible shockwave');

state = createState('growth', ['molt-pulse'], ['nova', null]);
state.skills.growth.active = false;
state.skills.growth.charges = 0;
const offlineNovaTarget = enemy({ x: 180, y: 0, power: 100 });
state.enemies = [offlineNovaTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'after', amount: 2, enemy: state.player, skill: state.skills.growth, empowered: true, consumedCharge: true
});
assert.strictEqual(offlineNovaTarget.power, 100, 'a slotted but unsupported Nova cannot widen Molt Pulse');

state = createState('growth', ['molt-pulse'], ['nova', null]);
state.words.potentialOccurrences.push(occurrence('nova', 'base'));
state.skills.growth.active = false;
state.skills.growth.charges = 0;
const poweredNovaTarget = enemy({ x: 180, y: 0, power: 100 });
state.enemies = [poweredNovaTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GROWTH_GAIN, {
  phase: 'after', amount: 2, enemy: state.player, skill: state.skills.growth, empowered: true, consumedCharge: true
});
assert(poweredNovaTarget.power < 100, 'a powered Nova widens Molt Pulse to reach the linked target');

// Combat integration: factor-loss reduction is applied after the normal tear
// count, may reduce it to zero, and never shatters a lock in that case.
context.GameConfig.player = { invulnerableAfterHit: 0.7 };
context.GameUI = { toast: () => {}, showPowerSurge: () => {}, showEvolution: () => {} };
let removalCalls = 0;
context.GenomeSystem = {
  letterScore: () => 1,
  removeFrontFactors(targetState, count) {
    removalCalls += 1;
    return targetState.genome.letters.splice(0, count);
  }
};
load('src/systems/combat.js');

state = createState('growth', ['regrowth']);
state.player.invulnerable = 0;
state.skills.guard = { active: false, cooldown: 0 };
state.skills.growth.active = true;
state.skills.growth.charges = 1;
state.genome.letters = ['a'];
state.genome.lockedBlocks = [{ word: 'a', start: 0, length: 1 }];
state.words.potentialLogMultiplier = 0;
context.CombatSystem.damageGrowth(state, 0.9, 'Impact', enemy());
assert.strictEqual(removalCalls, 0, 'a fully protected one-factor tear never calls genome removal');
assert.deepStrictEqual(state.genome.letters, ['a'], 'Regrowth can reduce genome loss to zero');
assert.strictEqual(state.genome.lockedBlocks.length, 1, 'zero factor loss does not shatter a word lock');

state = createState('growth', ['regrowth']);
state.player.invulnerable = 0;
state.skills.guard = { active: false, cooldown: 0 };
state.skills.growth.active = true;
state.skills.growth.charges = 2;
state.genome.letters = ['a', 'b', 'c', 'd'];
state.genome.lockedBlocks = [];
state.words.potentialLogMultiplier = 0;
context.CombatSystem.damageGrowth(state, 3.2, 'Impact', enemy({ frozen: 1 }));
assert.deepStrictEqual(state.genome.letters, ['b', 'c', 'd'], 'frozen-attacker Regrowth subtracts two factors from a three-factor tear');

console.log(JSON.stringify({
  registeredWave3: wave3Definitions.length,
  freezeEffects: wave3Definitions.filter((definition) => definition.family === 'freeze').length,
  scanEffects: wave3Definitions.filter((definition) => definition.family === 'scan').length,
  growthEffects: wave3Definitions.filter((definition) => definition.family === 'growth').length
}, null, 2));
