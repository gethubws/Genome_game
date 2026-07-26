(function () {
  function tryStart(state) {
    var skill = state.skills.guard;
    if (state.paused || skill.cooldown > 0 || skill.active) return false;
    var level = SkillSystem.level(state, 'guard');
    skill.active = true;
    skill.age = 0;
    skill.absorbed = false;
    skill.duration = GameConfig.skills.guard.duration + level * 0.45;
    skill.cooldown = Math.max(5.4, GameConfig.skills.guard.cooldown - level * 0.55);
    ShotSkill.burst(state, state.player.x, state.player.y, GameConfig.palette.gold, 14);
    return true;
  }

  function update(state) {
    var skill = state.skills.guard;
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;
    skill.age += state.dt;
    if (skill.age >= skill.duration) {
      if (window.SkillSystem && typeof SkillSystem.emitEffect === 'function') {
        SkillSystem.emitEffect(state, window.SkillEffects ? SkillEffects.EVENTS.SKILL_ENDED : 'skill:ended', {
          id: 'guard',
          skill: skill,
          natural: true,
          absorbed: !!skill.absorbed
        });
      }
      skill.active = false;
    }
  }

  function charge(state) {
    return Utils.clamp(1 - state.skills.guard.cooldown / GameConfig.skills.guard.cooldown, 0, 1);
  }

  window.GuardSkill = { tryStart: tryStart, update: update, charge: charge };
})();
