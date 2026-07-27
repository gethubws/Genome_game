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
  GameConfig: {
    skills: {
      scan: { cooldown: 4.8, duration: 0.82, radius: 350, revealTime: 2 },
      shot: { cooldown: 0.82, speed: 560, life: 1.15, radius: 5, weaken: 0.32 },
      nova: { cooldown: 6.2, radius: 255, weaken: 0.42 },
      freeze: { cooldown: 7.2, radius: 310, duration: 3.2 },
      corrode: { cooldown: 7.8, range: 520, weaken: 0.26, duration: 3.5 }
    },
    palette: { cyan: '#65e5ff', mint: '#64f0b6', pink: '#ff6fa8' }
  },
  Utils: {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    dist2: (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2,
    normalize: (x, y) => {
      const distance = Math.hypot(x, y) || 1;
      return { x: x / distance, y: y / distance };
    },
    rand: (min, max) => (min + max) / 2
  },
  SkillSystem: { potency: () => 0, level: () => 0 },
  ShotSkill: { burst: () => {} },
  GameState: { createParticle: () => ({}) },
  GameUI: { toast: () => {} },
  I18n: { t: (_key, fallback) => fallback }
};
context.window = context;
vm.createContext(context);

['src/skills/scan.js', 'src/skills/shot.js', 'src/skills/nova.js', 'src/skills/freeze.js', 'src/skills/corrode.js']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context));
vm.runInContext(fs.readFileSync(path.join(root, 'src/systems/render.js'), 'utf8'), context);

assert.strictEqual(context.RenderSystem.canShowTargetPower(enemy('letter')), false);
assert.strictEqual(context.RenderSystem.canShowTargetPower(Object.assign(enemy('letter'), { hurt: 1 })), false);
assert.strictEqual(context.RenderSystem.canShowTargetPower(Object.assign(enemy('letter'), { revealed: 0.4 })), true);
assert.strictEqual(context.RenderSystem.canShowTargetPower(Object.assign(enemy('boss'), { boss: true })), true);

function enemy(kind) {
  return { id: kind, kind, x: 30, y: 0, radius: 10, power: 20, originalPower: 20, revealed: 0, hurt: 0, frozen: 0 };
}

const scanTarget = enemy('letter');
scanTarget.x = 60;
const scanState = {
  dt: 0.1,
  player: { x: 0, y: 0 },
  skills: { scan: { active: true, age: 0.5, duration: 1, radius: 100, revealTime: 2, hits: new Set() } },
  enemies: [scanTarget],
  boss: { active: null }
};
context.ScanSkill.update(scanState);
assert(scanTarget.revealed > 0);

const shotTarget = enemy('spitter');
const shotState = {
  dt: 0.1,
  paused: false,
  player: { x: 0, y: 0, angle: 0, radius: 20 },
  input: { pointer: { x: 0, y: 0, worldX: 0, worldY: 0 } },
  skills: { shot: { cooldown: 0 } },
  bullets: [{ x: 30, y: 0, vx: 0, vy: 0, radius: 5, life: 1, weaken: 0.2, color: '#fff' }],
  particles: [],
  enemies: [shotTarget],
  boss: { active: null }
};
context.ShotSkill.update(shotState);
assert.strictEqual(shotTarget.revealed, 0);
assert(shotTarget.hurt > 0);

const novaTarget = enemy('hunter');
const novaState = {
  paused: false,
  player: { x: 0, y: 0 },
  skills: { nova: { cooldown: 0, active: false, age: 0, radius: 0 } },
  enemies: [novaTarget],
  boss: { active: null },
  particles: []
};
context.NovaSkill.tryStart(novaState);
assert.strictEqual(novaTarget.revealed, 0);

const freezeTarget = enemy('hunter');
const freezeState = {
  paused: false,
  player: { x: 0, y: 0 },
  skills: { freeze: { cooldown: 0 } },
  enemies: [freezeTarget],
  boss: { active: null },
  particles: []
};
context.FreezeSkill.tryStart(freezeState);
assert.strictEqual(freezeTarget.revealed, 0);
assert(freezeTarget.frozen > 0);

const corrodeTarget = enemy('hunter');
const corrodeState = {
  paused: false,
  player: { x: 0, y: 0 },
  skills: { corrode: { cooldown: 0, active: false } },
  enemies: [corrodeTarget],
  boss: { active: null },
  input: { pointer: { x: 30, y: 0, worldX: 30, worldY: 0 } },
  floatingTexts: [],
  uiDirty: false
};
context.CorrodeSkill.applyToTarget(corrodeState, corrodeTarget, 0);
assert.strictEqual(corrodeTarget.revealed, 0);
assert(corrodeTarget.hurt > 0);

console.log('scan privacy tests passed');
