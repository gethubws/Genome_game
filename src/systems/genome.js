(function () {
  function addLetter(state, letter, source) {
    var genome = state.genome;
    genome.letters.push(letter);
    while (genome.letters.length > genome.capacity) {
      removeFrontUnlockedLetter(state);
    }
    genome.lastAddedAt = state.time;
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: '+' + letter,
      color: GameConfig.palette.gold,
      life: 0.9,
      maxLife: 0.9
    });
    state.uiDirty = true;
    WordSystem.preview(state);
    if (source === 'boss') {
      GameUI.toast(state, 'Boss word letter', letter.toUpperCase() + ' entered the queue');
    }
  }

  function addWord(state, word) {
    word.text.split('').forEach(function (letter) {
      addLetter(state, letter, 'boss');
    });
  }

  function expandCapacity(state, amount) {
    var before = state.genome.capacity;
    state.genome.capacity = Math.min(GameConfig.maxGenomeCapacity, state.genome.capacity + amount);
    if (state.genome.capacity !== before) {
      GameUI.toast(state, 'Genome expanded', before + ' -> ' + state.genome.capacity + ' slots');
    }
    state.uiDirty = true;
  }

  function rollDropLetter(enemy, depth) {
    if (enemy.fixedDrop) return enemy.bias;
    var fallbackChance = Utils.clamp(0.28 + depth / 1050, 0.28, 0.74);
    var biasChance = typeof enemy.dropChance === 'number' ? enemy.dropChance : fallbackChance;
    return Math.random() < biasChance ? enemy.bias : Utils.otherLetter(enemy.bias);
  }

  function getSequence(state) {
    return state.genome.letters.join('');
  }

  function letterScore(state) {
    return state.genome.letters.reduce(function (total, letter) {
      return total + Utils.letterValue(letter);
    }, 0);
  }

  function removeFrontFactors(state, count) {
    var removed = [];
    for (var i = 0; i < Math.max(0, count); i += 1) {
      var letter = removeFrontUnlockedLetter(state);
      if (!letter) break;
      removed.push(letter);
    }
    if (removed.length) {
      WordSystem.preview(state);
      state.uiDirty = true;
    }
    return removed;
  }

  function lockExpressedWord(state) {
    var genome = state.genome;
    if (genome.lockedBlocks.length >= genome.maxLockedBlocks) return null;
    var candidates = state.words.occurrences.slice().sort(function (a, b) {
      if (a.word.text.length !== b.word.text.length) return b.word.text.length - a.word.text.length;
      return a.index - b.index;
    });

    for (var i = 0; i < candidates.length; i += 1) {
      var entry = candidates[i];
      var word = entry.word.text;
      var start = entry.index;
      var end = start + word.length;
      if (end > genome.letters.length) continue;
      if (genome.letters.slice(start, end).join('') !== word) continue;
      if (rangeOverlapsLocked(genome, start, end)) continue;
      var block = { word: word, start: start, length: word.length };
      genome.lockedBlocks.push(block);
      state.uiDirty = true;
      return block;
    }

    return null;
  }

  function removeFrontUnlockedLetter(state) {
    var genome = state.genome;
    var index = firstUnlockedIndex(genome);
    if (index < 0) return null;
    var removed = genome.letters.splice(index, 1)[0];
    shiftLockedBlocksAfterRemoval(genome, index);
    return removed;
  }

  function firstUnlockedIndex(genome) {
    for (var i = 0; i < genome.letters.length; i += 1) {
      if (!isLockedIndex(genome, i)) return i;
    }
    return -1;
  }

  function isLockedIndex(genome, index) {
    return genome.lockedBlocks.some(function (block) {
      return index >= block.start && index < block.start + block.length;
    });
  }

  function rangeOverlapsLocked(genome, start, end) {
    return genome.lockedBlocks.some(function (block) {
      var blockEnd = block.start + block.length;
      return start < blockEnd && end > block.start;
    });
  }

  function shiftLockedBlocksAfterRemoval(genome, index) {
    genome.lockedBlocks = genome.lockedBlocks.filter(function (block) {
      if (index < block.start) block.start -= 1;
      var end = block.start + block.length;
      return end <= genome.letters.length && genome.letters.slice(block.start, end).join('') === block.word;
    });
  }

  window.GenomeSystem = {
    addLetter: addLetter,
    addWord: addWord,
    expandCapacity: expandCapacity,
    rollDropLetter: rollDropLetter,
    getSequence: getSequence,
    letterScore: letterScore,
    isLockedIndex: isLockedIndex,
    lockExpressedWord: lockExpressedWord,
    removeFrontFactors: removeFrontFactors
  };
})();
