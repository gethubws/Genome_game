(function () {
  function createEnemy(state, x, y, special) {
    var depth = Utils.depthAtY(y);
    var power = 1.1 + depth * 0.018 + Utils.rand(0, 2.2);
    var radius = Utils.clamp(GameConfig.enemies.baseRadius + power * 2.4, 10, GameConfig.enemies.maxRadius);
    var bias = Utils.randomLetter();
    var hue = special ? Utils.rand(38, 56) : Utils.rand(175, 235) - depth * 0.03;

    return {
      id: Math.random().toString(36).slice(2),
      x: x,
      y: y,
      vx: Utils.rand(-28, 28),
      vy: Utils.rand(-12, 18),
      angle: Utils.rand(-Math.PI, Math.PI),
      radius: radius,
      power: power,
      originalPower: power,
      bias: bias,
      fixedDrop: special,
      revealed: 0,
      revealScale: 0,
      hurt: 0,
      hue: hue,
      wave: Utils.rand(0, 10),
      special: special
    };
  }

  function spawnAroundCamera(state) {
    var config = GameConfig.enemies;
    var w = state.screen.width;
    var h = state.screen.height;
    var side = Math.random();
    var x;
    var y;

    if (side < 0.42) {
      x = state.camera.x + Utils.rand(-w * 0.58, w * 0.58);
      y = state.camera.y + h * 0.55 + Utils.rand(20, config.spawnMargin);
    } else if (side < 0.72) {
      x = state.camera.x + (Math.random() < 0.5 ? -w * 0.58 : w * 0.58) + Utils.rand(-config.spawnMargin, config.spawnMargin);
      y = state.camera.y + Utils.rand(-h * 0.52, h * 0.58);
    } else {
      x = state.camera.x + Utils.rand(-w * 0.55, w * 0.55);
      y = state.camera.y - h * 0.55 - Utils.rand(20, config.spawnMargin * 0.7);
    }

    var depth = Utils.depthAtY(y);
    var specialChance = Utils.clamp(config.specialChance + depth / 5000, config.specialChance, 0.18);
    state.enemies.push(createEnemy(state, x, y, Math.random() < specialChance));
  }

  function ensurePopulation(state) {
    while (state.enemies.length < GameConfig.enemies.targetCount) {
      spawnAroundCamera(state);
    }
  }

  function update(state) {
    ensurePopulation(state);

    var player = state.player;
    var maxDistX = state.screen.width / 2 + GameConfig.enemies.despawnMargin;
    var maxDistY = state.screen.height / 2 + GameConfig.enemies.despawnMargin;

    state.enemies = state.enemies.filter(function (enemy) {
      enemy.wave += state.dt;
      enemy.angle += Math.sin(enemy.wave * 1.2) * state.dt * 0.4;
      enemy.vx += Math.cos(enemy.wave) * state.dt * 8;
      enemy.vy += Math.sin(enemy.wave * 0.7) * state.dt * 5;
      enemy.vx *= 0.992;
      enemy.vy *= 0.992;
      enemy.x += enemy.vx * state.dt;
      enemy.y += enemy.vy * state.dt;
      enemy.revealed = Math.max(0, enemy.revealed - state.dt);
      enemy.hurt = Math.max(0, enemy.hurt - state.dt);
      enemy.revealScale = Utils.lerp(enemy.revealScale, enemy.revealed > 0 ? 1 : 0, 0.14);

      return Math.abs(enemy.x - state.camera.x) < maxDistX && Math.abs(enemy.y - state.camera.y) < maxDistY;
    });

    updateBoss(state);

    maybeSpawnBoss(state, player);
  }

  function updateBoss(state) {
    var boss = state.boss.active;
    if (!boss) return;
    var player = state.player;
    var toPlayer = Utils.normalize(player.x - boss.x, player.y - boss.y);
    boss.wave += state.dt;
    boss.angle = Math.atan2(toPlayer.y, toPlayer.x);
    boss.vx += toPlayer.x * state.dt * 34 + Math.cos(boss.wave * 1.8) * state.dt * 48;
    boss.vy += toPlayer.y * state.dt * 24 + Math.sin(boss.wave * 1.3) * state.dt * 30;
    boss.vx *= 0.986;
    boss.vy *= 0.986;
    boss.x += boss.vx * state.dt;
    boss.y += boss.vy * state.dt;
    boss.revealed = Math.max(0, boss.revealed - state.dt);
    boss.hurt = Math.max(0, boss.hurt - state.dt);
    boss.revealScale = Utils.lerp(boss.revealScale, 1, 0.08);
    state.boss.notice = Math.max(0, state.boss.notice - state.dt);
  }

  function maybeSpawnBoss(state, player) {
    if (state.boss.active) return;
    var depth = Utils.depthAtY(player.y);
    if (depth < state.boss.depth - 18) return;

    var y = player.y + state.screen.height * 0.42;
    var boss = createEnemy(state, player.x + Utils.rand(-120, 120), y, true);
    boss.id = 'boss-' + state.boss.defeated;
    boss.boss = true;
    boss.radius = 62 + state.boss.defeated * 8;
    boss.power = 13 + state.boss.depth * 0.05 + state.boss.defeated * 7;
    boss.originalPower = boss.power;
    boss.bias = Utils.pick(['b', 'o', 's', 's', Utils.randomLetter()]);
    boss.hue = 325;
    state.boss.active = boss;
    state.boss.notice = 3;
    GameUI.toast(state, 'Boss current detected', 'Defeat it to evolve the genome');
  }

  function removeEnemy(state, target) {
    state.enemies = state.enemies.filter(function (enemy) { return enemy !== target; });
    if (state.boss.active === target) state.boss.active = null;
  }

  window.EnemySystem = {
    createEnemy: createEnemy,
    update: update,
    removeEnemy: removeEnemy
  };
})();
