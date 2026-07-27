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
    skills: { splice: { cooldown: 7, duration: 0.5, moves: 1 } },
    palette: {
      cyan: '#65e5ff',
      pink: '#ff6fa8',
      gold: '#ffd36f',
      mint: '#64f0b6',
      orange: '#ff8a38'
    }
  },
  I18n: { locale: () => 'en' },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    rand: (min, max) => (min + max) / 2,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    normalize: (x, y) => {
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

load('src/systems/skill-effects.js');

// The real combat bridge is intentionally tiny here. It still emits the same
// weaken events, which lets Entropy Counter and Acid Trail exercise recursion
// guards without loading the whole game loop.
context.SkillSystem = {
  potency: () => 4,
  hasEffect: (state, id) => context.SkillEffects.has(state, id),
  emitEffect: (state, eventName, event) => context.SkillEffects.emit(state, eventName, event),
  primeEchoFromSplice: () => null,
  weakenTarget(state, sourceId, target, amount, duration) {
    const before = Number(target.power) || 100;
    const weakenEvent = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
      sourceId,
      target,
      amount,
      duration
    });
    const weaken = Math.max(0, Number(weakenEvent.amount) || 0);
    target.power = Math.max(0.1, before * (1 - weaken));
    context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
      sourceId,
      target,
      amount: weaken,
      duration,
      powerBefore: before,
      powerAfter: target.power,
      powerRemoved: Math.max(0, before - target.power)
    });
    return { weaken };
  }
};

context.GenomeSystem = {
  lockCurrentWordBlock: (state) => {
    state.genome.lockedBlocks.push({ word: 'join', start: 0, length: 4 });
    return state.genome.lockedBlocks[state.genome.lockedBlocks.length - 1];
  }
};
context.WordSystem = {
  preview: (state) => {
    state.words.revision = (state.words.revision || 0) + 1;
  }
};
context.GameUI = { toast: () => {} };
context.ShotSkill = { burst: () => {} };

load('src/skills/effects-wave4.js');
load('src/skills/splice.js');

function word(text, family, traits, affinity = 2) {
  return { text, family, skill: family, traits, affinity };
}

function createState(activeSlots, occurrences) {
  return {
    time: 0,
    dt: 0.1,
    player: { x: 0, y: 0, activeSlots: activeSlots.slice() },
    words: {
      revision: 1,
      potentialOccurrences: occurrences.slice(),
      occurrences: occurrences.slice(),
      potentialLogMultiplier: 0
    },
    genome: { letters: 'abcd'.split(''), lockedBlocks: [], maxLockedBlocks: 3 },
    enemies: [],
    boss: { active: null },
    floatingTexts: [],
    shockwaves: [],
    growthPower: 0,
    skills: {
      echo: { active: true, cooldown: 4, duration: 2 },
      dash: { cooldown: 4 },
      shot: { cooldown: 4 },
      nova: { cooldown: 4 },
      corrode: { cooldown: 0 }
    }
  };
}

const definitions = context.SkillEffects.definitions;
assert.strictEqual(definitions.length, 24, 'wave four registers twenty-four effects');
assert.strictEqual(new Set(definitions.map((definition) => definition.id)).size, 24, 'wave four effect ids are unique');

// Mutation handlers run in phases: reverse first, then the final lock sees the
// resulting expression instead of locking a transient pre-mutation block.
let state = createState(
  ['splice', null, null],
  [word('join', 'splice', ['join-lock']), word('reverse', 'splice', ['reverse-transcript'])]
);
const change = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved',
  moved: ['x', 'y'],
  beforeLog: 0,
  afterLog: 1,
  genome: state.genome
});
assert.deepStrictEqual(state.genome.letters, ['a', 'b', 'd', 'c'], 'Reverse Transcript reverses the moved suffix');
assert.deepStrictEqual(change.moved, ['x', 'y'], 'Reverse Transcript preserves the chronological moved-factor list');
assert.strictEqual(state.genome.lockedBlocks.length, 1, 'Join Lock locks the post-mutation word block');
assert(change.afterLog >= 1, 'splice change keeps a usable post-mutation power log');

// A cast keeps the handlers it started with. Moving the letters that supplied
// Reverse Transcript out of the source word must not cancel the current cast.
state = createState(['splice', null, null], []);
const reverseSource = { word: word('reverse', 'splice', ['reverse-transcript']), index: 0, end: 7 };
state.genome.letters = 'reversea'.split('');
state.words.potentialOccurrences = [reverseSource];
state.words.occurrences = [reverseSource];
state.particles = [];
const originalPreview = context.WordSystem.preview;
context.WordSystem.preview = (targetState) => {
  const expressed = targetState.genome.letters.join('').includes('reverse') ? [reverseSource] : [];
  targetState.words.potentialOccurrences = expressed;
  targetState.words.occurrences = expressed;
  targetState.words.revision = (targetState.words.revision || 0) + 1;
  context.SkillEffects.invalidate(targetState);
};
assert.strictEqual(context.SpliceSkill.tryStart(state), true);
assert.strictEqual(state.genome.letters.join(''), 'erseaver', 'the captured Reverse handler finishes after its source word is dismantled');
assert.strictEqual(state.words.potentialOccurrences.length, 0, 'the source trait really was removed by this splice');
context.WordSystem.preview = originalPreview;

// A protection effect that runs earlier in hook order may cancel the hit.
// Salvage must neither modify that resolved event nor remain armed for a later
// unrelated hit.
state = createState(['splice', null, null], [word('salvage', 'splice', ['salvage-buffer'])]);
const salvage = context.SkillEffects.get(state, 'splice.salvage-buffer');
salvage.state.armed = true;
const cancelledDamage = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.PLAYER_DAMAGE, {
  amount: 3,
  cancelled: true
});
assert.strictEqual(cancelledDamage.amount, 3, 'Salvage Buffer leaves an already-cancelled hit untouched');
assert.strictEqual(salvage.state.armed, false, 'Salvage Buffer clears stale armed state on cancelled hits');

// Overlap Catalyst contributes through the shared power-log event and counts
// newly intersecting intervals rather than every newly expressed word.
state = createState(['splice', null, null], [
  { word: word('overlap', 'splice', ['overlap-catalyst']), index: 0, end: 7 },
  { word: word('tail', 'growth', []), index: 8, end: 12 }
]);
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:prepare',
  genome: state.genome
});
state.words.potentialOccurrences.push({ word: word('lap', 'growth', []), index: 4, end: 7 });
const overlapEvent = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved',
  moved: ['z'],
  beforeLog: 0,
  afterLog: 0,
  genome: state.genome
});
const overlapPower = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.POWER_LOG_MULTIPLIER, { log: 0 });
assert(overlapEvent && overlapPower.log > 0, 'Overlap Catalyst emits a temporary power bonus');

state = createState(['splice', null, null], [
  { word: word('overlap', 'splice', ['overlap-catalyst']), index: 0, end: 7 }
]);
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:prepare',
  genome: state.genome
});
state.words.potentialOccurrences.push({ word: word('tail', 'growth', []), index: 8, end: 12 });
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved',
  moved: ['z'],
  beforeLog: 0,
  afterLog: 0,
  genome: state.genome
});
const disjointPower = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.POWER_LOG_MULTIPLIER, { log: 0 });
assert.strictEqual(disjointPower.log, 0, 'a disjoint new word does not trigger Overlap Catalyst');

// Tail Graft refunds only for a genuinely new word occurrence. Re-indexing or
// losing old occurrences because the queue shifted is not a successful graft.
const graftTraitWord = word('graft', 'splice', ['tail-graft']);
const stableWord = word('stable', 'growth', []);
state = createState(['splice', null, null], [
  { word: graftTraitWord, index: 0, end: 5 },
  { word: stableWord, index: 6, end: 12 }
]);
const shiftedGraft = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved',
  moved: ['g'],
  copyLetter: () => {
    state.words.potentialOccurrences = [
      { word: graftTraitWord, index: 1, end: 6 },
      { word: stableWord, index: 5, end: 11 }
    ];
    return true;
  }
});
assert.strictEqual(shiftedGraft.cooldownFactor, undefined, 'Tail Graft does not refund for shifted existing words');

state = createState(['splice', null, null], [
  { word: graftTraitWord, index: 0, end: 5 },
  { word: stableWord, index: 6, end: 12 }
]);
const newGraftWord = word('new', 'growth', []);
const productiveGraft = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.GENOME_CHANGED, {
  phase: 'splice:moved',
  moved: ['g'],
  copyLetter: () => {
    state.words.potentialOccurrences = [
      { word: graftTraitWord, index: 0, end: 5 },
      { word: stableWord, index: 6, end: 12 },
      { word: newGraftWord, index: 10, end: 13 }
    ];
    return true;
  }
});
assert.strictEqual(productiveGraft.cooldownFactor, 0.82, 'Tail Graft refunds when the copied factor adds a word occurrence');

// Rebound Echo adds exactly one weaker, wider follow-up to replayed area
// skills. The nested replay events exercise its recursion guards.
state = createState(['echo'], [word('rebound', 'echo', ['rebound-echo'])]);
const novaRebounds = [];
context.NovaSkill = {
  resolvePulse(targetState, spec) {
    novaRebounds.push(spec);
    context.SkillEffects.emit(targetState, context.SkillEffects.EVENTS.AREA_RESOLVED, Object.assign({ id: 'nova' }, spec));
  }
};
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.AREA_RESOLVED, {
  id: 'nova',
  origin: state.player,
  radius: 100,
  weaken: 0.2,
  duration: 1.5,
  replay: true,
  primary: false
});
assert.strictEqual(novaRebounds.length, 1, 'Rebound Echo creates only one final Nova ring');
assert(novaRebounds[0].radius > 100 && novaRebounds[0].weaken < 0.2, 'the final Nova ring is wider and weaker');

state = createState(['echo'], [word('rebound', 'echo', ['rebound-echo'])]);
const freezeRebounds = [];
const replayFrozen = { id: 'replay-frozen', x: 20, y: 0, radius: 10, frozen: 0 };
state.enemies = [replayFrozen];
context.FreezeSkill = {
  applyField(targetState, radius, duration, options) {
    freezeRebounds.push({ radius, duration, options });
    replayFrozen.frozen = Math.max(replayFrozen.frozen, duration);
    context.SkillEffects.emit(targetState, context.SkillEffects.EVENTS.STATUS_APPLIED, {
      sourceId: 'freeze',
      status: 'frozen',
      target: replayFrozen,
      radius,
      duration,
      distance: 20,
      replay: !!(options && options.replay)
    });
  }
};
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.STATUS_APPLIED, {
  sourceId: 'freeze',
  status: 'frozen',
  target: replayFrozen,
  radius: 100,
  duration: 1.5,
  distance: 20,
  replay: true
});
assert.strictEqual(freezeRebounds.length, 1, 'Rebound Echo creates only one final Freeze ring');
assert(freezeRebounds[0].radius > 100 && freezeRebounds[0].duration < 1.5, 'the final Freeze ring is wider and shorter');

// Memory Sequence fits the real three-slot loadout: Echo plus two other skills.
state = createState(['echo', 'dash', 'shot'], [word('sequence', 'echo', ['memory-sequence'])]);
['dash', 'shot', 'dash'].forEach((id) => {
  context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, {
    id,
    skill: state.skills[id]
  });
});
assert(state.skills.echo.cooldown < 4, 'Memory Sequence advances Echo cooldown after an A-B-A sequence');

// Decay Clock target state is cleared when its exact trait word disappears,
// even if another Corrode word keeps the family equipped and powered.
state = createState(['corrode', null, null], [word('decay', 'corrode', ['decay-clock'])]);
const decayingTarget = { id: 'decaying', x: 20, y: 0, radius: 10, power: 100, originalPower: 100 };
state.enemies = [decayingTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
  sourceId: 'corrode',
  target: decayingTarget
});
assert.strictEqual(decayingTarget.decayClockTicks, 4);
state.words.potentialOccurrences = [word('rust', 'corrode', ['rust-accumulation'])];
state.words.revision += 1;
context.SkillEffects.compile(state);
assert.strictEqual(decayingTarget.decayClockTicks, 0, 'Decay Clock cannot resume old ticks after its word returns');
const powerAfterDecayCleanup = decayingTarget.power;
state.words.potentialOccurrences = [word('decay', 'corrode', ['decay-clock'])];
state.words.revision += 1;
context.SkillEffects.update(state, 1);
assert.strictEqual(decayingTarget.power, powerAfterDecayCleanup, 'restoring Decay Clock does not revive cleared ticks');

// Before the first Boss settlement, live preview occurrences still drive
// overlap effects even though the settled occurrence list is empty.
state = createState(['echo'], [
  { word: word('harmony', 'echo', ['overlap-harmony']), index: 0, end: 4 },
  { word: word('are', 'growth', []), index: 1, end: 4 },
  { word: word('ear', 'growth', []), index: 3, end: 6 }
]);
state.words.occurrences = [];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, {
  id: 'echo',
  skill: state.skills.echo
});
assert(state.skills.echo.duration > 2, 'Overlap Harmony falls back to live preview occurrences');

// Spoken Command recognizes a tail word from another equipped family.
state = createState(['echo', 'dash'], [
  word('echo', 'echo', ['spoken-command']),
  { word: word('dash', 'dash', []), index: 0, end: 4 },
  { word: word('coldash', 'freeze', []), index: -3, end: 4 }
]);
state.genome.letters = 'dash'.split('');
state.skills.dash.cooldown = 3;
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.SKILL_STARTED, {
  id: 'echo',
  skill: state.skills.echo
});
assert.strictEqual(state.skills.dash.cooldown, 0, 'Spoken Command readies a skill named by the genome tail');

// Decay Clock ticks after a Corrode weakening and gradually lowers remaining
// power without feeding the weakening event back into itself.
state = createState(['corrode'], [word('decay', 'corrode', ['decay-clock'])]);
const decayTarget = { id: 'decay', x: 20, y: 0, power: 100, originalPower: 100, corrodeTimer: 1 };
state.enemies = [decayTarget];
context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
  sourceId: 'corrode', target: decayTarget, amount: 0.2
});
state.time = 1;
context.SkillEffects.update(state, 1);
assert(decayTarget.power < 100 && decayTarget.decayClockTicks === 3, 'Decay Clock performs one scheduled tick');

// Rust Accumulation strengthens repeated Corrode applications.
state = createState(['corrode'], [word('rust', 'corrode', ['rust-accumulation'])]);
const rustTarget = { id: 'rust', power: 100, originalPower: 100 };
const firstRust = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'corrode', target: rustTarget, amount: 0.1
});
const secondRust = context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKEN, {
  sourceId: 'corrode', target: rustTarget, amount: 0.1
});
assert(secondRust.amount > firstRust.amount && rustTarget.rustStacks === 2, 'Rust Accumulation increases repeat corrosion');

// Three distinct weakening sources trigger one Entropy collapse. The nested
// entropy weakening is guarded and cannot recursively trigger another collapse.
state = createState(['corrode'], [word('entropy', 'corrode', ['entropy-counter'])]);
const entropyTarget = { id: 'entropy', x: 20, y: 0, power: 100, originalPower: 100, corrodeTimer: 3 };
state.enemies = [entropyTarget];
['shot', 'freeze', 'nova'].forEach((sourceId) => {
  context.SkillEffects.emit(state, context.SkillEffects.EVENTS.TARGET_WEAKENED, {
    sourceId, target: entropyTarget, amount: 0.05
  });
});
assert(entropyTarget.power < 100 && Object.keys(entropyTarget.entropySources).length === 0, 'Entropy Counter collapses once and resets its source set');

// Acid Trail must work with object identity even when an enemy has no id, and
// should weaken a nearby target exactly once per zone.
state = createState(['corrode'], [word('acid', 'corrode', ['acid-trail'])]);
const acidSource = { x: 0, y: 0, vx: 50, vy: 0, power: 100, corrodeTimer: 2 };
const acidTarget = { x: 40, y: 0, vx: 0, vy: 0, power: 100, originalPower: 100, corrodeTimer: 0 };
state.enemies = [acidSource, acidTarget];
state.time = 1;
context.SkillEffects.update(state, 0.8);
assert(acidTarget.power < 100 && acidSource.acidTrailAt > 1, 'Acid Trail weakens a nearby id-less target without duplicate hits');

console.log(JSON.stringify({ wave4: definitions.length, overlapLog: overlapPower.log, entropyPower: entropyTarget.power }, null, 2));
