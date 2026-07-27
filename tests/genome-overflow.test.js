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
  GameConfig: { palette: { gold: '#ffd36f', pink: '#ff6fa8' }, maxGenomeCapacity: 32 },
  WordSystem: { preview: (state) => { state.words.potentialFound = []; } },
  GameUI: { toast: () => {} },
  I18n: { t: (_key, fallback) => fallback },
  Utils: {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/genome.js'), 'utf8'), context);

// A stale lock range that covers the incoming factor must not leave the
// queue over capacity or spin forever looking for an unlocked index.
const state = {
  time: 0,
  genome: {
    capacity: 2,
    letters: ['a', 'b'],
    lockedBlocks: [{ word: 'abc', start: 0, length: 3 }],
    maxLockedBlocks: 2
  },
  words: { potentialFound: [], unlocked: new Set() },
  player: { x: 0, y: 0 },
  floatingTexts: [],
  uiDirty: false
};

assert.doesNotThrow(() => context.GenomeSystem.addLetter(state, 'c', 'test'));
assert.strictEqual(state.genome.letters.length, state.genome.capacity);
assert.deepStrictEqual(Array.from(state.genome.letters), ['a', 'b']);
assert.strictEqual(state.genome.lockedBlocks.length, 0);
assert(state.floatingTexts.some((entry) => entry.text.indexOf('C') !== -1));

console.log('genome overflow tests passed');
