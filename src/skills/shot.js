(function () {
  function shotLevel(state) {
    var level = 0;
    ['shot', 'shoot', 'spit', 'bolt'].forEach(function (word) {
      if (state.words.unlocked.has(word)) level += 1;
    });
    return level;
  }

  function tryFire(state) {
    var skill = state.skills.shot;
    if (state.paused || skill.cooldown > 0) return false;

    var level = shotLevel(state);
    var angle = state.player.angle;
    var pointer = state.input.pointer;
    if (pointer.x || pointer.y) {
      angle = Math.atan2(pointer.worldY - state.player.y, pointer.worldX - state.player.x);
    }

    var speed = GameConfig.skills.shot.speed + level * 52;
    var radius = GameConfig.skills.shot.radius + level * 0.9;
    var weaken = GameConfig.skills.shot.weaken + level * 0.055;
    skill.cooldown = Math.max(0.34, GameConfig.skills.shot.cooldown - level * 0.08);

    state.bullets.push({
      x: state.player.x + Math.cos(angle) * (state.player.radius + 8),
      y: state.player.y + Math.sin(angle) * (state.player.radius + 8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: radius,
      life: GameConfig.skills.shot.life,
      maxLife: GameConfig.skills.shot.life,
      weaken: weaken,
      color: level > 1 ? GameConfig.palette.gold : GameConfig.palette.mint
    });
    return true;
  }

  function update(state) {
    var skill = state.skills.shot;
    skill.cooldown = Math.max(0, skill.cooldown - state.dt);

    state.bullets = state.bullets.filter(function (bullet) {
      bullet.life -= state.dt;
      bullet.x += bullet.vx * state.dt;
      bullet.y += bullet.vy * state.dt;

      var hit = null;
      var entities = state.enemies.slice();
      if (state.boss.active) entities.push(state.boss.active);
      for (var i = 0; i < entities.length; i += 1) {
        var enemy = entities[i];
        var rr = enemy.radius + bullet.radius;
        if (Utils.dist2(enemy, bullet) <= rr * rr) {
          hit = enemy;
          break;
        }
      }

      if (hit) {
        hit.power = Math.max(0.1, hit.power * (1 - bullet.weaken));
        hit.hurt = 0.45;
        hit.revealed = Math.max(hit.revealed, 0.9);
        burst(state, bullet.x, bullet.y, bullet.color, 10);
        return false;
      }

      if (Math.random() < 0.35) {
        state.particles.push(GameState.createParticle(bullet.x, bullet.y, -bullet.vx * 0.04, -bullet.vy * 0.04, bullet.color, 0.18, 2));
      }
      return bullet.life > 0;
    });
  }

  function burst(state, x, y, color, count) {
    for (var i = 0; i < count; i += 1) {
      var angle = Utils.rand(0, Math.PI * 2);
      var speed = Utils.rand(40, 130);
      state.particles.push(GameState.createParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, Utils.rand(0.25, 0.55), Utils.rand(2, 5)));
    }
  }

  function charge(state) {
    var base = GameConfig.skills.shot.cooldown;
    return Utils.clamp(1 - state.skills.shot.cooldown / base, 0, 1);
  }

  window.ShotSkill = {
    tryFire: tryFire,
    update: update,
    charge: charge,
    burst: burst
  };
})();
