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
  tailLetters: words.tailSuggestions('war', 8).map((entry) => entry.letter)
}, null, 2));
