(function () {
  function dashLevel(state) {
    if (window.SkillSystem && typeof SkillSystem.potency === 'function') {
      return SkillSystem.potency(state, 'dash');
    }
    var level = 0;
    ['dash', 'rush', 'swim', 'sprint'].forEach(function (word) {
      if (state.words.unlocked.has(word)) level += 1;
    });
    return level;
  }

  function tryStart(state) {
    var skill = state.skills.dash;
    if (state.paused) return false;

    // Vector Bend lets an active Dash redirect once without creating a new
    // cooldown cycle. The remaining duration is shortened so the turn is a
    // deliberate commitment rather than a free second Dash.
    if (skill.active) {
      var canBend = window.SkillSystem && typeof SkillSystem.hasEffect === 'function' && SkillSystem.hasEffect(state, 'dash.vector-bend');
      if (!canBend || (skill.redirectsLeft || 0) <= 0) return false;
      var bendDir = inputDirection(state);
      var remaining = Math.max(0, skill.duration - skill.age);
      skill.direction = bendDir;
      skill.age += remaining * 0.25;
      skill.redirectsLeft -= 1;
      if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
        SkillSystem.emitEffect(state, 'dash:redirected', { skill: skill, direction: bendDir });
      }
      return true;
    }
    if (skill.cooldown > 0) return false;

    var dir = inputDirection(state);
    var level = dashLevel(state);
    skill.active = true;
    skill.age = 0;
    skill.direction = dir;
    skill.redirectsLeft = window.SkillSystem && typeof SkillSystem.hasEffect === 'function' && SkillSystem.hasEffect(state, 'dash.vector-bend') ? 1 : 0;
    skill.duration = GameConfig.skills.dash.duration + level * 0.04;
    skill.maxBoost = GameConfig.skills.dash.maxBoost + level * 0.18;
    skill.speed = GameConfig.skills.dash.speed + level * 38;
    skill.cooldown = Math.max(1.7, GameConfig.skills.dash.cooldown - level * 0.22);
    return true;
  }

  function inputDirection(state) {
    var angle = state.player.angle;
    var input = state.input.keys;
    var x = 0;
    var y = 0;
    if (input.a || input.arrowleft) x -= 1;
    if (input.d || input.arrowright) x += 1;
    if (input.w || input.arrowup) y -= 1;
    if (input.s || input.arrowdown) y += 1;
    return Math.abs(x) + Math.abs(y) > 0 ? Utils.normalize(x, y) : { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function update(state) {
    var skill = state.skills.dash;
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    skill.boost = 1;
    if (!skill.active) return;

    skill.age += state.dt;
    var t = Utils.clamp(skill.age / skill.duration, 0, 1);
    var swell = Math.sin(t * Math.PI);
    skill.boost = Utils.lerp(1.08, skill.maxBoost, t);
    state.player.vx = skill.direction.x * skill.speed * (1 + swell * 0.25);
    state.player.vy = skill.direction.y * skill.speed * (1 + swell * 0.25);
    if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
      SkillSystem.emitEffect(state, 'dash:update', { skill: skill, progress: t });
    }

    if (Math.random() < 0.85) {
      state.particles.push(GameState.createParticle(
        state.player.x - skill.direction.x * state.player.radius,
        state.player.y - skill.direction.y * state.player.radius,
        -skill.direction.x * Utils.rand(18, 70),
        -skill.direction.y * Utils.rand(18, 70),
        state.player.accent,
        Utils.rand(0.22, 0.48),
        Utils.rand(2, 6)
      ));
    }

    if (t >= 1) {
      if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
        SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.SKILL_ENDED : 'skill:ended', { id: 'dash', skill: skill, natural: true });
      }
      skill.active = false;
      skill.boost = 1;
    }
  }

  function charge(state) {
    var base = GameConfig.skills.dash.cooldown;
    return Utils.clamp(1 - state.skills.dash.cooldown / base, 0, 1);
  }

  function getPowerMultiplier(state) {
    var skill = state.skills && state.skills.dash;
    return skill && skill.active ? Math.max(1, Number(skill.boost) || 1) : 1;
  }

  window.DashSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge,
    getPowerMultiplier: getPowerMultiplier
  };
})();
