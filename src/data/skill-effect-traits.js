(function () {
  // Ordinary words keep the family-wide `base` branch for compatibility,
  // then receive one deterministic specialization. Core words continue to
  // use the explicit variant from skill-word-map.js.
  var catalog = {
    dash: ['base', 'feeding-line', 'slipstream', 'breach-phase', 'frost-wake', 'schoolbreaker', 'afterimage', 'wake-collapse', 'momentum-bank'],
    shot: ['base', 'ricochet-lock', 'harpoon', 'split-genome', 'quarry-mark', 'primer-shot', 'frost-needle', 'waveguide-shot', 'repeater-circuit'],
    nova: ['base', 'repulsion-ring', 'chain-pulse', 'silence-field', 'perimeter-mine', 'forward-lobe', 'feeding-vortex', 'catalytic-pulse', 'cascade-engine'],
    guard: ['base', 'mirror-shell', 'layered-carapace', 'anchor-plate', 'last-reserve', 'word-bastion', 'retaliation-seal', 'countercurrent', 'bastion-field'],
    freeze: ['base', 'frost-trail', 'brittle-lattice', 'ice-chain', 'cold-front', 'time-pocket', 'permafrost', 'glacial-anchor', 'shard-harvest'],
    scan: ['base', 'school-census', 'drop-oracle', 'route-survey', 'density-xray', 'target-lock', 'predictive-interference', 'echo-radar', 'kill-window'],
    growth: ['base', 'reserve-cell', 'risk-bloom', 'school-harvest', 'cultivation', 'adaptive-digestion', 'symbiotic-intake', 'regrowth', 'molt-pulse'],
    splice: ['base', 'join-lock', 'reverse-transcript', 'site-swap', 'directed-mutation', 'salvage-buffer', 'overlap-catalyst', 'tail-graft', 'cross-over'],
    echo: ['base', 'lost-word-memory', 'duplicate-chorus', 'overlap-harmony', 'call-response', 'delayed-refrain', 'rebound-echo', 'memory-sequence', 'spoken-command'],
    corrode: ['base', 'decay-clock', 'rust-accumulation', 'nerve-rot', 'core-fracture', 'recovery-lock', 'solvent-halo', 'entropy-counter', 'acid-trail']
  };

  // A small semantic layer makes the most legible ordinary words feel
  // intentional. The deterministic fallback keeps all 3,000+ words useful.
  var semantic = {
    dash: {
      pursuit: 'feeding-line', slipstream: 'slipstream', breach: 'breach-phase', wake: 'frost-wake',
      scatter: 'schoolbreaker', afterimage: 'afterimage', collapse: 'wake-collapse', momentum: 'momentum-bank'
    },
    shot: {
      ricochet: 'ricochet-lock', harpoon: 'harpoon', split: 'split-genome', quarry: 'quarry-mark',
      primer: 'primer-shot', needle: 'frost-needle', waveguide: 'waveguide-shot', repeater: 'repeater-circuit'
    },
    nova: {
      repulsion: 'repulsion-ring', chain: 'chain-pulse', silence: 'silence-field', mine: 'perimeter-mine',
      forward: 'forward-lobe', vortex: 'feeding-vortex', catalyst: 'catalytic-pulse', cascade: 'cascade-engine'
    },
    guard: {
      mirror: 'mirror-shell', carapace: 'layered-carapace', anchor: 'anchor-plate', reserve: 'last-reserve',
      bastion: 'word-bastion', retaliation: 'retaliation-seal', countercurrent: 'countercurrent', fortress: 'bastion-field'
    },
    freeze: {
      frost: 'frost-trail', brittle: 'brittle-lattice', shackle: 'ice-chain', front: 'cold-front',
      stasis: 'time-pocket', permafrost: 'permafrost', glacial: 'glacial-anchor', shard: 'shard-harvest'
    },
    scan: {
      census: 'school-census', oracle: 'drop-oracle', survey: 'route-survey', xray: 'density-xray',
      target: 'target-lock', predictive: 'predictive-interference', radar: 'echo-radar', window: 'kill-window'
    },
    growth: {
      cell: 'reserve-cell', bloom: 'risk-bloom', harvest: 'school-harvest', cultivation: 'cultivation',
      digestion: 'adaptive-digestion', symbiosis: 'symbiotic-intake', regrowth: 'regrowth', molt: 'molt-pulse'
    },
    splice: {
      ligation: 'join-lock', transcript: 'reverse-transcript', swap: 'site-swap', mutation: 'directed-mutation',
      salvage: 'salvage-buffer', overlap: 'overlap-catalyst', graft: 'tail-graft', crossover: 'cross-over'
    },
    echo: {
      memory: 'lost-word-memory', chorus: 'duplicate-chorus', harmony: 'overlap-harmony', response: 'call-response',
      refrain: 'delayed-refrain', rebound: 'rebound-echo', sequence: 'memory-sequence', command: 'spoken-command'
    },
    corrode: {
      clock: 'decay-clock', accumulation: 'rust-accumulation', nerve: 'nerve-rot', fracture: 'core-fracture',
      recovery: 'recovery-lock', solvent: 'solvent-halo', entropy: 'entropy-counter', acid: 'acid-trail'
    }
  };

  var semanticEntries = [];
  var semanticByWord = Object.create(null);
  Object.keys(semantic).forEach(function (family) {
    Object.keys(semantic[family]).forEach(function (word) {
      var entry = { word: word, family: family, trait: semantic[family][word] };
      semanticEntries.push(entry);
      semanticByWord[word] = entry;
    });
  });

  function normalizeWord(text) {
    return String(text || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function semanticForWord(text) {
    return semanticByWord[normalizeWord(text)] || null;
  }

  function familyForWord(text) {
    var entry = semanticForWord(text);
    return entry ? entry.family : null;
  }

  function hash(text, family) {
    var value = 2166136261;
    var source = String(family || '') + ':' + String(text || '');
    for (var i = 0; i < source.length; i += 1) {
      value ^= source.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function fallbackTrait(text, family) {
    var branches = catalog[family];
    var winner = null;
    var winnerScore = -1;
    for (var i = 0; i < branches.length; i += 1) {
      var branch = branches[i];
      var score = hash(text, family + ':' + branch);
      if (score > winnerScore || (score === winnerScore && branch < winner)) {
        winner = branch;
        winnerScore = score;
      }
    }
    return winner;
  }

  function choose(text, family, mappedVariant) {
    if (!family || !catalog[family]) return null;
    if (mappedVariant && mappedVariant !== 'base') return mappedVariant;
    var key = normalizeWord(text);
    var known = semantic[family] && semantic[family][key];
    if (known) return known;
    return fallbackTrait(key, family);
  }

  window.SkillEffectTraitCatalog = catalog;
  window.SkillEffectSemanticEntries = semanticEntries;
  window.SkillEffectSemanticForWord = semanticForWord;
  window.SkillEffectFamilyForWord = familyForWord;
  window.SkillEffectTraitForWord = choose;
})();
