const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadWordSystem(commonWords) {
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
    CommonWordList: commonWords || [],
    Utils: { pick: (items) => items[0] }
  };
  context.window = context;
  vm.createContext(context);
  if (!commonWords) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/data/common-words.js'), 'utf8'), context);
  }
  vm.runInContext(fs.readFileSync(path.join(root, 'src/data/skill-word-map.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/data/skill-effect-traits.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/words.js'), 'utf8'), context);
  return context;
}

function countWord(occurrences, text) {
  return occurrences.filter((entry) => entry.word.text === text).length;
}

const context = loadWordSystem();
const words = context.WordSystem;

const overlapping = words.findOccurrences('warear');
assert(overlapping.some((entry) => entry.word.text === 'ware' && entry.index === 0));
assert(overlapping.some((entry) => entry.word.text === 'are' && entry.index === 1));
assert(overlapping.some((entry) => entry.word.text === 'ear' && entry.index === 3));

const repeated = words.findOccurrences('wavewave');
assert.strictEqual(countWord(repeated, 'wave'), 2);
assert.strictEqual(countWord(repeated, 'ave'), 2);

assert.strictEqual(countWord(words.findOccurrences('isin'), 'is'), 1);
assert.strictEqual(countWord(words.findOccurrences('isin'), 'in'), 1);
assert.strictEqual(words.byText.wave.skill, 'nova');
[
  'dash', 'shot', 'nova', 'guard', 'freeze',
  'scan', 'growth', 'splice', 'echo', 'corrode'
].forEach((skillId) => {
  const word = words.byText[skillId];
  assert(word, 'missing core skill word: ' + skillId);
  assert.strictEqual(word.family, skillId);
  assert.strictEqual(word.skill, skillId);
  assert.strictEqual(word.variant, 'core');
  assert.strictEqual(word.coreSkillWord, true);
  assert(word.affinity > 1, 'core word should have stronger affinity: ' + skillId);
});
assert.strictEqual(words.byText.echo.family, 'echo');

const specializedCounts = {};
words.all.forEach((word) => {
  if (!word.family || word.coreSkillWord) return;
  assert.strictEqual(word.baseFamilyWord, true, 'ordinary family words retain base potency: ' + word.text);
  assert(word.effectTrait, 'ordinary family word lacks an effect trait: ' + word.text);
  assert(word.traits.includes(word.effectTrait), 'effect trait missing from trait list: ' + word.text);
  specializedCounts[word.family] = specializedCounts[word.family] || {};
  specializedCounts[word.family][word.effectTrait] = (specializedCounts[word.family][word.effectTrait] || 0) + 1;
});
Object.entries(context.SkillEffectTraitCatalog).forEach(([family, branches]) => {
  const assigned = specializedCounts[family] || {};
  branches.forEach((branch) => assert(assigned[branch] > 0, family + ' branch has no mapped ordinary words: ' + branch));
});

const semanticEntries = Array.from(context.SkillEffectSemanticEntries);
const semanticWords = new Set(semanticEntries.map((entry) => entry.word));
const invalidSemanticMappings = [];
assert.strictEqual(semanticEntries.length, 80, 'every non-base effect branch needs one direct semantic trigger');
assert.strictEqual(semanticWords.size, semanticEntries.length, 'semantic trigger words must not compete across families');

semanticEntries.forEach((entry) => {
  const mapped = words.byText[entry.word];
  const metadata = context.SkillWordMap[entry.word];
  if (
    !mapped
    || mapped.family !== entry.family
    || mapped.effectTrait !== entry.trait
    || !mapped.traits.includes(entry.trait)
    || mapped.semanticFamilyWord !== true
    || mapped.variant !== 'base'
    || (metadata && metadata.core)
  ) {
    invalidSemanticMappings.push(entry.word + ':' + entry.family + '.' + entry.trait);
  }
});
assert.deepStrictEqual(invalidSemanticMappings, [], 'semantic effect words must resolve to their authored family and trait');

Object.entries(context.SkillEffectTraitCatalog).forEach(([family, branches]) => {
  branches.filter((branch) => branch !== 'base').forEach((branch) => {
    assert(
      semanticEntries.some((entry) => entry.family === family && entry.trait === branch),
      family + ' branch lacks a direct semantic trigger: ' + branch
    );
  });
});

const directedExamples = {
  chain: ['nova', 'chain-pulse'],
  repeater: ['shot', 'repeater-circuit'],
  vortex: ['nova', 'feeding-vortex'],
  bastion: ['guard', 'word-bastion'],
  symbiosis: ['growth', 'symbiotic-intake'],
  memory: ['echo', 'lost-word-memory'],
  clock: ['corrode', 'decay-clock']
};
Object.entries(directedExamples).forEach(([text, expected]) => {
  assert.strictEqual(context.SkillEffectFamilyForWord(text), expected[0]);
  assert.strictEqual(context.SkillEffectTraitForWord(text, expected[0], 'base'), expected[1]);
  assert.strictEqual(words.byText[text].family, expected[0]);
  assert.strictEqual(words.byText[text].effectTrait, expected[1]);
});

// Rendezvous selection depends on trait ids, not their array positions.
const fallbackSamples = [
  ['dash', 'lantern'], ['shot', 'marble'], ['nova', 'orchard'], ['guard', 'planet'], ['freeze', 'quartz'],
  ['scan', 'ribbon'], ['growth', 'saffron'], ['splice', 'timber'], ['echo', 'velvet'], ['corrode', 'whistle']
];
const beforeReorder = fallbackSamples.map(([family, text]) => context.SkillEffectTraitForWord(text, family, 'base'));
Object.values(context.SkillEffectTraitCatalog).forEach((branches) => branches.reverse());
const afterReorder = fallbackSamples.map(([family, text]) => context.SkillEffectTraitForWord(text, family, 'base'));
Object.values(context.SkillEffectTraitCatalog).forEach((branches) => branches.reverse());
assert.deepStrictEqual(afterReorder, beforeReorder, 'fallback trait assignments must survive catalog reordering');

// Exact skill words keep the legacy core variant while exposing the mapped
// semantic branch for the expanded skill catalog.
const coreBranches = {
  dash: 'burst',
  shot: 'bolt',
  nova: 'nova',
  guard: 'guard',
  freeze: 'freeze',
  scan: 'scan',
  growth: 'surge',
  splice: 'splice',
  echo: 'echo',
  corrode: 'corrode'
};
Object.entries(coreBranches).forEach(([skillId, branch]) => {
  const word = words.byText[skillId];
  assert.strictEqual(word.variant, 'core');
  assert.strictEqual(word.coreVariant, branch);
  assert(word.traits.includes(branch));
  assert(word.traits.includes('core'));
});

// Generated semantic-core entries that are not exact skill names retain their
// concrete variant while still advertising the core trait.
assert.strictEqual(words.byText.join.variant, 'join');
assert.strictEqual(words.byText.join.coreVariant, 'join');
assert.strictEqual(words.byText.join.coreSkillWord, true);
assert(words.byText.join.traits.includes('join'));
assert(words.byText.join.traits.includes('core'));

const familyToSkill = {
  movement: 'dash', hunt: 'shot', pulse: 'nova', guard: 'guard', control: 'freeze',
  sense: 'scan', growth: 'growth', genome: 'splice', expression: 'echo', corrosion: 'corrode'
};
const exactCoreFamilies = {
  dash: 'dash', shot: 'shot', nova: 'nova', guard: 'guard', freeze: 'freeze',
  scan: 'scan', growth: 'growth', splice: 'splice', echo: 'echo', corrode: 'corrode'
};
Object.entries(context.SkillWordMap).forEach(([text, metadata]) => {
  if (!metadata.core || !words.byText[text]) return;
  const word = words.byText[text];
  const expectedFamily = exactCoreFamilies[text] || familyToSkill[metadata.family];
  assert.strictEqual(word.family, expectedFamily, 'semantic mapping must not move a core word: ' + text);
  assert.strictEqual(word.coreSkillWord, true, 'generated core marker was lost: ' + text);
  assert.strictEqual(word.semanticFamilyWord, false, 'core word was incorrectly marked as a semantic override: ' + text);
  assert(word.traits.includes('core'), 'core trait missing: ' + text);
  if (metadata.variant !== 'base') assert(word.traits.includes(metadata.variant), 'core variant missing: ' + text);
});

const repeatedProduct = words.multiplierDetails([
  { word: { mult: 2 } },
  { word: { mult: 2 } },
  { word: { mult: 2 } }
]);
assert(Math.abs(repeatedProduct.value - 8) < 1e-12);
assert(Math.abs(repeatedProduct.log - Math.log(8)) < 1e-12);

const overflow = words.multiplierDetails(Array.from({ length: 1200 }, () => ({ word: { mult: 2 } })));
assert.strictEqual(overflow.value, Number.MAX_VALUE);
assert.strictEqual(overflow.overflow, true);
assert.match(words.formatMultiplier(overflow.value, overflow.log), /^x\d+\.\d+e\+\d+$/);

const eSuggestion = words.tailSuggestions('war').find((entry) => entry.letter === 'e');
assert(eSuggestion);
assert(eSuggestion.words.some((word) => word.text === 'ware'));
assert(eSuggestion.words.some((word) => word.text === 'are'));

const longContext = loadWordSystem(['abcdefghijklmnop']);
assert.strictEqual(longContext.WordSystem.maxWordLength, 16);
assert.strictEqual(countWord(longContext.WordSystem.findOccurrences('abcdefghijklmnop'), 'abcdefghijklmnop'), 1);

context.MapSystem = {
  findBestRegionForLetters: () => null
};
vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/recommendations.js'), 'utf8'), context);
const state = {
  genome: { letters: ['w', 'a', 'r'], capacity: 20 },
  map: { currentLayer: 1 },
  recommendation: { dirty: true, signature: '' },
  uiDirty: false
};
context.RecommendationSystem.update(state);
assert(state.recommendation.tailSuggestions.some((entry) => entry.letter === 'e'));
assert(state.recommendation.nextLetters.includes('e'));

console.log(JSON.stringify({
  dictionarySize: words.all.length,
  maxWordLength: words.maxWordLength,
  warear: overlapping.map((entry) => entry.word.text + '@' + entry.index),
  waveCount: countWord(repeated, 'wave'),
  aveCount: countWord(repeated, 'ave'),
  semanticTriggers: semanticEntries.length,
  invalidSemanticMappings: invalidSemanticMappings.length,
  tailLetters: words.tailSuggestions('war', 8).map((entry) => entry.letter)
}, null, 2));
