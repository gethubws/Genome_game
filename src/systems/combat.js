(function () {
  var LN10 = Math.log(10);
  var MAX_LOG_POWER = Math.log(Number.MAX_VALUE);

  function t(key, fallback) {
    return window.I18n && I18n.t ? I18n.t(key, fallback) : fallback;
  }

  function damageLabel(label) {
    var keys = { Impact: 'damageImpact', Pounce: 'damagePounce', Pulse: 'damagePulse', Bite: 'damageBite', 'Spitter hit': 'damageSpitter' };
    var key = keys[label];
    return key ? t(key, label) : (label || t('damageAttack', 'Damage'));
  }

  function logPower(value) {
    var number = Number(value);
    if (number === Infinity) return Infinity;
    if (!(number > 0) || number !== number) return -Infinity;
    return Math.log(number);
  }

  function powerFromLog(logValue) {
    if (logValue === -Infinity || !(logValue > -Infinity)) return 0;
    if (logValue >= MAX_LOG_POWER || logValue === Infinity) return Number.MAX_VALUE;
    return Math.exp(logValue);
  }

  // Stable log(a + b), including the zero and overflow cases.
  function logAdd(logA, logB) {
    if (logA === -Infinity) return logB;
    if (logB === -Infinity) return logA;
    if (logA === Infinity || logB === Infinity) return Infinity;
    var high = Math.max(logA, logB);
    var low = Math.min(logA, logB);
    return high + Math.log1p(Math.exp(low - high));
  }

  function wordsLogMultiplier(state) {
    var words = state.words || {};
    // The live genome expression drives combat immediately. The settled
    // snapshot remains as a compatibility fallback for older saves and for
    // the skill-unlock/backpack flow, which still settles at Boss rewards.
    var storedLog = words.potentialLogMultiplier == null ? NaN : Number(words.potentialLogMultiplier);
    if (storedLog === Infinity) return Infinity;
    if (isFinite(storedLog)) return storedLog;
    var potentialMultiplier = words.potentialMultiplier == null ? NaN : Number(words.potentialMultiplier);
    if (potentialMultiplier > 0) return Math.log(potentialMultiplier);
    storedLog = words.logMultiplier == null ? NaN : Number(words.logMultiplier);
    if (storedLog === Infinity) return Infinity;
    if (isFinite(storedLog)) return storedLog;
    var multiplier = words.multiplier == null ? NaN : Number(words.multiplier);
    return multiplier > 0 ? Math.log(multiplier) : 0;
  }

  function growthLogPower(state) {
    return logPower(state.growthPower);
  }

  function settledLogPower(state) {
    var player = state.player || {};
    var letterScore = window.GenomeSystem && typeof GenomeSystem.letterScore === 'function'
      ? Number(GenomeSystem.letterScore(state))
      : 0;
    var basePower = Number(player.basePower);
    var genomePower = Math.max(0.1, (isFinite(letterScore) ? letterScore : 0) + (isFinite(basePower) ? basePower : 0));
    var genomeLog = Math.log(genomePower) + wordsLogMultiplier(state);
    return logAdd(genomeLog, growthLogPower(state));
  }

  function dashLogMultiplier(state) {
    var dash = state.skills && state.skills.dash;
    var boost = dash ? Number(dash.boost) : 1;
    return boost > 0 ? Math.log(boost) : 0;
  }

  function echoLogMultiplier(state) {
    if (!window.EchoSkill || typeof EchoSkill.getPowerMultiplier !== 'function') return 0;
    var multiplier = Number(EchoSkill.getPowerMultiplier(state));
    return multiplier > 0 ? Math.log(multiplier) : 0;
  }

  function skillLogMultiplier(state) {
    if (window.SkillSystem && typeof SkillSystem.logPowerMultiplier === 'function') {
      var combined = Number(SkillSystem.logPowerMultiplier(state));
      if (combined === Infinity) return Infinity;
      if (isFinite(combined)) return combined;
    }
    return dashLogMultiplier(state) + echoLogMultiplier(state);
  }

  function effectiveLogPower(state) {
    return settledLogPower(state) + skillLogMultiplier(state);
  }

  function settledPower(state) {
    return powerFromLog(settledLogPower(state));
  }

  function effectivePower(state) {
    return powerFromLog(effectiveLogPower(state));
  }

  function formatPower(value, logValue, decimals) {
    var precision = typeof decimals === 'number' ? Math.max(0, Math.floor(decimals)) : 1;
    var numeric = Number(value);
    var log = typeof logValue === 'number' && logValue === logValue ? logValue : logPower(numeric);
    if (log === -Infinity) return (0).toFixed(precision);
    if (log === Infinity) return 'MAX';
    var exponent = Math.floor(log / LN10);
    if (exponent >= 6 || exponent <= -3) {
      var mantissa = Math.exp(log - exponent * LN10);
      return mantissa.toFixed(precision) + 'e' + (exponent >= 0 ? '+' : '') + exponent;
    }
    return powerFromLog(log).toFixed(precision);
  }

  function powerDelta(beforeLog, afterLog) {
    if (afterLog === beforeLog) return 0;
    var before = powerFromLog(beforeLog);
    var after = powerFromLog(afterLog);
    if (after === Number.MAX_VALUE && before < Number.MAX_VALUE) return Number.MAX_VALUE;
    if (before === Number.MAX_VALUE && after < Number.MAX_VALUE) return -Number.MAX_VALUE;
    return after - before;
  }

  function enemyLogPower(enemy) {
    if (!enemy) return -Infinity;
    var base = Number(enemy.power);
    var boost = Number(enemy.chargeBoost || 1);
    if (!(base > 0) || !(boost > 0)) return -Infinity;
    return Math.log(base) + Math.log(boost);
  }

  function powerGap(enemyPower, enemyLog, playerLog) {
    if (!(enemyLog > playerLog)) return 0;
    var enemyValue = powerFromLog(enemyLog);
    var playerValue = powerFromLog(playerLog);
    if (enemyValue < Number.MAX_VALUE && playerValue < Number.MAX_VALUE) {
      return Math.max(0, enemyValue - playerValue);
    }
    // Damage is intentionally bounded when both values are beyond float range.
    return Math.min(1000, Math.exp(Math.min(6.90775527898, enemyLog - playerLog)));
  }

  function visualRadius(state) {
    // The body is the player's combat-power silhouette. Keep temporary
    // multipliers (Dash, Echo, and future power skills) visible immediately
    // so the size check and what the player sees use the same power snapshot.
    var effectiveLog = effectiveLogPower(state);
    var base;
    var dash = state.skills && state.skills.dash;
    if (window.Utils && typeof Utils.powerRadiusFromLog === 'function') {
      base = Utils.powerRadiusFromLog(effectiveLog);
    } else {
      base = Utils.powerRadius(powerFromLog(effectiveLog));
    }
    if (dash && dash.active) {
      var t = Utils.clamp(dash.age / dash.duration, 0, 1);
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
      var rr = visualRadius(state) * 0.88 + enemy.radius * (enemy.chargeScale || 1) * 0.78;
      if (Utils.dist2(player, enemy) > rr * rr) return;
      var enemyLog = enemyLogPower(enemy);

      var playerSize = visualRadius(state);
      var enemySize = enemy.radius * (enemy.chargeScale || 1);
      var sizeAdvantage = playerSize >= enemySize * GameConfig.combat.consumeSizeRatio;
      var playerLog = effectiveLogPower(state);
      var canConsume = enemy.boss
        ? playerLog >= enemyLog
        : enemy.denseCore
          ? sizeAdvantage && playerLog >= enemyLog
          : sizeAdvantage && playerLog >= enemyLog;
      if (canConsume) {
        consume(state, enemy);
      } else {
        hitPlayer(state, enemy, powerFromLog(enemyLog), enemyLog, playerLog);
      }
    });
  }

  function consume(state, enemy) {
    if (enemy.consumed) return;
    var powerBeforeLog = settledLogPower(state);
    enemy.consumed = true;
    var depth = Utils.depthAtY(enemy.y);
    var letter = enemy.dropType === 'growth' ? null : GenomeSystem.rollDropLetter(enemy, depth);
    var isBoss = !!enemy.boss;
    // Confirm the pre-boss genome before any drop can push a leading skill
    // word out of the queue. The reward expression below then adds the new
    // boss word on top of that confirmed snapshot.
    if (isBoss) WordSystem.express(state, 'boss-before-reward');
    if (window.AudioSystem) AudioSystem.play(enemy.boss ? 'boss' : (letter ? 'letter' : 'consume'));
    var gain = 0;
    var lockBeforeDrop = enemy.rewardType === 'lock';
    if (lockBeforeDrop) applyRewardEnemyEffect(state, enemy);

    if (letter && !isBoss) GenomeSystem.addLetter(state, letter, 'enemy');
    if (enemy.dropType === 'growth') {
      gain = enemy.growthValue || GameConfig.growth.fishBase;
      if (window.GrowthSkill && typeof GrowthSkill.modifyGrowthGain === 'function') {
        gain = GrowthSkill.modifyGrowthGain(state, gain, enemy);
      }
      if (window.SkillSystem && typeof SkillSystem.modifyGrowthGain === 'function') {
        var growthResult = SkillSystem.modifyGrowthGain(state, gain, enemy);
        gain = growthResult && typeof growthResult.amount === 'number' ? growthResult.amount : gain;
        if (growthResult && growthResult.triggered) {
          state.floatingTexts.push({
            x: enemy.x,
            y: enemy.y - enemy.radius - 18,
            text: SkillSystem.localizedSynergyName(SkillSystem.synergyById.feedingRush),
            color: GameConfig.palette.gold,
            life: 0.85,
            maxLife: 0.85
          });
        }
      }
      state.growthPower += gain;
    }
    ShotSkill.burst(state, enemy.x, enemy.y, enemy.dropType === 'growth' ? GameConfig.palette.gold : (enemy.fixedDrop ? GameConfig.palette.gold : state.player.accent), enemy.boss ? 32 : 20);
    state.shockwaves.push({ x: enemy.x, y: enemy.y, age: 0, life: enemy.boss ? 0.85 : 0.5, radius: enemy.radius * (enemy.boss ? 3.2 : 2.4), color: enemy.dropType === 'growth' ? GameConfig.palette.gold : state.player.accent });
    if (!letter) {
      state.floatingTexts.push({
        x: enemy.x,
        y: enemy.y,
        text: t('powerLabel', 'POWER') + ' +' + gain.toFixed(1),
        color: GameConfig.palette.gold,
        life: 1,
        maxLife: 1
      });
    }

    if (!lockBeforeDrop) applyRewardEnemyEffect(state, enemy);

    if (isBoss) {
      defeatBoss(state, enemy, letter);
    }

    if (enemy.rewardSiteId) {
      MapSystem.claimRewardSite(state, enemy.rewardSiteId);
    }

    EnemySystem.removeEnemy(state, enemy);
    GameUI.showPowerSurge(state, powerDelta(powerBeforeLog, settledLogPower(state)), !!enemy.boss);
    state.uiDirty = true;
  }

  function applyRewardEnemyEffect(state, enemy) {
    if (enemy.rewardType === 'lock') {
      var block = GenomeSystem.lockCurrentWordBlock(state);
      if (!block) {
        GameUI.toast(state, t('noWordLock', 'No word block locked'), t('buildWordFirst', 'Build a word in the current genome first'));
        return;
      }
      GameUI.toast(state, t('wordLocked', 'Word block locked'), block.word.toUpperCase() + ' ' + t('wordLockBody', 'will resist queue pressure'));
      state.floatingTexts.push({
        x: enemy.x,
        y: enemy.y - 24,
        text: t('lockFlash', 'lock') + ' ' + block.word.toUpperCase(),
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
      text: '+1 ' + t('slot', 'slot'),
      color: GameConfig.palette.gold,
      life: 1,
      maxLife: 1
    });
  }

  function hitPlayer(state, enemy, enemyPower, enemyLog, playerLog) {
    var player = state.player;
    if (player.invulnerable > 0) return;
    if (state.skills.guard.active) {
      state.skills.guard.active = false;
      player.invulnerable = 0.45;
      ShotSkill.burst(state, player.x, player.y, GameConfig.palette.gold, 18);
      if (window.SkillSystem && typeof SkillSystem.onGuardAbsorbed === 'function') SkillSystem.onGuardAbsorbed(state);
      GameUI.toast(state, t('guardImpact', 'Guard absorbed the impact'), t('guardBody', 'No genome factors were lost'));
      if (window.AudioSystem) AudioSystem.play('guard');
      return;
    }
    var dir = Utils.normalize(player.x - enemy.x, player.y - enemy.y);
    var incomingLog = typeof enemyLog === 'number' ? enemyLog : enemyLogPower(enemy);
    var currentPlayerLog = typeof playerLog === 'number' ? playerLog : effectiveLogPower(state);
    var gap = powerGap(enemyPower, incomingLog, currentPlayerLog);
    damageGrowth(state, (enemy.attackDamage || GameConfig.growth.hitLoss) + gap * 0.06, enemy.attackLabel || 'Impact');
    player.vx += dir.x * 280;
    player.vy += dir.y * 280;
    state.uiDirty = true;
  }

  function damageGrowth(state, amount, label) {
    if (state.player.invulnerable > 0) return false;
    state.damageTaken = true;
    if (state.skills.guard.active) {
      state.skills.guard.active = false;
      state.player.invulnerable = 0.45;
      ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.gold, 18);
      if (window.SkillSystem && typeof SkillSystem.onGuardAbsorbed === 'function') SkillSystem.onGuardAbsorbed(state);
      GameUI.toast(state, t('guardAttack', 'Guard absorbed the attack'), t('growthProtected', 'Growth power was protected'));
      if (window.AudioSystem) AudioSystem.play('guard');
      return false;
    }
    var displayLabel = damageLabel(label);
    var powerBeforeLog = settledLogPower(state);
    var removed = [];
    if (state.growthPower > 0) {
      state.growthPower = Math.max(0, state.growthPower - amount);
    } else if (state.genome.letters.length) {
      var lossCount = Utils.clamp(Math.ceil(amount / 1.1), 1, Math.min(3, state.genome.letters.length));
      removed = GenomeSystem.removeFrontFactors(state, lossCount);
      if (!removed.length && state.genome.lockedBlocks.length) {
        state.genome.lockedBlocks.shift();
        removed = GenomeSystem.removeFrontFactors(state, lossCount);
        GameUI.toast(state, t('lockShattered', 'Word lock shattered'), t('lockShatteredBody', 'Collapse pressure broke the oldest locked block'));
      }
    } else {
      triggerFailure(state, displayLabel);
      return false;
    }
    state.player.invulnerable = GameConfig.player.invulnerableAfterHit;
    if (window.AudioSystem) AudioSystem.play('hit');
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: removed.length ? t('genomeLabel', 'GENOME') + ' -' + removed.length : displayLabel + ' -' + amount.toFixed(2),
      color: GameConfig.palette.danger,
      life: 1.05,
      maxLife: 1.05
    });
    ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.danger, 12);
    GameUI.showPowerSurge(state, powerDelta(powerBeforeLog, settledLogPower(state)), false);
    state.uiDirty = true;
    return true;
  }

  function triggerFailure(state, cause) {
    if (state.runOver) return;
    state.runOver = true;
    state.paused = true;
    state.reward = {
      kind: 'failure',
      failure: true,
      title: t('genomeCollapse', 'Genome Collapse'),
      body: t('genomeCollapseBody', 'The current lost its last reserve and the genome could not hold its shape.'),
      pills: [
        t('causeLabel', 'cause') + ': ' + cause,
        t('depthLabel', 'depth') + ': ' + Utils.depthAtY(state.player.y) + 'm',
        t('wordsLabel', 'words') + ': ' + (state.words.found.length || 0),
        t('bossesLabel', 'bosses') + ': ' + state.boss.defeated
      ],
      continueLabel: t('newRun', 'New Run'),
      data: {
        cause: cause,
        depth: Utils.depthAtY(state.player.y),
        words: state.words.found.length || 0,
        bosses: state.boss.defeated
      }
    };
    state.floatingTexts.push({ x: state.player.x, y: state.player.y - 38, text: t('collapseFlash', 'GENOME COLLAPSE'), color: GameConfig.palette.danger, life: 1.8, maxLife: 1.8 });
    ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.danger, 42);
    if (window.AudioSystem) AudioSystem.play('collapse');
    GameUI.showEvolution(state);
  }

  function defeatBoss(state, boss, dropLetter) {
    var gate = boss.gateId ? MapSystem.markBossDefeated(state, boss.gateId) : null;
    if (gate && gate.final) {
      if (dropLetter) GenomeSystem.addLetter(state, dropLetter, 'boss');
      WordSystem.express(state, 'clear');
      state.boss.defeated += 1;
      state.boss.depth = MapSystem.nextBossDepth(state);
      state.runOver = true;
      state.reward = {
        kind: 'clear',
        title: t('runCleared', 'Run Cleared'),
        body: t('runClearedBody', 'The fourth gate collapsed. This genome survived the full descent.'),
        pills: [
          t('finalPowerLabel', 'final power') + ': ' + formatPower(effectivePower(state), effectiveLogPower(state)),
          t('expressedLabel', 'expressed') + ': ' + (state.words.found.length || 0),
          t('genomeLabel', 'genome') + ': ' + state.genome.letters.length + ' / ' + state.genome.capacity
        ],
        continueLabel: t('newRun', 'New Run'),
        clearImage: true,
        data: {
          finalPower: formatPower(effectivePower(state), effectiveLogPower(state)),
          expressed: state.words.found.length || 0,
          genome: state.genome.letters.length + ' / ' + state.genome.capacity
        }
      };
      state.paused = true;
      GameUI.showEvolution(state);
      ImageSystem.generateClearImage(state);
      return;
    }
    var rewardWord = SkillSystem.rewardWord(state) || WordSystem.randomRewardWord();
    var oldCapacity = state.genome.capacity;
    GenomeSystem.expandCapacity(state, 4);
    if (dropLetter) GenomeSystem.addLetter(state, dropLetter, 'boss');
    var rewardResult = GenomeSystem.addWord(state, rewardWord);
    WordSystem.express(state, 'boss');
    state.boss.defeated += 1;
    state.boss.depth = MapSystem.nextBossDepth(state);
    state.reward = {
      kind: 'boss',
      title: t('genomeExpandedResult', 'Genome Expanded'),
      body: t('genomeExpandedBody', 'Boss current collapsed. A word entered the queue, capacity grew, and the avatar re-formed from unlocked words.'),
      pills: [
        t('wordLabel', 'word') + ': ' + (rewardResult.accepted ? rewardWord.text.toUpperCase() : t('rewardBlocked', 'reward could not fit')),
        t('slotsLabel', 'slots') + ': ' + oldCapacity + ' -> ' + state.genome.capacity,
        t('nextGateLabel', 'next gate') + ': ' + state.boss.depth + 'm'
      ],
      rewardWord: rewardWord.text,
      rewardWordAccepted: !!rewardResult.accepted,
      data: {
        word: rewardWord.text,
        wordAccepted: !!rewardResult.accepted,
        slotsBefore: oldCapacity,
        slotsAfter: state.genome.capacity,
        nextDepth: state.boss.depth
      }
    };
    state.paused = true;
    GameUI.showEvolution(state);
  }

  window.CombatSystem = {
    effectivePower: effectivePower,
    settledPower: settledPower,
    effectiveLogPower: effectiveLogPower,
    settledLogPower: settledLogPower,
    formatPower: formatPower,
    powerFromLog: powerFromLog,
    logPower: logPower,
    visualRadius: visualRadius,
    update: update,
    damageGrowth: damageGrowth
  };
})();
