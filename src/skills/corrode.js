(function () {
  var FALLBACK_CONFIG = {
    cooldown: 7.8,
    range: 520,
    weaken: 0.26,
    duration: 3.5
  };

  function config() {
    return (GameConfig.skills && GameConfig.skills.corrode) || FALLBACK_CONFIG;
  }

  function t(key, fallback) {
    return window.I18n && I18n.t ? I18n.t(key, fallback) : fallback;
  }

  function targetLabel(target) {
    if (target.boss) return 'Boss';
    var rewardLabels = {
      capacity: ['rewardCapacity', 'Capacity Reward'],
      lock: ['rewardLock', 'Lock Reward'],
      letter: ['rewardLetter', 'Letter Reward']
    };
    var enemyLabels = {
      growth: ['enemyGrowth', 'Growth Fish'],
      letter: ['enemyLetter', 'Letter Fish'],
      hunter: ['enemyHunter', 'Hunter'],
      spitter: ['enemySpitter', 'Spitter'],
      disruptor: ['enemyDisruptor', 'Disruptor']
    };
    var label = target.rewardType ? rewardLabels[target.rewardType] : enemyLabels[target.kind];
    return label ? t(label[0], label[1]) : 'Target';
  }

  function skillState(state) {
    if (!state.skills) state.skills = {};
    if (!state.skills.corrode) {
      state.skills.corrode = {
        cooldown: 0,
        active: false,
        age: 0,
        duration: 0,
        target: null,
        weaken: 0
      };
    }
    return state.skills.corrode;
  }

  function level(state) {
    if (window.SkillSystem && typeof SkillSystem.potency === 'function') {
      return SkillSystem.potency(state, 'corrode');
    }
    if (window.SkillSystem && typeof SkillSystem.level === 'function') {
      return SkillSystem.level(state, 'corrode');
    }
    var words = ['corrode', 'rust', 'decay', 'break', 'drain'];
    return words.reduce(function (total, word) {
      return total + (state.words && state.words.unlocked && state.words.unlocked.has(word) ? 1 : 0);
    }, 0);
  }

  function entities(state) {
    var list = (state.enemies || []).slice();
    if (state.boss && state.boss.active) list.push(state.boss.active);
    return list.filter(function (enemy) { return enemy && !enemy.consumed; });
  }

  function findTarget(state, range) {
    var player = state.player;
    var pointer = state.input && state.input.pointer;
    var aimX = 0;
    var aimY = 0;
    if (pointer && (pointer.x || pointer.y) && (pointer.worldX || pointer.worldY)) {
      aimX = pointer.worldX - player.x;
      aimY = pointer.worldY - player.y;
    } else {
      aimX = Math.cos(player.angle || 0);
      aimY = Math.sin(player.angle || 0);
    }
    var aim = Utils.normalize(aimX, aimY);
    var best = null;
    var bestScore = Infinity;
    entities(state).forEach(function (enemy) {
      var distance = Utils.dist(player, enemy);
      if (distance > range) return;
      var direction = Utils.normalize(enemy.x - player.x, enemy.y - player.y);
      var alignment = direction.x * aim.x + direction.y * aim.y;
      var score = distance + (1 - alignment) * 115;
      if (enemy.boss) score -= 130;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    });
    return best;
  }

  function burst(state, target) {
    var color = GameConfig.palette.pink || '#ff6fa8';
    if (window.ShotSkill && typeof ShotSkill.burst === 'function') {
      ShotSkill.burst(state, target.x, target.y, color, 18);
    }
  }

  function applyToTarget(state, target, rank) {
    var settings = config();
    var weaken = Utils.clamp((settings.weaken || FALLBACK_CONFIG.weaken) + (rank || 0) * 0.045, 0.08, 0.72);
    target.power = Math.max(0.1, target.power * (1 - weaken));
    target.hurt = Math.max(target.hurt || 0, 0.72);
    target.corrodeTimer = Math.max(target.corrodeTimer || 0, (settings.duration || FALLBACK_CONFIG.duration) + (rank || 0) * 0.35);
    target.corrodeFactor = Math.min(0.9, (target.corrodeFactor || 0) + weaken);
    return weaken;
  }

  function tryStart(state) {
    var skill = skillState(state);
    var settings = config();
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    var rank = level(state);
    var range = (settings.range || FALLBACK_CONFIG.range) + rank * 58;
    var target = findTarget(state, range);
    if (!target) {
      if (window.GameUI && GameUI.toast) GameUI.toast(state, t('corrodeFailed', 'Corrode failed'), t('noTarget', 'No target in range'));
      return false;
    }

    var weaken = applyToTarget(state, target, rank);

    skill.active = true;
    skill.age = 0;
    skill.duration = 0.62;
    skill.target = target;
    skill.weaken = weaken;
    skill.cooldown = Math.max(4.2, (settings.cooldown || FALLBACK_CONFIG.cooldown) - rank * 0.4);
    burst(state, target);
    state.floatingTexts.push({
      x: target.x,
      y: target.y - target.radius - 22,
      text: t('corrodeFlash', 'CORRODE') + ' -' + Math.round(weaken * 100) + '%',
      color: GameConfig.palette.pink,
      life: 1.1,
      maxLife: 1.1
    });
    if (window.GameUI && GameUI.toast) {
      GameUI.toast(state, t('targetCorroded', 'Target corroded'), targetLabel(target) + ' ' + t('powerLabel', 'power') + ' -' + Math.round(weaken * 100) + '%');
    }
    state.uiDirty = true;
    return true;
  }

  function update(state) {
    var skill = skillState(state);
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    (state.enemies || []).forEach(function (enemy) {
      if (enemy.corrodeTimer) enemy.corrodeTimer = Math.max(0, enemy.corrodeTimer - state.dt);
    });
    if (state.boss && state.boss.active && state.boss.active.corrodeTimer) {
      state.boss.active.corrodeTimer = Math.max(0, state.boss.active.corrodeTimer - state.dt);
    }
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration) {
      skill.active = false;
      skill.target = null;
    }
  }

  function charge(state) {
    var settings = config();
    var base = settings.cooldown || FALLBACK_CONFIG.cooldown;
    return Utils.clamp(1 - skillState(state).cooldown / base, 0, 1);
  }

  window.CorrodeSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge,
    applyToTarget: applyToTarget,
    level: level
  };
})();
