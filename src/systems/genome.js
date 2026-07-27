(function () {
  function isChinese() {
    return !!(window.I18n && typeof I18n.locale === 'function' && I18n.locale() === 'zh-CN');
  }

  function addLetter(state, letter, source) {
    var genome = state.genome;
    var displaced = [];
    var accepted = true;
    var incomingIndex = genome.letters.length;
    var previousPotential = new Set(state.words.potentialFound.map(function (word) { return word.text; }));
    genome.letters.push(letter);
    while (genome.letters.length > genome.capacity) {
      var removed = removeFrontUnlockedFactor(state);
      if (removed) {
        if (removed.index === incomingIndex) accepted = false;
        else displaced.push(removed.letter);
        if (removed.index < incomingIndex) incomingIndex -= 1;
        continue;
      }

      // A malformed or stale lock range must never be able to stall the
      // game loop. Prefer dropping the newest incoming factor, then clean up
      // any lock metadata that pointed past the retained queue.
      var fallbackIndex = genome.letters.length - 1;
      if (fallbackIndex < 0) break;
      var fallback = genome.letters.splice(fallbackIndex, 1)[0];
      shiftLockedBlocksAfterRemoval(genome, fallbackIndex);
      if (fallbackIndex === incomingIndex) accepted = false;
      else if (fallback) displaced.push(fallback);
      if (fallbackIndex < incomingIndex) incomingIndex -= 1;
      // Re-check the invariant in case the stale state was more than one
      // factor over capacity.
      continue;
    }
    genome.lastAddedAt = state.time;
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: accepted ? '+' + letter.toUpperCase() : '×' + letter.toUpperCase() + ' ' + (isChinese() ? '未入队' : 'discarded'),
      color: accepted ? GameConfig.palette.gold : GameConfig.palette.pink,
      life: 0.9,
      maxLife: 0.9
    });
    state.uiDirty = true;
    WordSystem.preview(state);
    var formed = state.words.potentialFound.filter(function (word) {
      return word.text.length >= 4 && !previousPotential.has(word.text) && state.words.unlocked.has(word.text) === false;
    }).sort(function (a, b) { return b.text.length - a.text.length || b.mult - a.mult; })[0];
    if (formed && source !== 'boss') {
      GameUI.toast(state, I18n.t('wordFormed', 'New word formed') + ': ' + formed.text.toUpperCase(), I18n.t('wordPending', 'Power is active; confirm the skill at the next Boss'));
    }
    if (displaced.length) {
      state.floatingTexts.push({
        x: state.player.x,
        y: state.player.y + 30,
        text: displaced.map(function (item) { return item.toUpperCase(); }).join('') + ' ' + I18n.t('flowedOut', 'flowed out'),
        color: GameConfig.palette.pink,
        life: 1.1,
        maxLife: 1.1
      });
    }
    if (source === 'boss') {
      GameUI.toast(
        state,
        I18n.t('bossWordLetter', 'Boss word letter'),
        accepted ? letter.toUpperCase() + ' ' + I18n.t('bossWordLetterBody', 'entered the queue') : letter.toUpperCase() + ' ' + (isChinese() ? '未能进入队列' : 'could not enter the queue')
      );
    }
    return { accepted: accepted, displaced: displaced };
  }

  function addWord(state, word) {
    var text = String(word && word.text || '').toLowerCase();
    if (!text) return { accepted: false, word: '' };
    var room = makeRoomForWord(state, text.length);
    if (!room.accepted) {
      GameUI.toast(state, I18n.t('bossWordBlocked', 'Boss word blocked'), isChinese() ? '当前锁定区无法容纳完整奖励词' : 'The locked genome could not hold the full reward word');
      return { accepted: false, word: text, displaced: room.displaced, shattered: room.shattered };
    }
    text.split('').forEach(function (letter) {
      addLetter(state, letter, 'reward');
    });
    GameUI.toast(state, I18n.t('bossWordLetter', 'Boss word'), text.toUpperCase() + ' ' + I18n.t('bossWordLetterBody', 'entered the queue'));
    return { accepted: true, word: text, displaced: room.displaced, shattered: room.shattered };
  }

  function makeRoomForWord(state, count) {
    var genome = state.genome;
    var displaced = [];
    var shattered = [];
    var needed = Math.max(0, genome.letters.length + count - genome.capacity);
    var maxCapacity = Number(GameConfig.maxGenomeCapacity) || genome.capacity;
    var expansion = Math.min(needed, Math.max(0, maxCapacity - genome.capacity));
    if (expansion > 0) {
      expandCapacity(state, expansion);
      needed = Math.max(0, genome.letters.length + count - genome.capacity);
    }

    while (needed > 0) {
      var removed = removeFrontUnlockedLetter(state);
      if (removed) {
        displaced.push(removed);
        needed -= 1;
        continue;
      }
      if (!genome.lockedBlocks.length) break;
      genome.lockedBlocks.sort(function (a, b) { return a.start - b.start; });
      var block = genome.lockedBlocks[0];
      var broken = removeLockedBlock(genome, block);
      if (!broken.length) {
        genome.lockedBlocks.shift();
        continue;
      }
      shattered.push(block.word);
      needed -= broken.length;
    }

    if (displaced.length) {
      state.floatingTexts.push({
        x: state.player.x,
        y: state.player.y + 30,
        text: displaced.map(function (item) { return item.toUpperCase(); }).join('') + ' ' + I18n.t('flowedOut', 'flowed out'),
        color: GameConfig.palette.pink,
        life: 1.1,
        maxLife: 1.1
      });
    }
    if (shattered.length) {
      GameUI.toast(state, I18n.t('lockShattered', 'Word lock shattered'), shattered.map(function (item) { return item.toUpperCase(); }).join(' / ') + ' ' + (isChinese() ? '为奖励词让出空间' : 'made room for the reward word'));
    }
    WordSystem.preview(state);
    state.uiDirty = true;
    return { accepted: needed <= 0, displaced: displaced, shattered: shattered };
  }

  function expandCapacity(state, amount) {
    var before = state.genome.capacity;
    state.genome.capacity = Math.min(GameConfig.maxGenomeCapacity, state.genome.capacity + amount);
    if (state.genome.capacity !== before) {
      GameUI.toast(state, I18n.t('genomeExpanded', 'Genome expanded'), before + ' -> ' + state.genome.capacity + ' ' + I18n.t('slotsAdded', 'slots'));
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

  function lockCurrentWordBlock(state) {
    var genome = state.genome;
    if (genome.lockedBlocks.length >= genome.maxLockedBlocks) return null;
    WordSystem.preview(state);
    var candidates = state.words.potentialOccurrences.slice().sort(function (a, b) {
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

  function removeFrontUnlockedFactor(state) {
    var genome = state.genome;
    var index = firstUnlockedIndex(genome);
    if (index < 0) return null;
    var removed = genome.letters.splice(index, 1)[0];
    shiftLockedBlocksAfterRemoval(genome, index);
    return { letter: removed, index: index };
  }

  function removeFrontUnlockedLetter(state) {
    var removed = removeFrontUnlockedFactor(state);
    return removed ? removed.letter : null;
  }

  function removeLockedBlock(genome, block) {
    var start = Math.max(0, Math.min(genome.letters.length, Number(block.start) || 0));
    var length = Math.max(0, Math.min(genome.letters.length - start, Number(block.length) || 0));
    if (!length) return [];
    var end = start + length;
    var removed = genome.letters.splice(start, length);
    genome.lockedBlocks = genome.lockedBlocks.filter(function (item) {
      if (item === block) return false;
      var itemEnd = item.start + item.length;
      return itemEnd <= start || item.start >= end;
    });
    genome.lockedBlocks.forEach(function (item) {
      if (item.start >= end) item.start -= length;
    });
    genome.lockedBlocks = genome.lockedBlocks.filter(function (item) {
      return item.start >= 0 && item.length > 0 && item.start + item.length <= genome.letters.length && genome.letters.slice(item.start, item.start + item.length).join('') === item.word;
    });
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
    lockCurrentWordBlock: lockCurrentWordBlock,
    removeFrontFactors: removeFrontFactors
  };
})();
