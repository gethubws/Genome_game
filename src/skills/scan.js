(function () {
  function scanLevel(state) {
    var flags = state.player.visualFlags;
    var level = 0;
    if (flags.scanSkill) level += 1;
    if (state.words.unlocked.has('look')) level += 1;
    if (state.words.unlocked.has('view')) level += 1;
    return level;
  }

  function tryStart(state) {
    var skill = state.skills.scan;
    if (state.paused || skill.cooldown > 0 || skill.active) return false;

    var level = scanLevel(state);
    skill.active = true;
    skill.age = 0;
    skill.hits = new Set();
    skill.radius = GameConfig.skills.scan.radius + level * 70;
    skill.duration = Math.max(0.58, GameConfig.skills.scan.duration - level * 0.06);
    skill.revealTime = GameConfig.skills.scan.revealTime + level * 0.55;
    skill.cooldown = Math.max(2.9, GameConfig.skills.scan.cooldown - level * 0.45);

    state.particles.push(GameState.createParticle(state.player.x, state.player.y, 0, 0, GameConfig.palette.cyan, 0.55, 7));
    return true;
  }

  function update(state) {
    var skill = state.skills.scan;
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);
    if (!skill.active) return;

    skill.age += state.dt;
    var progress = Utils.clamp(skill.age / skill.duration, 0, 1);
    var radius = skill.radius * progress;
    var ringWidth = 26 + progress * 18;
    var entities = state.enemies.slice();
    if (state.boss.active) entities.push(state.boss.active);

    entities.forEach(function (enemy) {
      if (skill.hits.has(enemy.id)) return;
      var d = Utils.dist(enemy, state.player);
      if (d <= radius + ringWidth && d >= radius - ringWidth) {
        enemy.revealed = skill.revealTime;
        enemy.revealScale = Math.max(enemy.revealScale, 0.3);
        skill.hits.add(enemy.id);
        state.floatingTexts.push({
          x: enemy.x,
          y: enemy.y - enemy.radius - 22,
          text: enemy.bias.toUpperCase(),
          color: enemy.fixedDrop ? GameConfig.palette.gold : GameConfig.palette.cyan,
          life: skill.revealTime,
          maxLife: skill.revealTime
        });
      }
    });

    if (progress >= 1) {
      skill.active = false;
    }
  }

  function charge(state) {
    var base = GameConfig.skills.scan.cooldown;
    return Utils.clamp(1 - state.skills.scan.cooldown / base, 0, 1);
  }

  window.ScanSkill = {
    tryStart: tryStart,
    update: update,
    charge: charge
  };
})();
