(function () {
  var indexedWords = null;

  function buildIndex() {
    if (indexedWords) return indexedWords;
    indexedWords = WordSystem.all.map(function (word) {
      return {
        word: word,
        counts: countLetters(word.text.split('')),
        length: word.text.length,
        score: word.mult * word.text.length
      };
    }).sort(function (a, b) {
      if (a.length !== b.length) return b.length - a.length;
      return b.score - a.score;
    });
    return indexedWords;
  }

  function update(state) {
    var signature = state.genome.letters.join('') + '|' + state.genome.capacity + '|' + state.map.currentLayer;
    if (!state.recommendation.dirty && state.recommendation.signature === signature) return;

    var genomeCounts = countLetters(state.genome.letters);
    var best = null;
    var bestMissing = null;
    var candidates = buildIndex();

    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = candidates[i];
      if (candidate.length > state.genome.capacity) continue;
      var missing = missingLetters(candidate.counts, genomeCounts);
      if (missing.length > 3) continue;
      var score = candidate.score - missing.length * 4;
      if (!best || score > best.score) {
        best = { word: candidate.word, score: score };
        bestMissing = missing;
      }
    }

    if (!best) {
      best = fallbackWord(state, candidates);
      bestMissing = best ? missingLetters(best.counts, genomeCounts) : [];
    }

    state.recommendation.signature = signature;
    state.recommendation.dirty = false;
    state.recommendation.target = best ? best.word : null;
    state.recommendation.missing = bestMissing || [];
    state.recommendation.bestRegion = MapSystem.findBestRegionForLetters(state, state.recommendation.missing);
    state.uiDirty = true;
  }

  function fallbackWord(state, candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i].length <= state.genome.capacity) return candidates[i];
    }
    return null;
  }

  function missingLetters(targetCounts, genomeCounts) {
    var missing = [];
    Object.keys(targetCounts).forEach(function (letter) {
      var need = targetCounts[letter] - (genomeCounts[letter] || 0);
      for (var i = 0; i < need; i += 1) missing.push(letter);
    });
    return missing;
  }

  function countLetters(letters) {
    var counts = {};
    letters.forEach(function (letter) {
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }

  window.RecommendationSystem = {
    update: update
  };
})();
