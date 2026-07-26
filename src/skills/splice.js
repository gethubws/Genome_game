(function () {
  var FALLBACK_CONFIG = {
    cooldown: 7.6,
    duration: 0.5,
    moves: 1
  };

  function config() {
    return (GameConfig.skills && GameConfig.skills.splice) || FALLBACK_CONFIG;
  }

  function t(key, fallback) {
    return window.I18n && I18n.t ? I18n.t(key, fallback) : fallback;
  }

  function skillState(state) {
    if (!state.skills) state.skills = {};
    if (!state.skills.splice) {
      state.skills.splice = {
        cooldown: 0,
        active: false,
        age: 0,
        duration: 0,
        movedCount: 0,
        lastSequence: ''
      };
    }
    return state.skills.splice;
  }

  function level(state) {
    if (window.SkillSystem && typeof SkillSystem.potency === 'function') {
      return SkillSystem.potency(state, 'splice');
    }
    if (window.SkillSystem && typeof SkillSystem.level === 'function') {
      return SkillSystem.level(state, 'splice');
    }
    var words = ['splice', 'join', 'cut', 'edit', 'link'];
    return words.reduce(function (total, word) {
      return total + (state.words && state.words.unlocked && state.words.unlocked.has(word) ? 1 : 0);
    }, 0);
  }

  function isLocked(genome, index) {
    if (window.GenomeSystem && typeof GenomeSystem.isLockedIndex === 'function') {
      return GenomeSystem.isLockedIndex(genome, index);
    }
    return (genome.lockedBlocks || []).some(function (block) {
      return index >= block.start && index < block.start + block.length;
    });
  }

  function firstUnlockedIndex(genome) {
    for (var i = 0; i < genome.letters.length; i += 1) {
      if (!isLocked(genome, i)) return i;
    }
    return -1;
  }

  function moveToTail(genome, index) {
    if (index < 0 || index >= genome.letters.length) return null;
    var letter = genome.letters.splice(index, 1)[0];
    (genome.lockedBlocks || []).forEach(function (block) {
      if (index < block.start) block.start -= 1;
    });
    genome.letters.push(letter);
    return letter;
  }

  function burst(state) {
    var color = GameConfig.palette.cyan;
    if (window.ShotSkill && typeof ShotSkill.burst === 'function') {
      ShotSkill.burst(state, state.player.x, state.player.y, color, 18);
      return;
    }
    for (var i = 0; i < 18; i += 1) {
      var angle = Utils.rand(0, Math.PI * 2);
      state.particles.push(GameState.createParticle(
        state.player.x,
        state.player.y,
        Math.cos(angle) * Utils.rand(30, 115),
        Math.sin(angle) * Utils.rand(30, 115),
        color,
        Utils.rand(0.25, 0.55),
        Utils.rand(2, 5)
      ));
    }
  }

  function tryStart(state) {
    var skill = skillState(state);
    var settings = config();
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    if (!state.genome || !state.genome.letters.length) return false;

    var rank = level(state);
    var moveCount = Math.max(1, Math.floor(settings.moves || 1) + Math.min(3, Math.floor(rank / 2)));
    var moved = [];
    for (var i = 0; i < moveCount; i += 1) {
      var index = firstUnlockedIndex(state.genome);
      if (index < 0) break;
      var letter = moveToTail(state.genome, index);
      if (letter == null) break;
      moved.push(letter);
    }
    if (!moved.length) {
      if (window.GameUI && GameUI.toast) GameUI.toast(state, t('spliceFailed', 'Splice failed'), t('allLocked', 'Every genome factor is locked'));
      return false;
    }

    if (window.WordSystem && WordSystem.preview) WordSystem.preview(state);
    if (state.recommendation) state.recommendation.dirty = true;
    skill.active = true;
    skill.age = 0;
    skill.duration = (settings.duration || FALLBACK_CONFIG.duration) + rank * 0.08;
    skill.movedCount = moved.length;
    skill.cooldown = Math.max(4.2, (settings.cooldown || FALLBACK_CONFIG.cooldown) - rank * 0.35);
    skill.lastSequence = state.genome.letters.join('');
    state.uiDirty = true;
    burst(state);
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: t('spliceFlash', 'SPLICE') + ' +' + moved.join('').toUpperCase(),
      color: GameConfig.palette.cyan,
      life: 1.05,
      maxLife: 1.05
    });
    if (window.GameUI && GameUI.toast) {
      GameUI.toast(state, t('genomeSpliced', 'Genome spliced'), moved.join('').toUpperCase() + ' ' + t('movedToTail', 'moved to the tail'));
    }
    return true;
  }

  function update(state) {
    var skill = skillState(state);
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration) skill.active = false;
  }

  function charge(state) {
    var settings = config();
    var base = settings.cooldown || FALLBACK_CONFIG.cooldown;
    return Utils.clamp(1 - skillState(state).cooldown / base, 0, 1);
  }

  window.SpliceSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge,
    level: level
  };
})();
