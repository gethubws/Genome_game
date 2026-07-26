(function () {
  function tryStart(state) {
    var skill = state.skills.nova;
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    var level = SkillSystem.level(state, 'nova');
    skill.active = true;
    skill.age = 0;
    skill.radius = GameConfig.skills.nova.radius + level * 38;
    skill.duration = 0.55;
    skill.cooldown = Math.max(3.8, GameConfig.skills.nova.cooldown - level * 0.45);

    var entities = state.enemies.slice();
    if (state.boss.active) entities.push(state.boss.active);
    entities.forEach(function (enemy) {
      if (Utils.dist(enemy, state.player) > skill.radius) return;
      var weaken = GameConfig.skills.nova.weaken + level * 0.04;
      if (window.SkillSystem && typeof SkillSystem.weakenTarget === 'function') {
        SkillSystem.weakenTarget(state, 'nova', enemy, weaken, 1.7);
      } else {
        enemy.power = Math.max(0.1, enemy.power * (1 - weaken));
        enemy.hurt = 0.6;
      }
    });
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

  window.NovaSkill = { tryStart: tryStart, update: update, charge: charge };
})();
