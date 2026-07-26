(function () {
  function targets(state) {
    var entities = state.enemies.slice();
    if (state.boss.active) entities.push(state.boss.active);
    return entities;
  }

  function resolvePulse(state, spec) {
    var origin = spec.origin || state.player;
    var hits = [];
    targets(state).forEach(function (enemy) {
      if (Utils.dist(enemy, origin) > spec.radius) return;
      if (window.SkillSystem && typeof SkillSystem.weakenTarget === 'function') {
        SkillSystem.weakenTarget(state, spec.sourceId || 'nova', enemy, spec.weaken, spec.duration);
      } else {
        enemy.power = Math.max(0.1, enemy.power * (1 - spec.weaken));
        enemy.hurt = 0.6;
      }
      hits.push(enemy);
    });
    if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
      SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.AREA_RESOLVED : 'area:resolved', {
        id: 'nova',
        origin: origin,
        radius: spec.radius,
        weaken: spec.weaken,
        duration: spec.duration,
        primary: !!spec.primary,
        replay: !!spec.replay,
        targets: hits
      });
    }
    return hits;
  }

  function tryStart(state) {
    var skill = state.skills.nova;
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    var level = SkillSystem.level(state, 'nova');
    skill.active = true;
    skill.age = 0;
    skill.radius = GameConfig.skills.nova.radius + level * 38;
    skill.duration = 0.55;
    skill.weaken = GameConfig.skills.nova.weaken + level * 0.04;
    skill.weaknessDuration = 1.7;
    skill.cooldown = Math.max(3.8, GameConfig.skills.nova.cooldown - level * 0.45);

    var pulse = {
      id: 'nova',
      origin: state.player,
      radius: skill.radius,
      weaken: skill.weaken,
      duration: skill.weaknessDuration,
      primary: true
    };
    if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
      pulse = SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.AREA_PREPARE : 'area:prepare', pulse);
    }
    resolvePulse(state, pulse);
    ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.pink, 28);
    return true;
  }

  function update(state) {
    var skill = state.skills.nova;
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration) skill.active = false;
  }

  function charge(state) {
    return Utils.clamp(1 - state.skills.nova.cooldown / GameConfig.skills.nova.cooldown, 0, 1);
  }

  window.NovaSkill = { tryStart: tryStart, update: update, charge: charge, resolvePulse: resolvePulse };
})();
