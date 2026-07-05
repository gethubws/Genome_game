(function () {
  function effectivePower(state) {
    var player = state.player;
    var genomePower = GenomeSystem.letterScore(state) + player.basePower;
    return Math.max(0.1, genomePower) * state.words.multiplier * state.skills.dash.boost;
  }

  function visualRadius(state) {
    var base = state.player.radius + Math.sqrt(GenomeSystem.letterScore(state)) * 1.8;
    if (state.skills.dash.active) {
      var t = Utils.clamp(state.skills.dash.age / state.skills.dash.duration, 0, 1);
      base *= 1 + Math.sin(t * Math.PI) * 0.28;
    }
    return base;
  }

  function update(state) {
    var player = state.player;
    player.invulnerable = Math.max(0, player.invulnerable - state.dt);
    var entities = state.enemies.slice();
    if (state.boss.active) entities.push(state.boss.active);

    entities.forEach(function (enemy) {
      var rr = visualRadius(state) + enemy.radius * 0.78;
      if (Utils.dist2(player, enemy) > rr * rr) return;

      if (effectivePower(state) >= enemy.power) {
        consume(state, enemy);
      } else {
        hitPlayer(state, enemy);
      }
    });
  }

  function consume(state, enemy) {
    if (enemy.consumed) return;
    enemy.consumed = true;
    var depth = Utils.depthAtY(enemy.y);
    var letter = GenomeSystem.rollDropLetter(enemy, depth);
    var lockBeforeDrop = enemy.rewardType === 'lock';
    if (lockBeforeDrop) applyRewardEnemyEffect(state, enemy);

    GenomeSystem.addLetter(state, letter, enemy.boss ? 'boss' : 'enemy');
    ShotSkill.burst(state, enemy.x, enemy.y, enemy.fixedDrop ? GameConfig.palette.gold : state.player.accent, enemy.boss ? 32 : 14);
    state.floatingTexts.push({
      x: enemy.x,
      y: enemy.y,
      text: '+' + letter.toUpperCase() + ' +' + Utils.letterValue(letter).toFixed(1),
      color: GameConfig.palette.mint,
      life: 1,
      maxLife: 1
    });

    if (!lockBeforeDrop) applyRewardEnemyEffect(state, enemy);

    if (enemy.boss) {
      defeatBoss(state, enemy);
    }

    if (enemy.rewardSiteId) {
      MapSystem.claimRewardSite(state, enemy.rewardSiteId);
    }

    EnemySystem.removeEnemy(state, enemy);
    state.uiDirty = true;
  }

  function applyRewardEnemyEffect(state, enemy) {
    if (enemy.rewardType === 'lock') {
      var block = GenomeSystem.lockCurrentWordBlock(state);
      if (!block) {
        GameUI.toast(state, 'No word block locked', 'Build a word in the current genome first');
        return;
      }
      GameUI.toast(state, 'Word block locked', block.word.toUpperCase() + ' will resist queue pressure');
      state.floatingTexts.push({
        x: enemy.x,
        y: enemy.y - 24,
        text: 'lock ' + block.word.toUpperCase(),
        color: GameConfig.palette.gold,
        life: 1,
        maxLife: 1
      });
      return;
    }

    if (enemy.rewardType !== 'capacity') return;
    var before = state.genome.capacity;
    GenomeSystem.expandCapacity(state, 1);
    if (state.genome.capacity <= before) return;
    state.floatingTexts.push({
      x: enemy.x,
      y: enemy.y - 24,
      text: '+1 slot',
      color: GameConfig.palette.gold,
      life: 1,
      maxLife: 1
    });
  }

  function hitPlayer(state, enemy) {
    var player = state.player;
    if (player.invulnerable > 0) return;
    var dir = Utils.normalize(player.x - enemy.x, player.y - enemy.y);
    var gap = Math.max(0, enemy.power - effectivePower(state));
    var lossCount = Utils.clamp(Math.ceil(gap / 4), 1, Math.min(5, state.genome.letters.length));
    var removed = GenomeSystem.removeFrontFactors(state, lossCount);
    player.vx += dir.x * 280;
    player.vy += dir.y * 280;
    player.invulnerable = GameConfig.player.invulnerableAfterHit;
    state.floatingTexts.push({
      x: player.x,
      y: player.y - 28,
      text: removed.length ? '-' + removed.length + ' factors' : 'repelled',
      color: GameConfig.palette.danger,
      life: 0.85,
      maxLife: 0.85
    });
    state.uiDirty = true;
  }

  function defeatBoss(state, boss) {
    var gate = boss.gateId ? MapSystem.markBossDefeated(state, boss.gateId) : null;
    if (gate && gate.final) {
      WordSystem.express(state, 'clear');
      state.boss.defeated += 1;
      state.boss.depth = MapSystem.nextBossDepth(state);
      state.runOver = true;
      state.reward = {
        title: 'Run Cleared',
        body: 'The fourth gate collapsed. This genome survived the full descent.',
        pills: [
          'final power: ' + effectivePower(state).toFixed(1),
          'expressed: ' + (state.words.found.length || 0) + ' words',
          'genome: ' + state.genome.letters.length + ' / ' + state.genome.capacity
        ],
        continueLabel: 'New Run',
        clearImage: true
      };
      state.paused = true;
      GameUI.showEvolution(state);
      ImageSystem.generateClearImage(state);
      return;
    }
    var rewardWord = WordSystem.randomRewardWord();
    var oldCapacity = state.genome.capacity;
    GenomeSystem.expandCapacity(state, 4);
    GenomeSystem.addWord(state, rewardWord);
    WordSystem.express(state, 'boss');
    state.boss.defeated += 1;
    state.boss.depth = MapSystem.nextBossDepth(state);
    state.reward = {
      title: 'Genome Expanded',
      body: 'Boss current collapsed. A word entered the queue, capacity grew, and the avatar re-formed from unlocked words.',
      pills: [
        'word: ' + rewardWord.text,
        'slots: ' + oldCapacity + ' -> ' + state.genome.capacity,
        'next gate: ' + state.boss.depth + 'm'
      ]
    };
    state.paused = true;
    GameUI.showEvolution(state);
  }

  window.CombatSystem = {
    effectivePower: effectivePower,
    visualRadius: visualRadius,
    update: update
  };
})();
