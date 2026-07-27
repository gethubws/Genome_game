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
  GameConfig: { palette: {} }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scriptSources = Array.from(indexHtml.matchAll(/<script\s+src="([^"]+)"/g), (match) => match[1]);
const scriptFiles = scriptSources.map((source) => source.split('?')[0]);
const requiredScriptOrder = [
  'src/data/common-words.js',
  'src/data/skill-word-map.js',
  'src/data/skill-effect-traits.js',
  'src/systems/words.js',
  'src/skills/corrode.js',
  'src/systems/skills.js',
  'src/systems/skill-effects.js',
  'src/skills/effects-wave1.js',
  'src/skills/effects-wave2.js',
  'src/skills/effects-wave3.js',
  'src/skills/effects-wave4.js',
  'src/ui/hud.js',
  'src/systems/render.js',
  'src/game.js'
];

let previousScriptIndex = -1;
requiredScriptOrder.forEach((file) => {
  const index = scriptFiles.indexOf(file);
  assert(index >= 0, 'index.html is missing script: ' + file);
  assert(index > previousScriptIndex, file + ' is loaded out of dependency order');
  assert(fs.existsSync(path.join(root, file)), 'script tag points to a missing file: ' + file);
  const source = scriptSources[index];
  assert(/\?v=\d{8}-\d+$/.test(source), file + ' is missing a cache version');
  previousScriptIndex = index;
});

load('src/data/common-words.js');
load('src/data/skill-word-map.js');
load('src/data/skill-effect-traits.js');
load('src/systems/words.js');
load('src/systems/skill-effects.js');
load('src/skills/effects-wave1.js');
load('src/skills/effects-wave2.js');
load('src/skills/effects-wave3.js');
load('src/skills/effects-wave4.js');

const definitions = context.SkillEffects.definitions;
const families = [
  'dash', 'shot', 'nova', 'guard', 'freeze',
  'scan', 'growth', 'splice', 'echo', 'corrode'
];

assert.strictEqual(definitions.length, 100, 'the full catalog must contain exactly 100 effects');
assert.strictEqual(new Set(definitions.map((definition) => definition.id)).size, 100, 'effect ids must be unique');

function wordSupportsDefinition(word, definition) {
  if (!word || (word.family || word.skill) !== definition.family || word.text.length > 20) return false;
  if (!definition.traits.length) return true;
  return definition.traits.some((trait) => {
    if (trait === 'base') return word.baseFamilyWord === true || (word.variant === 'base' && !word.coreSkillWord);
    if (trait === 'core') return word.coreSkillWord === true;
    return word.variant === trait || (Array.isArray(word.traits) && word.traits.includes(trait));
  });
}

const reachableSources = {};
definitions.forEach((definition) => {
  const sources = context.WordSystem.all.filter((word) => wordSupportsDefinition(word, definition));
  assert(sources.length > 0, definition.id + ' has no trigger word that fits the 20-slot genome');
  reachableSources[definition.id] = sources;
});

families.forEach((family) => {
  const familyEffects = definitions.filter((definition) => definition.family === family);
  assert.strictEqual(familyEffects.length, 10, family + ' must contain ten effects');
  familyEffects.forEach((definition) => {
    assert(definition.name && definition.name.trim(), definition.id + ' lacks an English name');
    assert(definition.nameZh && definition.nameZh.trim(), definition.id + ' lacks a Chinese name');
    assert(definition.description && definition.description.trim(), definition.id + ' lacks an English description');
    assert(definition.descriptionZh && definition.descriptionZh.trim(), definition.id + ' lacks a Chinese description');
  });

  const coveredTraits = new Set();
  familyEffects.forEach((definition) => definition.traits.forEach((trait) => coveredTraits.add(trait)));
  context.SkillEffectTraitCatalog[family].forEach((trait) => {
    assert(coveredTraits.has(trait), family + ' has mapped words for an uncovered trait: ' + trait);
  });
});

console.log(JSON.stringify({
  total: definitions.length,
  perFamily: Object.fromEntries(families.map((family) => [family, definitions.filter((definition) => definition.family === family).length])),
  dictionarySize: context.WordSystem.all.length,
  maxReachableTriggerLength: Math.max(...Object.values(reachableSources).flat().map((word) => word.text.length)),
  indexedScripts: requiredScriptOrder.length
}, null, 2));
