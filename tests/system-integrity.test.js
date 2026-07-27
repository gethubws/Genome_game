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
    maxGenomeCapacity: 20,
    palette: { gold: '#ffd36f', pink: '#ff6fa8' }
  },
  Utils: {
    pick: (items) => items[0],
    storageSet: () => {}
  },
  GameUI: { toast: () => {} },
  I18n: { t: (_key, fallback) => fallback }
};
context.window = context;
vm.createContext(context);

function load(relativePath) {
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context);
}

load('src/data/common-words.js');
load('src/data/skill-word-map.js');
load('src/systems/words.js');

// The skill definitions reference their runtime APIs lazily. Empty APIs keep
// this integrity test focused on the data contract rather than skill behavior.
[
  'Dash', 'Shot', 'Nova', 'Guard', 'Freeze',
  'Scan', 'Growth', 'Splice', 'Echo', 'Corrode'
].forEach((name) => {
  context[name + 'Skill'] = { tryStart: () => false, charge: () => 0 };
});
load('src/systems/skills.js');

const words = context.WordSystem;
const blockedWords = new Set([
  'fucking', 'incest', 'anal', 'cum', 'milf',
  'porno', 'hentai', 'bondage', 'tits', 'cock', 'shemale'
]);

Object.keys(context.SkillWordMap).forEach((text) => {
  if (blockedWords.has(text)) return;
  assert(words.byText[text], `skill-word map entry is missing from the dictionary: ${text}`);
});

context.SkillSystem.definitions.forEach((definition) => {
  definition.words.forEach((text) => {
    assert(words.byText[text], `skill prompt word is missing from the dictionary: ${definition.id}/${text}`);
  });
});

blockedWords.forEach((text) => {
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(words.byText, text),
    false,
    `blocked word must not be available in the dictionary: ${text}`
  );
});

load('src/systems/genome.js');

const sequence = 'informationavailable';
assert.strictEqual(sequence.length, 20);
const state = {
  time: 0,
  genome: {
    capacity: 20,
    letters: sequence.split(''),
    lockedBlocks: [],
    maxLockedBlocks: 2
  },
  words: {
    potentialFound: [],
    potentialOccurrences: [],
    unlocked: new Set()
  },
  player: { x: 0, y: 0 },
  floatingTexts: [],
  uiDirty: false
};

words.preview(state);
const firstLock = context.GenomeSystem.lockCurrentWordBlock(state);
const secondLock = context.GenomeSystem.lockCurrentWordBlock(state);
assert(firstLock, 'the first genome lock should be created');
assert(secondLock, 'the second genome lock should be created');
assert.deepStrictEqual(
  state.genome.lockedBlocks.map((block) => block.word).sort(),
  ['available', 'information']
);
assert(
  state.genome.letters.every((_letter, index) => context.GenomeSystem.isLockedIndex(state.genome, index)),
  'the fixture must have every genome slot locked before adding a word'
);

context.GenomeSystem.addWord(state, { text: 'corrode' });
const resultingGenome = state.genome.letters.join('');
assert(resultingGenome.endsWith('corrode'), 'a complete added word should remain contiguous in the genome');
assert(state.genome.letters.length <= state.genome.capacity, 'genome must stay within capacity after adding a word');

console.log(JSON.stringify({
  dictionarySize: words.all.length,
  skillMapEntries: Object.keys(context.SkillWordMap).length,
  lockedBlocks: state.genome.lockedBlocks,
  resultingGenome
}, null, 2));
