(function () {
  var WORDS = [
    { text: 'is', mult: 1.12, type: 'plain' },
    { text: 'in', mult: 1.12, type: 'plain' },
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
    { text: 'life', mult: 1.8, type: 'plain' },
    { text: 'heal', mult: 1.85, type: 'plain' },
    { text: 'grow', mult: 1.75, type: 'plain' },
    { text: 'gene', mult: 1.6, type: 'plain' },
    { text: 'deep', mult: 1.9, type: 'plain' },
    { text: 'current', mult: 4.2, type: 'plain' },
    { text: 'genome', mult: 4.6, type: 'plain' }
  ];

  var byText = {};
  WORDS.forEach(function (word) {
    byText[word.text] = word;
  });

  function findOccurrences(sequence) {
    var text = sequence.join('');
    var occurrences = [];

    WORDS.forEach(function (word) {
      var index = text.indexOf(word.text);
      while (index !== -1) {
        occurrences.push({ word: word, index: index });
        index = text.indexOf(word.text, index + 1);
      }
    });

    occurrences.sort(function (a, b) {
      if (a.index !== b.index) return a.index - b.index;
      return b.word.text.length - a.word.text.length;
    });

    return occurrences;
  }

  function computeMultiplier(occurrences) {
    var mult = 1;
    occurrences.forEach(function (entry) {
      mult *= entry.word.mult;
    });
    return Math.min(99, mult);
  }

  function uniqueWords(occurrences) {
    var seen = new Set();
    var found = [];
    occurrences.forEach(function (entry) {
      if (!seen.has(entry.word.text)) {
        seen.add(entry.word.text);
        found.push(entry.word);
      }
    });
    return found;
  }

  function applyExpressionEffects(state) {
    var flags = {};
    var unlocked = new Set();

    state.words.found.forEach(function (word) {
      unlocked.add(word.text);
      if (word.visual) flags[word.visual] = true;
      if (word.skill) flags[word.skill + 'Skill'] = true;
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
    state.words.potentialOccurrences = findOccurrences(state.genome.letters);
    state.words.potentialFound = uniqueWords(state.words.potentialOccurrences);
    state.words.potentialMultiplier = computeMultiplier(state.words.potentialOccurrences);
    state.uiDirty = true;
  }

  function express(state, reason) {
    var previous = new Set(state.words.found.map(function (word) { return word.text; }));
    preview(state);
    state.words.occurrences = state.words.potentialOccurrences.slice();
    state.words.found = state.words.potentialFound.slice();
    state.words.multiplier = state.words.potentialMultiplier;
    state.words.lastExpressionReason = reason || 'settlement';
    applyExpressionEffects(state);

    state.words.found.forEach(function (word) {
      if (!previous.has(word.text)) {
        GameUI.toast(state, 'Word expressed: ' + word.text, 'x' + word.mult.toFixed(2) + ' ' + word.type);
      }
      state.words.globalUnlocked.add(word.text);
    });

    Utils.storageSet('gene-current-unlocked', JSON.stringify(Array.from(state.words.globalUnlocked)));
    Utils.storageSet('gene-current-achievements', String(state.words.globalUnlocked.size));
    state.uiDirty = true;
  }

  function randomRewardWord() {
    var pool = WORDS.filter(function (word) { return word.text.length >= 3; });
    return Utils.pick(pool);
  }

  window.WordSystem = {
    all: WORDS,
    byText: byText,
    preview: preview,
    express: express,
    randomRewardWord: randomRewardWord
  };
})();
