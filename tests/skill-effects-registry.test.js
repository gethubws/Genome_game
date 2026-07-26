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
  JSON,
  isFinite,
  SkillSystem: {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, 'src/systems/skill-effects.js'), 'utf8'),
  context
);

const effects = context.SkillEffects;
const EVENTS = effects.EVENTS;

function approximate(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);
}

function createState() {
  return {
    dt: 0.1,
    time: 4,
    player: { activeSlots: ['shot', 'scan', null] },
    genome: { letters: 'boltscan'.split('') },
    words: {
      revision: 1,
      occurrences: [],
      potentialOccurrences: [
        { word: { text: 'bolt', family: 'shot', variant: 'bolt', affinity: 1.5 } },
        { word: { text: 'shoot', family: 'shot', traits: ['bolt'], affinity: 1 } },
        { word: { text: 'spit', family: 'shot', traitWeights: { bolt: 0.5 }, affinity: 2 } },
        { word: { text: 'shot', family: 'shot', variant: 'core', traits: ['bolt'], coreSkillWord: true, affinity: 1.65 } },
        { word: { text: 'scan', family: 'scan', variant: 'scan', affinity: 1.2 } }
      ]
    }
  };
}

assert.strictEqual(context.SkillSystem.effects, effects);
assert.strictEqual(context.SkillSystem.registerEffect, effects.register);

const order = [];
effects.register([
  {
    id: 'shot.bolt-pierce',
    family: 'shot',
    trait: 'bolt',
    priority: 20,
    defaults: { ticks: 0 },
    hooks: {
      [EVENTS.TARGET_WEAKEN]: (event, effect) => {
        order.push(effect.id);
        event.amount += effect.traitPotency * 0.01;
      }
    },
    update: (_event, effect) => { effect.state.ticks += 1; }
  },
  {
    id: 'shot.core-focus',
    family: 'shot',
    trait: 'core',
    priority: 5,
    hooks: {
      [EVENTS.TARGET_WEAKEN]: (_event, effect) => { order.push(effect.id); }
    }
  },
  {
    id: 'shot.scan-lock',
    family: 'shot',
    trait: 'bolt',
    priority: 20,
    requires: {
      equipped: ['scan'],
      traits: [{ family: 'scan', trait: 'scan' }]
    },
    hooks: {
      [EVENTS.TARGET_WEAKEN]: (_event, effect) => { order.push(effect.id); }
    }
  },
  {
    id: 'shot.family-generic',
    family: 'shot',
    requireTrait: false,
    priority: 30,
    hooks: {
      [EVENTS.TARGET_WEAKEN]: () => ({ genericTriggered: true })
    }
  },
  {
    id: 'guard.inactive',
    family: 'guard',
    trait: 'shield',
    hooks: {
      [EVENTS.TARGET_WEAKEN]: () => { throw new Error('unequipped effect ran'); }
    }
  }
]);

const state = createState();
approximate(effects.rawPotency(state, 'shot', 'bolt'), 5.15, 'overlapping trait potency counts every occurrence and weight');
approximate(effects.rawPotency(state, 'shot', 'core'), 1.65, 'core remains available as a compatibility trait');
approximate(effects.rawPotency(state, 'shot'), 6.15, 'family potency counts all family occurrences');

const firstRuntime = effects.compile(state);
assert.strictEqual(effects.compile(state), firstRuntime, 'unchanged state should reuse the compiled runtime');
assert.deepStrictEqual(
  Array.from(firstRuntime.active, (entry) => entry.id),
  ['shot.core-focus', 'shot.bolt-pierce', 'shot.scan-lock', 'shot.family-generic']
);

const weakenEvent = effects.emit(state, EVENTS.TARGET_WEAKEN, { amount: 0.2 });
assert.deepStrictEqual(Array.from(order), [
  'shot.core-focus',
  'shot.bolt-pierce',
  'shot.scan-lock'
]);
assert.strictEqual(weakenEvent.genericTriggered, true);
assert(weakenEvent.amount > 0.2, 'a hook may modify a documented event field');

effects.update(state, state.dt);
effects.update(state, state.dt);
assert.strictEqual(effects.effectState(state, 'shot.bolt-pierce').ticks, 2);

// Composite traits use OR semantics and count a multi-tagged occurrence once.
effects.register({
  id: 'shot.bolt-or-core',
  family: 'shot',
  traits: ['bolt', 'core'],
  hooks: {}
});
const composite = effects.get(state, 'shot.bolt-or-core');
assert.deepStrictEqual(Array.from(composite.traits), ['bolt', 'core']);
approximate(composite.rawTraitPotency, 5.15, 'composite potency does not double-count the core bolt occurrence');

// Base matches ordinary family words with no concrete branch, but not core.
state.words.potentialOccurrences.push(
  { word: { text: 'plain-a', family: 'shot', affinity: 0.8 } },
  { word: { text: 'plain-b', family: 'shot', variant: 'base', traits: [], affinity: 0.9 } },
  { word: { text: 'plain-weighted', family: 'shot', variant: 'base', traitWeights: { base: 0.5 }, affinity: 2 } },
  { word: { text: 'tagged-base', family: 'shot', variant: 'base', traits: ['bolt'], affinity: 2 } },
  { word: { text: 'core-only', family: 'shot', variant: 'core', traits: [], coreSkillWord: true, affinity: 2 } }
);
state.words.revision += 1;
approximate(effects.rawPotency(state, 'shot', 'base'), 2.7, 'base includes untagged words and honors an explicit base weight');
effects.register({ id: 'shot.base-current', family: 'shot', trait: 'base', hooks: {} });
assert.strictEqual(effects.has(state, 'shot.base-current'), true);

state.player.activeSlots[1] = null;
assert.strictEqual(effects.has(state, 'shot.scan-lock'), false, 'cross-family effect requires every equipped skill');
assert.strictEqual(effects.has(state, 'shot.bolt-pierce'), true);

state.words.potentialOccurrences = state.words.potentialOccurrences.filter((entry) => entry.word.variant !== 'core');
state.words.revision += 1;
assert.strictEqual(effects.has(state, 'shot.core-focus'), false, 'word revision recompiles trait activation');

effects.register({
  id: 'shot.family-generic',
  family: 'shot',
  requireTrait: false,
  priority: 1,
  hooks: {}
});
assert.strictEqual(
  effects.definitions.filter((definition) => definition.id === 'shot.family-generic').length,
  1,
  'registering an existing id replaces rather than duplicates it'
);
assert.strictEqual(effects.get(state, 'shot.family-generic').definition.priority, 1);

effects.resetEffectState(state, 'shot.bolt-pierce');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.effectState(state, 'shot.bolt-pierce', { ticks: 0 }))),
  { ticks: 0 }
);
effects.effectState(state, 'shot.family-generic', { primed: true });
assert(effects.resetFamilyState(state, 'shot') >= 2);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.effectState(state, 'shot.family-generic', { primed: false }))),
  { primed: false },
  'unequipping a family can clear all of its passive effect state'
);

// Losing one trait word must clear only that effect even when another word
// keeps the same skill family powered. Ordinary delayed work is owned by the
// effect and must not survive its deactivation.
let traitCleanupCalls = 0;
let staleTraitCallbackRan = false;
effects.register({
  id: 'shot.trait-cleanup',
  family: 'shot',
  trait: 'bolt',
  defaults: { primed: true },
  cleanup: (_state, effect) => {
    traitCleanupCalls += 1;
    effect.state.primed = false;
  },
  hooks: {}
});
const traitEntry = effects.get(state, 'shot.trait-cleanup');
assert(traitEntry && traitEntry.state.primed);
traitEntry.schedule(1, () => { staleTraitCallbackRan = true; });
state.words.potentialOccurrences = state.words.potentialOccurrences.filter((entry) => {
  const word = entry.word || {};
  return word.variant !== 'bolt' &&
    !(word.traits || []).includes('bolt') &&
    !(word.traitWeights && Number(word.traitWeights.bolt) > 0);
});
state.words.revision += 1;
assert.strictEqual(effects.has(state, 'shot.trait-cleanup'), false);
assert.strictEqual(traitCleanupCalls, 1, 'trait loss runs effect cleanup exactly once');
assert.strictEqual(state.skillEffectState['shot.trait-cleanup'], undefined, 'trait loss discards stale effect state');
effects.update(state, 1);
assert.strictEqual(staleTraitCallbackRan, false, 'trait loss cancels ordinary delayed work');
state.words.potentialOccurrences.push({ word: { text: 'bolt-return', family: 'shot', traits: ['bolt'], affinity: 1 } });
state.words.revision += 1;
assert.strictEqual(effects.get(state, 'shot.trait-cleanup').state.primed, true, 'restored trait words receive fresh default state');
assert.strictEqual(traitCleanupCalls, 1, 'reactivation does not repeat cleanup');

// Delayed work executes by due time, then insertion order for equal due times.
const scheduleOrder = [];
effects.register({
  id: 'shot.timer',
  family: 'shot',
  trait: 'bolt',
  defaults: { armed: false },
  update: (_event, effect) => {
    if (effect.state.armed) return;
    effect.state.armed = true;
    effect.schedule(2, () => { scheduleOrder.push('late'); });
    effect.schedule(1, () => { scheduleOrder.push('early-a'); });
    effect.schedule(1, () => { scheduleOrder.push('early-b'); });
  }
});
const timerState = createState();
effects.update(timerState, 0);
effects.update(timerState, 1);
assert.deepStrictEqual(scheduleOrder, ['early-a', 'early-b']);
effects.update(timerState, 1);
assert.deepStrictEqual(scheduleOrder, ['early-a', 'early-b', 'late']);

let cancelledCallbackRan = false;
const cancelledHandle = effects.schedule(timerState, 1, () => { cancelledCallbackRan = true; });
assert.strictEqual(effects.cancelScheduled(timerState, cancelledHandle), true);
effects.update(timerState, 1);
assert.strictEqual(cancelledCallbackRan, false);

let ownerCancelledCallbackRan = false;
effects.schedule(timerState, 1, () => { ownerCancelledCallbackRan = true; }, { ownerId: 'shot.timer' });
assert.strictEqual(effects.cancelScheduled(timerState, 'shot.timer'), true, 'a family/effect owner can cancel its pending work');
effects.update(timerState, 1);
assert.strictEqual(ownerCancelledCallbackRan, false);

// Entry-owned work is cancelled automatically when its effect becomes inactive.
let inactiveCallbackRan = false;
effects.get(timerState, 'shot.timer').schedule(1, () => { inactiveCallbackRan = true; });
timerState.player.activeSlots[0] = null;
effects.invalidate(timerState);
effects.update(timerState, 1);
assert.strictEqual(inactiveCallbackRan, false);

assert.strictEqual(effects.unregister('guard.inactive'), true);
assert.strictEqual(effects.unregister('guard.inactive'), false);

console.log(JSON.stringify({
  registered: effects.definitions.length,
  active: effects.active(state).map((entry) => entry.id),
  boltRawPotency: effects.rawPotency(state, 'shot', 'bolt'),
  hookOrder: order
}, null, 2));
