(function () {
  function createEnemy(state, x, y, options) {
    if (typeof options === 'boolean') options = { fixedDrop: options };
    options = options || {};

    var info = MapSystem.queryPoint(state, x, y);
    var depth = Utils.depthAtY(y);
    var layerIndex = info.layerIndex || 1;
    var danger = info.danger || 0;
    var rewardType = options.rewardType || null;
    var power = 1.1 + depth * 0.013 + layerIndex * 0.75 + danger * 4.2 + Utils.rand(0, 2.1);

    if (rewardType === 'letter') power *= 1.1;
    if (rewardType === 'capacity') power *= 1.32;
    if (rewardType === 'lock') power *= 1.58;

    var radius = Utils.clamp(GameConfig.enemies.baseRadius + power * 2.15, 10, GameConfig.enemies.maxRadius + (rewardType ? 8 : 0));
    var bias = options.bias || MapSystem.pickBiasLetter(state, x, y);
    var hue = rewardType ? 44 : Utils.rand(175, 235) - depth * 0.03;

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
      fixedDrop: !!options.fixedDrop || rewardType === 'letter',
      revealed: 0,
      revealScale: 0,
      hurt: 0,
      hue: hue,
      wave: Utils.rand(0, 10),
      special: !!options.fixedDrop || !!rewardType,
      rewardType: rewardType,
      rewardSiteId: options.rewardSiteId || null,
      layerIndex: layerIndex,
      dropChance: info.dropChance,
      regionId: info.region ? info.region.id : null,
      highRisk: !!(info.region && info.region.highRisk)
    };
  }

  function spawnAroundCamera(state) {
    var site = MapSystem.rewardSiteNearCamera(state);
    if (site) return spawnRewardEnemy(state, site);
    return spawnNormalEnemy(state);
  }

  function spawnRewardEnemy(state, site) {
    if (MapSystem.isBlocked(state, site.x, site.y, 28)) return false;
    var enemy = createEnemy(state, site.x, site.y, {
      rewardType: site.type,
      rewardSiteId: site.id,
      bias: site.letter,
      fixedDrop: site.type === 'letter'
    });
    enemy.vx *= 0.25;
    enemy.vy *= 0.25;
    enemy.power += site.layerIndex * 1.6;
    enemy.originalPower = enemy.power;
    enemy.radius += site.type === 'lock' ? 9 : site.type === 'capacity' ? 5 : 2;
    state.enemies.push(enemy);
    MapSystem.markRewardSpawned(state, site.id);
    return true;
  }

  function spawnNormalEnemy(state) {
    var config = GameConfig.enemies;
    var w = state.screen.width;
    var h = state.screen.height;

    for (var attempt = 0; attempt < 10; attempt += 1) {
      var side = Math.random();
      var x;
      var y;

      if (side < 0.44) {
        x = state.camera.x + Utils.rand(-w * 0.58, w * 0.58);
        y = state.camera.y + h * 0.55 + Utils.rand(20, config.spawnMargin);
      } else if (side < 0.74) {
        x = state.camera.x + (Math.random() < 0.5 ? -w * 0.58 : w * 0.58) + Utils.rand(-config.spawnMargin, config.spawnMargin);
        y = state.camera.y + Utils.rand(-h * 0.52, h * 0.58);
      } else {
        x = state.camera.x + Utils.rand(-w * 0.55, w * 0.55);
        y = state.camera.y - h * 0.55 - Utils.rand(20, config.spawnMargin * 0.7);
      }

      y = Utils.clamp(y, 20, state.map.height - 160);
      x = MapSystem.clampToWorldX(state, x, 42);
      if (MapSystem.isBlocked(state, x, y, 32)) continue;
      state.enemies.push(createEnemy(state, x, y, {}));
      return true;
    }

    return false;
  }

  function ensurePopulation(state) {
    var guard = 0;
    while (state.enemies.length < GameConfig.enemies.targetCount && guard < GameConfig.enemies.targetCount * 3) {
      spawnAroundCamera(state);
      guard += 1;
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
      enemy.vx += Math.cos(enemy.wave) * state.dt * (enemy.rewardType ? 4 : 8);
      enemy.vy += Math.sin(enemy.wave * 0.7) * state.dt * (enemy.rewardType ? 3 : 5);
      enemy.vx *= enemy.rewardType ? 0.986 : 0.992;
      enemy.vy *= enemy.rewardType ? 0.986 : 0.992;
      enemy.x += enemy.vx * state.dt;
      enemy.y += enemy.vy * state.dt;
      enemy.x = MapSystem.clampToWorldX(state, enemy.x, enemy.radius);
      enemy.revealed = Math.max(0, enemy.revealed - state.dt);
      enemy.hurt = Math.max(0, enemy.hurt - state.dt);
      enemy.revealScale = Utils.lerp(enemy.revealScale, enemy.revealed > 0 ? 1 : 0, 0.14);

      var keep = Math.abs(enemy.x - state.camera.x) < maxDistX && Math.abs(enemy.y - state.camera.y) < maxDistY;
      if (!keep && enemy.rewardSiteId) MapSystem.releaseRewardSite(state, enemy.rewardSiteId);
      return keep;
    });

    updateBoss(state);
    maybeSpawnBoss(state, player);
  }

  function updateBoss(state) {
    var boss = state.boss.active;
    if (!boss) return;
    var player = state.player;
    var dxHome = boss.x - boss.homeX;
    var dyHome = boss.y - boss.homeY;
    var playerOutsideRoom = Math.abs(player.x - boss.homeX) > boss.roomWidth * 0.62 || Math.abs(player.y - boss.homeY) > boss.roomHeight * 0.62;
    if (Math.abs(player.x - boss.homeX) > boss.roomWidth * 1.15 || Math.abs(player.y - boss.homeY) > boss.roomHeight * 1.05) {
      boss.power = boss.originalPower;
      state.boss.active = null;
      return;
    }
    var toPlayer = Utils.normalize(player.x - boss.x, player.y - boss.y);
    var toHome = Utils.normalize(boss.homeX - boss.x, boss.homeY - boss.y);
    var distHome = Math.sqrt(dxHome * dxHome + dyHome * dyHome);
    boss.wave += state.dt;
    boss.angle = Math.atan2(toPlayer.y, toPlayer.x);
    boss.vx += (playerOutsideRoom ? 0 : toPlayer.x * state.dt * 52) + toHome.x * state.dt * Utils.clamp(distHome, 0, 620) * 0.46;
    boss.vy += (playerOutsideRoom ? 0 : toPlayer.y * state.dt * 40) + toHome.y * state.dt * Utils.clamp(distHome, 0, 620) * 0.46;
    boss.vx += Math.cos(boss.wave * 1.8) * state.dt * 46;
    boss.vy += Math.sin(boss.wave * 1.3) * state.dt * 30;
    boss.vx *= 0.984;
    boss.vy *= 0.984;
    boss.x += boss.vx * state.dt;
    boss.y += boss.vy * state.dt;
    boss.x = MapSystem.clampToWorldX(state, boss.x, boss.radius);
    boss.revealed = Math.max(0, boss.revealed - state.dt);
    boss.hurt = Math.max(0, boss.hurt - state.dt);
    if (playerOutsideRoom) {
      boss.power = Utils.lerp(boss.power, boss.originalPower, 0.08);
      boss.hurt = 0;
    }
    boss.revealScale = Utils.lerp(boss.revealScale, 1, 0.08);
    state.boss.notice = Math.max(0, state.boss.notice - state.dt);
  }

  function maybeSpawnBoss(state, player) {
    if (state.boss.active) return;
    var gate = MapSystem.bossGateNearPlayer(state);
    if (!gate) return;

    var boss = createEnemy(state, gate.x, gate.y - 34, { fixedDrop: true, bias: Utils.pick(['b', 'o', 's', 's', Utils.randomLetter()]) });
    boss.id = 'boss-' + gate.id;
    boss.boss = true;
    boss.gateId = gate.id;
    boss.homeX = gate.x;
    boss.homeY = gate.y - 34;
    boss.roomWidth = gate.roomWidth;
    boss.roomHeight = gate.roomHeight;
    boss.radius = gate.final ? 84 : 62 + gate.layerIndex * 7;
    boss.power = (gate.final ? 32 : 14) + gate.layerIndex * 9 + Utils.depthAtY(gate.y) * 0.033;
    boss.originalPower = boss.power;
    boss.bias = gate.final ? 'z' : boss.bias;
    boss.hue = gate.final ? 285 : 325;
    state.boss.active = boss;
    state.boss.notice = 3;
    GameUI.toast(state, gate.final ? 'Final boss room' : 'Boss room entered', gate.bypassed ? 'The bypassed boss is back at full power' : 'Defeat it here or slip past with enough speed');
  }

  function removeEnemy(state, target) {
    if (target.rewardSiteId && !target.consumed) MapSystem.releaseRewardSite(state, target.rewardSiteId);
    state.enemies = state.enemies.filter(function (enemy) { return enemy !== target; });
    if (state.boss.active === target) state.boss.active = null;
  }

  window.EnemySystem = {
    createEnemy: createEnemy,
    update: update,
    removeEnemy: removeEnemy
  };
})();
