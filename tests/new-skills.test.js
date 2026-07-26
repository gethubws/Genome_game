const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console,
  Math,
  Number,
  Set,
  GameConfig: {
    skills: {},
    palette: { gold: '#ffd36f', cyan: '#65e5ff', pink: '#ff6fa8' }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    rand: (min, max) => (min + max) / 2,
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    }
  },
  GameState: { createParticle: () => ({}) },
  ShotSkill: { burst: () => {} },
  GameUI: { toast: () => {} },
  WordSystem: { preview: (state) => { state.previewed = true; } },
  GenomeSystem: {
    isLockedIndex: (genome, index) => genome.lockedBlocks.some((block) => (
      index >= block.start && index < block.start + block.length
    ))
  },
  SkillSystem: { level: (state, id) => state.levels[id] || 0 }
};
context.window = context;
vm.createContext(context);

['growth', 'splice', 'echo', 'corrode'].forEach((name) => {
  vm.runInContext(fs.readFileSync(path.join(root, 'src/skills', name + '.js'), 'utf8'), context);
});

function createState() {
  return {
    paused: false,
    dt: 0.1,
    skills: {},
    levels: { growth: 1, splice: 2, echo: 1, corrode: 1 },
    player: { x: 0, y: 0, angle: 0 },
    input: { pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
    words: { unlocked: new Set(), occurrences: [], found: [] },
    genome: { letters: [], lockedBlocks: [] },
    enemies: [],
    boss: { active: null },
    particles: [],
    floatingTexts: [],
    recommendation: { dirty: false },
    uiDirty: false
  };
}

const growthState = createState();
assert.strictEqual(context.GrowthSkill.tryStart(growthState), true);
const boosted = context.GrowthSkill.modifyGrowthGain(growthState, 2, { dropType: 'growth' });
assert(boosted > 2);
assert.strictEqual(context.GrowthSkill.modifyGrowthGain(growthState, 2, { dropType: 'letter' }), 2);
assert.strictEqual(growthState.skills.growth.charges, 3);

const spliceState = createState();
spliceState.genome.letters = 'abcdef'.split('');
spliceState.genome.lockedBlocks = [{ word: 'bc', start: 1, length: 2 }];
assert.strictEqual(context.SpliceSkill.tryStart(spliceState), true);
assert.strictEqual(spliceState.genome.letters.slice(0, 2).join(''), 'bc');
assert.strictEqual(spliceState.genome.lockedBlocks[0].start, 0);
assert.strictEqual(spliceState.previewed, true);

const echoState = createState();
echoState.words.occurrences = [
  { word: { text: 'are', mult: 1.2 } },
  { word: { text: 'ware', mult: 1.8 } }
];
assert.strictEqual(context.EchoSkill.tryStart(echoState), true);
assert.strictEqual(echoState.skills.echo.word, 'ware');
assert(context.EchoSkill.getPowerMultiplier(echoState) > 1);

const corrodeState = createState();
corrodeState.enemies = [{ x: 100, y: 0, power: 20, radius: 10, kind: 'hunter' }];
corrodeState.boss.active = { x: 180, y: 0, power: 100, radius: 30, boss: true };
assert.strictEqual(context.CorrodeSkill.tryStart(corrodeState), true);
assert(corrodeState.boss.active.power < 100);
assert.strictEqual(corrodeState.enemies[0].power, 20);

console.log(JSON.stringify({
  growthGain: boosted,
  splicedGenome: spliceState.genome.letters.join(''),
  echoedWord: echoState.skills.echo.word,
  corrodedBossPower: corrodeState.boss.active.power
}, null, 2));
