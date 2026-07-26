const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const deterministicMath = Object.create(Math);
deterministicMath.random = () => 0.5;
const context = {
  console,
  Math: deterministicMath,
  Number,
  localStorage: { getItem: () => null }
};
context.window = context;
vm.createContext(context);

['src/core/config.js', 'src/core/utils.js'].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
});

context.MapSystem = {
  queryPoint: () => ({ layerIndex: 1, danger: 0, dropChance: 0.25 }),
  pickBiasLetter: () => 'a',
  bossGateNearPlayer: () => null
};
context.CombatSystem = { effectivePower: () => 1 };
context.GameUI = { toast: () => {} };
context.I18n = { t: (_key, fallback) => fallback };
vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/enemies.js'), 'utf8'), context);

assert.deepStrictEqual(
  [1, 2, 3, 4].map((layer) => context.EnemySystem.bossPowerForLayer(layer)),
  [42, 84, 168, 336]
);

const powerSamples = [0.1, 1, 8, 21, 42, 84, 168, 336, 1000000];
const radii = powerSamples.map((power) => context.Utils.powerRadius(power));
radii.forEach((radius, index) => {
  assert(Number.isFinite(radius));
  if (index > 0) assert(radius > radii[index - 1]);
});
assert.strictEqual(context.Utils.powerRadius(42), context.Utils.powerRadius(42));
assert.strictEqual(context.Utils.powerRadius(42), context.Utils.powerRadiusFromLog(Math.log(42)));
assert(context.Utils.powerRadius(Number.MAX_VALUE) <= context.GameConfig.combat.radiusBase + context.GameConfig.combat.radiusMaxBonus);
assert.strictEqual(context.Utils.powerRadius(Infinity), context.GameConfig.combat.radiusBase + context.GameConfig.combat.radiusMaxBonus);

context.GameConfig.enemies.denseCoreChance = 0;
const state = { time: 0 };
const first = context.EnemySystem.createEnemy(state, 0, 0, { kind: 'letter' });
const second = context.EnemySystem.createEnemy(state, 0, 0, { kind: 'letter' });
assert.strictEqual(first.power, second.power);
assert.strictEqual(first.radius, second.radius);
assert.strictEqual(first.radius, context.Utils.powerRadius(first.power));

context.GameConfig.enemies.denseCoreChance = 1;
const dense = context.EnemySystem.createEnemy(state, 0, 0, { kind: 'letter' });
assert.strictEqual(dense.denseCore, true);
assert(dense.radius < context.Utils.powerRadius(dense.power));

// Boss creation must not inherit a random normal-fish drop type or damage
// profile before its kind is overwritten.
context.GameConfig.enemies.targetCount = 0;
deterministicMath.random = () => 0.1;
context.MapSystem.bossGateNearPlayer = () => ({
  id: 'gate-1',
  layerIndex: 1,
  x: 0,
  y: 300,
  roomWidth: 860,
  roomHeight: 620,
  final: false,
  bypassed: false
});
const bossState = {
  time: 0,
  dt: 0.016,
  tick: 0,
  player: { x: 0, y: 300 },
  camera: { x: 0, y: 300 },
  screen: { width: 1280, height: 720 },
  map: { height: 14400 },
  enemies: [],
  enemyBullets: [],
  boss: { active: null, notice: 0 }
};
context.EnemySystem.update(bossState);
assert(bossState.boss.active);
assert.strictEqual(bossState.boss.active.kind, 'boss');
assert.strictEqual(bossState.boss.active.dropType, 'letter');
assert.strictEqual(bossState.boss.active.fixedDrop, true);
assert.strictEqual(bossState.boss.active.power, 42);

console.log('boss balance tests passed');
