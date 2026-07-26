(function () {
  var FALLBACK_CONFIG = {
    cooldown: 10.5,
    duration: 5.4,
    baseRepeat: 0.85
  };

  function config() {
    return (GameConfig.skills && GameConfig.skills.echo) || FALLBACK_CONFIG;
  }

  function t(key, fallback) {
    return window.I18n && I18n.t ? I18n.t(key, fallback) : fallback;
  }

  function skillState(state) {
    if (!state.skills) state.skills = {};
    if (!state.skills.echo) {
      state.skills.echo = {
        cooldown: 0,
        active: false,
        age: 0,
        duration: 0,
        multiplier: 1,
        boost: 1,
        word: '',
        sourceMultiplier: 1
      };
    }
    return state.skills.echo;
  }

  function level(state) {
    if (window.SkillSystem && typeof SkillSystem.potency === 'function') {
      return SkillSystem.potency(state, 'echo');
    }
    if (window.SkillSystem && typeof SkillSystem.level === 'function') {
      return SkillSystem.level(state, 'echo');
    }
    var words = ['echo', 'repeat', 'again', 'resound', 'return'];
    return words.reduce(function (total, word) {
      return total + (state.words && state.words.unlocked && state.words.unlocked.has(word) ? 1 : 0);
    }, 0);
  }

  function strongestWord(state) {
    var entries = (state.words && state.words.occurrences) || [];
    var best = null;
    entries.forEach(function (entry) {
      if (!entry || !entry.word) return;
      if (!best || (entry.word.mult || 1) > (best.word.mult || 1) ||
          ((entry.word.mult || 1) === (best.word.mult || 1) && entry.word.text.length > best.word.text.length)) {
        best = entry;
      }
    });
    if (best) return best.word;
    var found = (state.words && state.words.found) || [];
    found.forEach(function (word) {
      if (!word) return;
      if (!best || (word.mult || 1) > (best.mult || 1) ||
          ((word.mult || 1) === (best.mult || 1) && word.text.length > best.text.length)) {
        best = { word: word };
      }
    });
    return best && best.word ? best.word : null;
  }

  function burst(state) {
    var color = GameConfig.palette.pink;
    if (window.ShotSkill && typeof ShotSkill.burst === 'function') {
      ShotSkill.burst(state, state.player.x, state.player.y, color, 22);
    }
  }

  function tryStart(state) {
    var skill = skillState(state);
    var settings = config();
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    var prime = window.SkillSystem && typeof SkillSystem.echoPrime === 'function'
      ? SkillSystem.echoPrime(state)
      : null;
    var word = prime && prime.word ? prime.word : strongestWord(state);
    if (!word) {
      if (window.GameUI && GameUI.toast) GameUI.toast(state, t('echoFailed', 'Echo failed'), t('noExpressedWord', 'No expressed word is available'));
      return false;
    }

    var rank = level(state);
    var source = Math.max(1, Number(word.mult) || 1);
    var repeat = (settings.baseRepeat || FALLBACK_CONFIG.baseRepeat) + rank * 0.14 + (prime ? prime.repeatBonus : 0);
    skill.active = true;
    skill.age = 0;
    skill.duration = (settings.duration || FALLBACK_CONFIG.duration) + rank * 0.5 + (prime ? prime.durationBonus : 0);
    skill.sourceMultiplier = source;
    skill.multiplier = 1 + (source - 1) * repeat;
    skill.boost = skill.multiplier;
    skill.word = word.text;
    skill.cooldown = Math.max(6.2, (settings.cooldown || FALLBACK_CONFIG.cooldown) - rank * 0.55);
    if (prime && window.SkillSystem && typeof SkillSystem.consumeEchoPrime === 'function') SkillSystem.consumeEchoPrime(state);
    burst(state);
    state.floatingTexts.push({
      x: state.player.x,
      y: state.player.y - 34,
      text: t('echoFlash', 'ECHO') + ' ' + word.text.toUpperCase() + ' x' + skill.multiplier.toFixed(2),
      color: GameConfig.palette.pink,
      life: 1.2,
      maxLife: 1.2
    });
    if (window.GameUI && GameUI.toast) {
      GameUI.toast(state, t('wordEchoed', 'Word echoed'), word.text.toUpperCase() + ' ' + (t('echoAmplifiedFor', 'amplified for')) + ' ' + skill.duration.toFixed(1) + t('eachSecond', 's'));
    }
    return true;
  }

  function update(state) {
    var skill = skillState(state);
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration) {
      if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
        SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.SKILL_ENDED : 'skill:ended', {
          id: 'echo',
          skill: skill,
          natural: true
        });
      }
      skill.active = false;
      skill.multiplier = 1;
      skill.boost = 1;
      skill.word = '';
      skill.sourceMultiplier = 1;
    }
  }

  function getPowerMultiplier(state) {
    return skillState(state).active ? Math.max(1, skillState(state).multiplier || 1) : 1;
  }

  function charge(state) {
    var settings = config();
    var base = settings.cooldown || FALLBACK_CONFIG.cooldown;
    return Utils.clamp(1 - skillState(state).cooldown / base, 0, 1);
  }

  window.EchoSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge,
    getPowerMultiplier: getPowerMultiplier,
    getMultiplier: getPowerMultiplier,
    powerMultiplier: getPowerMultiplier,
    multiplier: getPowerMultiplier,
    level: level
  };
})();
