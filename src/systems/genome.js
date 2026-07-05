(function () {
  function addLetter(state, letter, source) {
    var genome = state.genome;
    genome.letters.push(letter);
    while (genome.letters.length > genome.capacity) {
      genome.letters.shift();
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
    var removed = state.genome.letters.splice(0, Math.max(0, count));
    if (removed.length) {
      WordSystem.preview(state);
      state.uiDirty = true;
    }
    return removed;
  }

  window.GenomeSystem = {
    addLetter: addLetter,
    addWord: addWord,
    expandCapacity: expandCapacity,
    rollDropLetter: rollDropLetter,
    getSequence: getSequence,
    letterScore: letterScore,
    removeFrontFactors: removeFrontFactors
  };
})();
