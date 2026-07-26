(function () {
  var FALLBACK_CONFIG = {
    cooldown: 9.5,
    duration: 8.5,
    charges: 3,
    multiplier: 1.55
  };

  function config() {
    return (GameConfig.skills && GameConfig.skills.growth) || FALLBACK_CONFIG;
  }

  function t(key, fallback) {
    return window.I18n && I18n.t ? I18n.t(key, fallback) : fallback;
  }

  function skillState(state) {
    if (!state.skills) state.skills = {};
    if (!state.skills.growth) {
      state.skills.growth = {
        cooldown: 0,
        active: false,
        age: 0,
        duration: 0,
        charges: 0,
        multiplier: 1,
        totalBonus: 0
      };
    }
    return state.skills.growth;
  }

  function level(state) {
    if (window.SkillSystem && typeof SkillSystem.potency === 'function') {
      return SkillSystem.potency(state, 'growth');
    }
    if (window.SkillSystem && typeof SkillSystem.level === 'function') {
      return SkillSystem.level(state, 'growth');
    }
    var words = ['grow', 'growth', 'life', 'sprout', 'rise'];
    return words.reduce(function (total, word) {
      return total + (state.words && state.words.unlocked && state.words.unlocked.has(word) ? 1 : 0);
    }, 0);
  }

  function burst(state, color, count) {
    if (window.ShotSkill && typeof ShotSkill.burst === 'function') {
      ShotSkill.burst(state, state.player.x, state.player.y, color, count);
      return;
    }
    for (var i = 0; i < count; i += 1) {
      var angle = Utils.rand(0, Math.PI * 2);
      state.particles.push(GameState.createParticle(
        state.player.x,
        state.player.y,
        Math.cos(angle) * Utils.rand(30, 110),
        Math.sin(angle) * Utils.rand(30, 110),
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

    var rank = level(state);
    skill.active = true;
    skill.age = 0;
    skill.duration = (settings.duration || FALLBACK_CONFIG.duration) + rank * 0.45;
    skill.charges = Math.max(1, Math.floor(settings.charges || FALLBACK_CONFIG.charges) + Math.min(3, rank));
    skill.multiplier = (settings.multiplier || FALLBACK_CONFIG.multiplier) + rank * 0.12;
    skill.totalBonus = 0;
    skill.cooldown = Math.max(5.4, (settings.cooldown || FALLBACK_CONFIG.cooldown) - rank * 0.42);

    burst(state, GameConfig.palette.gold, 20);
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: t('growthFlash', 'GROWTH') + ' x' + skill.multiplier.toFixed(2),
      color: GameConfig.palette.gold,
      life: 1.05,
      maxLife: 1.05
    });
    if (window.GameUI && GameUI.toast) {
      GameUI.toast(state, t('growthSurge', 'Growth surge'), skill.charges + ' ' + (t('growthCatches', 'empowered growth catches')));
    }
    return true;
  }

  function update(state) {
    var skill = skillState(state);
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration || skill.charges <= 0) {
      skill.active = false;
      skill.charges = 0;
      skill.multiplier = 1;
    }
  }

  // Called by CombatSystem when a growth creature is consumed.
  function modifyGrowthGain(state, amount, enemy) {
    var skill = skillState(state);
    var gain = Math.max(0, Number(amount) || 0);
    if (!skill.active || skill.charges <= 0 || (enemy && enemy.dropType !== 'growth')) return gain;

    var enhanced = gain * Math.max(1, skill.multiplier || 1);
    skill.totalBonus += enhanced - gain;
    skill.charges -= 1;
    if (skill.charges <= 0) {
      skill.charges = 0;
      skill.active = false;
      skill.multiplier = 1;
    }
    return enhanced;
  }

  function charge(state) {
    var settings = config();
    var base = settings.cooldown || FALLBACK_CONFIG.cooldown;
    return Utils.clamp(1 - skillState(state).cooldown / base, 0, 1);
  }

  window.GrowthSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge,
    modifyGrowthGain: modifyGrowthGain,
    apply: modifyGrowthGain,
    onGrowthGain: modifyGrowthGain,
    level: level
  };
})();
