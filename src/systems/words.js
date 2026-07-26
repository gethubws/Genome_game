(function () {
  var MIN_WORD_LENGTH = 2;
  var LN10 = Math.log(10);
  var MAX_LOG_MULTIPLIER = Math.log(Number.MAX_VALUE);

  // The source list is a web-frequency export. Keep the playable dictionary
  // focused on ordinary vocabulary instead of exposing adult or spam terms.
  var BLOCKED_WORDS = new Set([
    'fucking', 'incest', 'anal', 'cum', 'milf', 'porno', 'hentai',
    'bondage', 'tits', 'cock', 'shemale'
  ]);

  var SPECIAL_WORDS = [
    { text: 'is', mult: 1.12, type: 'plain' },
    { text: 'in', mult: 1.12, type: 'plain' },
    { text: 'ear', mult: 1.08, type: 'common' },
    { text: 'ware', mult: 1.11, type: 'common' },
    { text: 'red', mult: 1.35, type: 'visual', visual: 'red' },
    { text: 'blue', mult: 1.45, type: 'visual', visual: 'blue' },
    { text: 'gold', mult: 1.65, type: 'visual', visual: 'gold' },
    { text: 'dark', mult: 1.75, type: 'visual', visual: 'dark' },
    { text: 'fish', mult: 1.75, type: 'visual', visual: 'fish' },
    { text: 'fin', mult: 1.35, type: 'visual', visual: 'fin' },
    { text: 'tail', mult: 1.55, type: 'visual', visual: 'tail' },
    { text: 'scale', mult: 2.05, type: 'visual', visual: 'scale' },
    { text: 'see', mult: 1.25, type: 'skill', skill: 'scan' },
    { text: 'eye', mult: 1.25, type: 'skill', skill: 'scan' },
    { text: 'look', mult: 1.45, type: 'skill', skill: 'scan' },
    { text: 'view', mult: 1.55, type: 'skill', skill: 'scan' },
    { text: 'dash', mult: 1.35, type: 'skill', skill: 'dash' },
    { text: 'rush', mult: 1.38, type: 'skill', skill: 'dash' },
    { text: 'swim', mult: 1.42, type: 'skill', skill: 'dash' },
    { text: 'sprint', mult: 2.55, type: 'skill', skill: 'dash' },
    { text: 'shot', mult: 1.35, type: 'skill', skill: 'shot' },
    { text: 'shoot', mult: 2.05, type: 'skill', skill: 'shot' },
    { text: 'spit', mult: 1.55, type: 'skill', skill: 'shot' },
    { text: 'bolt', mult: 1.75, type: 'skill', skill: 'shot' },
    { text: 'bite', mult: 1.55, type: 'skill', skill: 'shot' },
    { text: 'pulse', mult: 1.75, type: 'skill', skill: 'nova' },
    { text: 'wave', mult: 1.55, type: 'skill', skill: 'nova' },
    { text: 'echo', mult: 1.48, type: 'skill', skill: 'nova' },
    { text: 'blast', mult: 1.72, type: 'skill', skill: 'nova' },
    { text: 'guard', mult: 1.85, type: 'skill', skill: 'guard' },
    { text: 'shield', mult: 2.45, type: 'skill', skill: 'guard' },
    { text: 'shell', mult: 1.72, type: 'skill', skill: 'guard' },
    { text: 'armor', mult: 1.85, type: 'skill', skill: 'guard' },
    { text: 'freeze', mult: 2.25, type: 'skill', skill: 'freeze' },
    { text: 'cold', mult: 1.58, type: 'skill', skill: 'freeze' },
    { text: 'ice', mult: 1.42, type: 'skill', skill: 'freeze' },
    { text: 'slow', mult: 1.45, type: 'skill', skill: 'freeze' },
    { text: 'scan', mult: 1.35, type: 'skill', skill: 'scan' },
    { text: 'nova', mult: 1.8, type: 'skill', skill: 'nova' },
    { text: 'growth', mult: 2.0, type: 'skill', skill: 'growth' },
    { text: 'feed', mult: 1.55, type: 'skill', skill: 'growth' },
    { text: 'splice', mult: 2.05, type: 'skill', skill: 'splice' },
    { text: 'join', mult: 1.55, type: 'skill', skill: 'splice' },
    { text: 'repeat', mult: 1.85, type: 'skill', skill: 'echo' },
    { text: 'word', mult: 1.35, type: 'skill', skill: 'echo' },
    { text: 'voice', mult: 1.55, type: 'skill', skill: 'echo' },
    { text: 'corrode', mult: 2.2, type: 'skill', skill: 'corrode' },
    { text: 'decay', mult: 1.65, type: 'skill', skill: 'corrode' },
    { text: 'rust', mult: 1.45, type: 'skill', skill: 'corrode' },
    { text: 'poison', mult: 1.95, type: 'skill', skill: 'corrode' },
    { text: 'weaken', mult: 2.2, type: 'skill', skill: 'corrode' },
    { text: 'drain', mult: 1.75, type: 'skill', skill: 'corrode' },
    { text: 'life', mult: 1.8, type: 'plain' },
    { text: 'heal', mult: 1.85, type: 'plain' },
    { text: 'grow', mult: 1.75, type: 'plain' },
    { text: 'gene', mult: 1.6, type: 'plain' },
    { text: 'deep', mult: 1.9, type: 'plain' },
    { text: 'current', mult: 4.2, type: 'plain' },
    { text: 'genome', mult: 4.6, type: 'plain' }
  ];

  function normalizeText(value) {
    return String(value == null ? '' : value).toLowerCase().replace(/[^a-z]/g, '');
  }

  function createCommonWord(text, index) {
    var lengthBonus = text.length >= 8 ? 0.22 : text.length >= 6 ? 0.16 : text.length >= 5 ? 0.11 : text.length >= 4 ? 0.075 : 0.045;
    var rankBonus = Math.max(0, 0.035 - index * 0.00001);
    return { text: text, mult: 1 + lengthBonus + rankBonus, type: 'common', rank: index + 1 };
  }

  // Hand-authored words win over the imported list so their visual and skill metadata survives.
  var specialByText = Object.create(null);
  var seenByText = Object.create(null);
  var WORDS = [];
  SPECIAL_WORDS.forEach(function (word) {
    var text = normalizeText(word.text);
    if (!text || specialByText[text]) return;
    var normalized = Object.assign({}, word, { text: text });
    specialByText[text] = normalized;
    seenByText[text] = true;
    WORDS.push(normalized);
  });
  (window.CommonWordList || []).forEach(function (rawText, index) {
    var text = normalizeText(rawText);
    if (!text || seenByText[text] || BLOCKED_WORDS.has(text)) return;
    seenByText[text] = true;
    WORDS.push(createCommonWord(text, index));
  });

  var familyToSkill = {
    movement: 'dash', hunt: 'shot', pulse: 'nova', guard: 'guard', control: 'freeze',
    sense: 'scan', growth: 'growth', genome: 'splice', expression: 'echo', corrosion: 'corrode'
  };
  var coreOverrides = {
    dash: 'dash', shot: 'shot', nova: 'nova', guard: 'guard', freeze: 'freeze', scan: 'scan',
    growth: 'growth', splice: 'splice', echo: 'echo', corrode: 'corrode'
  };
  WORDS.forEach(function (word) {
    var metadata = (window.SkillWordMap || {})[word.text];
    var skillId = coreOverrides[word.text] || (metadata && familyToSkill[metadata.family]) || word.skill || null;
    if (!skillId) return;
    word.family = skillId;
    word.skill = skillId;
    word.variant = coreOverrides[word.text] ? 'core' : ((metadata && metadata.variant) || 'base');
    word.affinity = coreOverrides[word.text] ? 1.65 : Math.max(0.5, Number(metadata && metadata.affinity) || 1);
    word.coreSkillWord = !!coreOverrides[word.text] || !!(metadata && metadata.core);
  });

  var byText = Object.create(null);
  var root = { children: Object.create(null), word: null };
  var maxWordLength = MIN_WORD_LENGTH;

  WORDS.forEach(function (word) {
    byText[word.text] = word;
    maxWordLength = Math.max(maxWordLength, word.text.length);
    var node = root;
    for (var i = 0; i < word.text.length; i += 1) {
      var letter = word.text.charAt(i);
      node.children[letter] = node.children[letter] || { children: Object.create(null), word: null };
      node = node.children[letter];
    }
    node.word = word;
  });

  function sequenceText(sequence) {
    if (Array.isArray(sequence)) return normalizeText(sequence.join(''));
    return normalizeText(sequence);
  }

  function sortOccurrences(a, b) {
    if (a.index !== b.index) return a.index - b.index;
    if (a.word.text.length !== b.word.text.length) return b.word.text.length - a.word.text.length;
    return a.end - b.end;
  }

  function findOccurrences(sequence) {
    var text = sequenceText(sequence);
    var occurrences = [];
    for (var start = 0; start < text.length; start += 1) {
      var node = root;
      for (var end = start; end < text.length && end - start < maxWordLength; end += 1) {
        node = node.children[text.charAt(end)];
        if (!node) break;
        if (node.word && node.word.text.length >= MIN_WORD_LENGTH) {
          occurrences.push({ word: node.word, index: start, end: end + 1 });
        }
      }
    }
    occurrences.sort(sortOccurrences);
    return occurrences;
  }

  function safeExp(logValue) {
    if (logValue >= MAX_LOG_MULTIPLIER) return Number.MAX_VALUE;
    if (logValue <= -MAX_LOG_MULTIPLIER) return 0;
    return Math.exp(logValue);
  }

  function multiplierDetails(occurrences) {
    var log = 0;
    var validCount = 0;
    (occurrences || []).forEach(function (entry) {
      var multiplier = Number(entry.word && entry.word.mult);
      if (!isFinite(multiplier) || multiplier <= 0) return;
      log += Math.log(multiplier);
      validCount += 1;
    });
    var value = safeExp(log);
    return {
      value: value,
      log: log,
      count: validCount,
      overflow: log >= MAX_LOG_MULTIPLIER,
      display: formatMultiplier(value, log)
    };
  }

  function computeMultiplier(occurrences) {
    return multiplierDetails(occurrences).value;
  }

  function formatMultiplier(value, logValue, decimals) {
    var precision = typeof decimals === 'number' ? decimals : 2;
    var log = typeof logValue === 'number' ? logValue : (value > 0 ? Math.log(value) : -Infinity);
    if (!isFinite(log)) return log === -Infinity ? 'x0' : 'xMAX';
    var exponent = Math.floor(log / LN10);
    if (exponent >= 6 || exponent <= -3) {
      var mantissa = Math.exp(log - exponent * LN10);
      return 'x' + mantissa.toFixed(precision) + 'e' + (exponent >= 0 ? '+' : '') + exponent;
    }
    return 'x' + safeExp(log).toFixed(precision);
  }

  function uniqueWords(occurrences) {
    var seen = new Set();
    var found = [];
    (occurrences || []).forEach(function (entry) {
      if (!seen.has(entry.word.text)) {
        seen.add(entry.word.text);
        found.push(entry.word);
      }
    });
    return found;
  }

  function occurrenceCounts(occurrences) {
    var counts = Object.create(null);
    (occurrences || []).forEach(function (entry) {
      counts[entry.word.text] = (counts[entry.word.text] || 0) + 1;
    });
    return counts;
  }

  function applyExpressionEffects(state) {
    var flags = {};
    var unlocked = new Set();

    state.words.found.forEach(function (word) {
      unlocked.add(word.text);
      if (word.visual) flags[word.visual] = true;
      if (word.skill) flags[word.skill + 'Skill'] = true;
      if (word.family) flags[word.family + 'Skill'] = true;
    });

    state.words.unlocked = unlocked;
    state.player.visualFlags = flags;

    if (flags.red) {
      state.player.color = '#ff6a6a';
      state.player.accent = '#ffd36f';
    } else if (flags.gold) {
      state.player.color = '#ffd36f';
      state.player.accent = '#65e5ff';
    } else if (flags.blue) {
      state.player.color = '#65a8ff';
      state.player.accent = '#64f0b6';
    } else if (flags.dark) {
      state.player.color = '#9f8cff';
      state.player.accent = '#ff6fa8';
    } else {
      state.player.color = '#65e5ff';
      state.player.accent = '#64f0b6';
    }
  }

  function preview(state) {
    var occurrences = findOccurrences(state.genome.letters);
    var details = multiplierDetails(occurrences);
    state.words.potentialOccurrences = occurrences;
    state.words.potentialFound = uniqueWords(occurrences);
    state.words.potentialMultiplier = details.value;
    state.words.potentialLogMultiplier = details.log;
    state.words.potentialMultiplierOverflow = details.overflow;
    state.words.potentialMultiplierDisplay = formatMultiplier(details.value, details.log);
    state.words.potentialWordCount = occurrences.length;
    state.words.potentialOccurrenceCount = occurrences.length;
    state.words.potentialOccurrenceCounts = occurrenceCounts(occurrences);
    state.uiDirty = true;
  }

  function express(state, reason) {
    var previous = new Set(state.words.found.map(function (word) { return word.text; }));
    preview(state);
    state.words.occurrences = state.words.potentialOccurrences.slice();
    state.words.found = state.words.potentialFound.slice();
    state.words.multiplier = state.words.potentialMultiplier;
    state.words.logMultiplier = state.words.potentialLogMultiplier;
    state.words.multiplierOverflow = state.words.potentialMultiplierOverflow;
    state.words.multiplierDisplay = state.words.potentialMultiplierDisplay;
    state.words.occurrenceCount = state.words.occurrences.length;
    state.words.occurrenceCounts = occurrenceCounts(state.words.occurrences);
    state.words.lastExpressionReason = reason || 'settlement';
    applyExpressionEffects(state);
    if (window.SkillSystem) SkillSystem.refreshUnlocks(state);

    state.words.found.forEach(function (word) {
      if (!previous.has(word.text)) {
        var typeKeys = { plain: 'wordTypePlain', common: 'wordTypeCommon', skill: 'wordTypeSkill', visual: 'wordTypeVisual' };
        var typeLabel = typeKeys[word.type] ? I18n.t(typeKeys[word.type], word.type) : word.type;
        GameUI.toast(state, I18n.t('wordExpressed', 'Word expressed') + ': ' + word.text.toUpperCase(), 'x' + word.mult.toFixed(2) + ' ' + typeLabel);
      }
      state.words.globalUnlocked.add(word.text);
    });

    Utils.storageSet('gene-current-unlocked', JSON.stringify(Array.from(state.words.globalUnlocked)));
    Utils.storageSet('gene-current-achievements', String(state.words.globalUnlocked.size));
    state.uiDirty = true;
  }

  function wordsEndingAt(text) {
    var ending = [];
    var startMin = Math.max(0, text.length - maxWordLength);
    for (var start = startMin; start < text.length; start += 1) {
      var node = root;
      for (var end = start; end < text.length; end += 1) {
        node = node.children[text.charAt(end)];
        if (!node) break;
        if (end === text.length - 1 && node.word && node.word.text.length >= MIN_WORD_LENGTH) {
          ending.push({ word: node.word, index: start, end: end + 1 });
        }
      }
    }
    ending.sort(function (a, b) {
      if (a.word.text.length !== b.word.text.length) return b.word.text.length - a.word.text.length;
      return b.word.mult - a.word.mult;
    });
    return ending;
  }

  function tailSuggestions(sequence, limit) {
    var text = sequenceText(sequence);
    var suggestions = [];
    for (var code = 97; code <= 122; code += 1) {
      var letter = String.fromCharCode(code);
      var occurrences = wordsEndingAt(text + letter);
      if (!occurrences.length) continue;
      var details = multiplierDetails(occurrences);
      suggestions.push({
        letter: letter,
        words: occurrences.map(function (entry) { return entry.word; }),
        occurrences: occurrences,
        count: occurrences.length,
        multiplier: details.value,
        logMultiplier: details.log,
        multiplierOverflow: details.overflow,
        multiplierDisplay: formatMultiplier(details.value, details.log)
      });
    }
    suggestions.sort(function (a, b) {
      if (a.logMultiplier !== b.logMultiplier) return b.logMultiplier - a.logMultiplier;
      if (a.count !== b.count) return b.count - a.count;
      return a.letter.localeCompare(b.letter);
    });
    if (typeof limit !== 'number' || !isFinite(limit)) return suggestions;
    return suggestions.slice(0, Math.max(0, Math.floor(limit)));
  }

  function randomRewardWord() {
    var pool = WORDS.filter(function (word) { return word.text.length >= MIN_WORD_LENGTH; });
    return Utils.pick(pool);
  }

  window.WordSystem = {
    all: WORDS,
    byText: byText,
    minWordLength: MIN_WORD_LENGTH,
    maxWordLength: maxWordLength,
    findOccurrences: findOccurrences,
    computeMultiplier: computeMultiplier,
    multiplierDetails: multiplierDetails,
    occurrenceCounts: occurrenceCounts,
    valueFromLog: safeExp,
    formatMultiplier: formatMultiplier,
    preview: preview,
    express: express,
    randomRewardWord: randomRewardWord,
    tailSuggestions: tailSuggestions,
    sequenceText: sequenceText
  };
})();
