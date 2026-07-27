(function () {
  function applyField(state, radius, duration, options) {
    var entities = state.enemies.slice();
    if (state.boss.active) entities.push(state.boss.active);
    entities.forEach(function (enemy) {
      var distance = Utils.dist(enemy, state.player);
      if (distance > radius) return;
      enemy.frozen = Math.max(enemy.frozen || 0, duration);
      if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
        SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.STATUS_APPLIED : 'status:applied', {
          sourceId: 'freeze',
          status: 'frozen',
          target: enemy,
          radius: radius,
          duration: duration,
          distance: distance,
          replay: !!(options && options.replay)
        });
      }
    });
    return entities;
  }

  function tryStart(state) {
    var skill = state.skills.freeze;
    if (state.paused || skill.cooldown > 0) return false;
    var level = SkillSystem.level(state, 'freeze');
    var radius = GameConfig.skills.freeze.radius + level * 42;
    var duration = GameConfig.skills.freeze.duration + level * 0.55;
    applyField(state, radius, duration);
    skill.lastRadius = radius;
    skill.lastDuration = duration;
    skill.cooldown = Math.max(4.4, GameConfig.skills.freeze.cooldown - level * 0.5);
    ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.cyan, 24);
    return true;
  }

  function update(state) {
    state.skills.freeze.cooldown = Math.max(0, state.skills.freeze.cooldown - state.dt);
    state.enemies.forEach(function (enemy) {
      enemy.frozen = Math.max(0, (enemy.frozen || 0) - state.dt);
      if (enemy.frozen > 0) {
        enemy.vx *= Math.pow(0.82, state.dt * 60);
        enemy.vy *= Math.pow(0.82, state.dt * 60);
      }
    });
    if (state.boss.active) {
      state.boss.active.frozen = Math.max(0, (state.boss.active.frozen || 0) - state.dt);
      if (state.boss.active.frozen > 0) {
        state.boss.active.vx *= Math.pow(0.9, state.dt * 60);
        state.boss.active.vy *= Math.pow(0.9, state.dt * 60);
      }
    }
  }

  function charge(state) {
    return Utils.clamp(1 - state.skills.freeze.cooldown / GameConfig.skills.freeze.cooldown, 0, 1);
  }

  window.FreezeSkill = { tryStart: tryStart, update: update, charge: charge, applyField: applyField };
})();
