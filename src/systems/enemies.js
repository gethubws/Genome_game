(function () {
  function createEnemy(state, x, y, options) {
    if (typeof options === 'boolean') options = { fixedDrop: options };
    options = options || {};

    var info = MapSystem.queryPoint(state, x, y);
    var depth = Utils.depthAtY(y);
    var layerIndex = info.layerIndex || 1;
    var danger = info.danger || 0;
    var rewardType = options.rewardType || null;
    var kind = options.kind || (rewardType ? 'reward' : Utils.pick(['growth', 'growth', 'growth', 'growth', 'growth', 'letter', 'letter', 'hunter', 'spitter', 'disruptor']));
    var layerBase = GameConfig.enemies.layerPower[layerIndex - 1] || GameConfig.enemies.layerPower[GameConfig.enemies.layerPower.length - 1];
    var areaPower = layerBase + danger * GameConfig.enemies.dangerPower;
    var range = GameConfig.enemies.rolePower[kind] || GameConfig.enemies.rolePower.reward;
    var power = areaPower * Utils.rand(range[0], range[1]);

    if (rewardType === 'capacity') power *= 1.12;
    if (rewardType === 'lock') power *= 1.22;

    var denseCore = !rewardType && kind !== 'growth' && Math.random() < GameConfig.enemies.denseCoreChance;
    var powerDensity = denseCore ? Utils.rand(1.55, 2.15) : 1;
    if (denseCore) power *= Utils.rand(1.12, 1.28);
    var visiblePower = power / powerDensity;
    var radius = Utils.powerRadius(visiblePower);
    var bias = options.bias || MapSystem.pickBiasLetter(state, x, y);
    var hue = rewardType ? 44 : Utils.rand(175, 235) - depth * 0.03;

    return {
      id: Math.random().toString(36).slice(2),
      x: x,
      y: y,
      homeX: options.homeX || x,
      homeY: options.homeY || y,
      territoryRadius: options.territoryRadius || (rewardType ? 430 : 0),
      vx: Utils.rand(-28, 28),
      vy: Utils.rand(-12, 18),
      angle: Utils.rand(-Math.PI, Math.PI),
      radius: radius,
      power: power,
      originalPower: power,
      denseCore: denseCore,
      powerDensity: powerDensity,
      bias: bias,
      fixedDrop: !!options.fixedDrop || rewardType === 'letter',
      revealed: 0,
      revealScale: 0,
      hurt: 0,
      weaknessTimer: 0,
      corrodeTimer: 0,
      corrodeFactor: 0,
      hue: hue,
      wave: Utils.rand(0, 10),
      special: !!options.fixedDrop || !!rewardType,
      rewardType: rewardType,
      rewardSiteId: options.rewardSiteId || null,
      layerIndex: layerIndex,
      dropChance: info.dropChance,
      regionId: info.region ? info.region.id : null,
      highRisk: !!(info.region && info.region.highRisk),
      kind: kind,
      dropType: options.dropType || (kind === 'growth' ? 'growth' : 'letter'),
      attackCooldown: Utils.rand(1.4, 3.4),
      attackDamage: kind === 'hunter' ? 1.4 : kind === 'disruptor' ? 1.1 : 0.8,
      attackLabel: kind === 'hunter' ? 'Pounce' : kind === 'disruptor' ? 'Pulse' : 'Bite',
      attackFlash: 0,
      attackState: 'idle',
      attackAge: 0,
      attackTarget: { x: 0, y: 0 },
      pulseHit: false,
      chargeBoost: 1,
      chargeScale: 1,
      chargeDirection: { x: 0, y: 0 },
      updateStride: Utils.randInt(0, 2),
      calmUntil: state.time + Utils.rand(1.2, 2.2),
      schoolId: options.schoolId || null,
      guardSchoolId: options.guardSchoolId || null,
      schoolX: options.schoolX || x,
      schoolY: options.schoolY || y,
      growthValue: GameConfig.growth.fishBase + (layerIndex - 1) * GameConfig.growth.fishPerLayer
    };
  }

  function syncEnemyRadius(enemy) {
    var density = enemy.denseCore ? Math.max(1, enemy.powerDensity || 1) : 1;
    enemy.radius = Utils.powerRadius(enemy.power / density);
    return enemy.radius;
  }

  function bossPowerForLayer(layerIndex) {
    var config = GameConfig.boss;
    var index = Utils.clamp((layerIndex || 1) - 1, 0, config.powerMultipliers.length - 1);
    return config.referencePower * config.powerMultipliers[index];
  }

  function spawnAroundCamera(state) {
    var site = MapSystem.rewardSiteNearCamera(state);
    if (site) return spawnRewardEnemy(state, site);
    if (state.enemies.length <= GameConfig.enemies.targetCount - 6 && Math.random() < 0.24) return spawnGrowthSchool(state);
    return spawnNormalEnemy(state);
  }

  function spawnGrowthSchool(state) {
    var anchor = findSpawnPoint(state);
    if (!anchor) return false;
    var schoolId = 'school-' + Math.random().toString(36).slice(2);
    var growthCount = Utils.randInt(4, 6);
    var guardCount = Math.random() < 0.38 ? 2 : 1;
    var spawned = 0;
    for (var i = 0; i < growthCount; i += 1) {
      var angle = Utils.rand(0, Math.PI * 2);
      var radius = Utils.rand(28, 135);
      var gx = MapSystem.clampToWorldX(state, anchor.x + Math.cos(angle) * radius, 30);
      var gy = Utils.clamp(anchor.y + Math.sin(angle) * radius, 20, state.map.height - 160);
      if (MapSystem.isBlocked(state, gx, gy, 24)) continue;
      state.enemies.push(createEnemy(state, gx, gy, { kind: 'growth', dropType: 'growth', schoolId: schoolId, schoolX: anchor.x, schoolY: anchor.y }));
      spawned += 1;
    }
    for (var g = 0; g < guardCount; g += 1) {
      var guardAngle = Math.PI * 2 * g / guardCount + Utils.rand(-0.5, 0.5);
      var guardKind = Math.random() < 0.66 ? 'hunter' : 'disruptor';
      state.enemies.push(createEnemy(state, MapSystem.clampToWorldX(state, anchor.x + Math.cos(guardAngle) * 170, 34), anchor.y + Math.sin(guardAngle) * 170, { kind: guardKind, guardSchoolId: schoolId, schoolX: anchor.x, schoolY: anchor.y }));
      spawned += 1;
    }
    return spawned > 0;
  }

  function spawnRewardEnemy(state, site) {
    if (MapSystem.isBlocked(state, site.x, site.y, 28)) return false;
    var enemy = createEnemy(state, site.x, site.y, {
      rewardType: site.type,
      rewardSiteId: site.id,
      bias: site.letter,
      fixedDrop: site.type === 'letter',
      homeX: site.x,
      homeY: site.y,
      territoryRadius: 470 + site.layerIndex * 35
    });
    enemy.vx *= 0.25;
    enemy.vy *= 0.25;
    enemy.power += site.layerIndex * 1.6;
    enemy.originalPower = enemy.power;
    syncEnemyRadius(enemy);
    state.enemies.push(enemy);
    MapSystem.markRewardSpawned(state, site.id);
    return true;
  }

  function spawnNormalEnemy(state) {
    var point = findSpawnPoint(state);
    if (!point) return false;
    state.enemies.push(createEnemy(state, point.x, point.y, {}));
    return true;
  }

  function findSpawnPoint(state) {
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
      if (Utils.dist({ x: x, y: y }, state.player) < 300) continue;
      if (!MapSystem.isBlocked(state, x, y, 32)) return { x: x, y: y };
    }
    return null;
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
    var playerPower = CombatSystem.effectivePower(state);
    var maxDistX = state.screen.width / 2 + GameConfig.enemies.despawnMargin;
    var maxDistY = state.screen.height / 2 + GameConfig.enemies.despawnMargin;

    state.enemies = state.enemies.filter(function (enemy) {
      syncEnemyRadius(enemy);
      enemy.wave += state.dt;
      enemy.angle += Math.sin(enemy.wave * 1.2) * state.dt * 0.4;
      var farFromView = Math.abs(enemy.x - state.camera.x) > state.screen.width * 0.68 || Math.abs(enemy.y - state.camera.y) > state.screen.height * 0.66;
      if (farFromView && (state.tick + enemy.updateStride) % 3 !== 0) {
        enemy.x += enemy.vx * state.dt;
        enemy.y += enemy.vy * state.dt;
        return Math.abs(enemy.x - state.camera.x) < maxDistX && Math.abs(enemy.y - state.camera.y) < maxDistY;
      }
      steerEnemy(state, enemy, player, playerPower);
      enemy.vx += Math.cos(enemy.wave) * state.dt * (enemy.rewardType ? 4 : 8);
      enemy.vy += Math.sin(enemy.wave * 0.7) * state.dt * (enemy.rewardType ? 3 : 5);
      enemy.vx *= enemy.rewardType ? 0.986 : 0.992;
      enemy.vy *= enemy.rewardType ? 0.986 : 0.992;
      limitEnemySpeed(enemy);
      enemy.x += enemy.vx * state.dt;
      enemy.y += enemy.vy * state.dt;
      enemy.x = MapSystem.clampToWorldX(state, enemy.x, enemy.radius);
      enemy.revealed = Math.max(0, enemy.revealed - state.dt);
      enemy.hurt = Math.max(0, enemy.hurt - state.dt);
      enemy.weaknessTimer = Math.max(0, (enemy.weaknessTimer || 0) - state.dt);
      enemy.revealScale = Utils.lerp(enemy.revealScale, enemy.revealed > 0 ? 1 : 0, 0.14);
      enemy.attackCooldown -= state.dt;
      enemy.attackFlash = Math.max(0, enemy.attackFlash - state.dt);
      updateEnemyAttack(state, enemy, player);

      var keep = Math.abs(enemy.x - state.camera.x) < maxDistX && Math.abs(enemy.y - state.camera.y) < maxDistY;
      if (!keep && enemy.rewardSiteId) MapSystem.releaseRewardSite(state, enemy.rewardSiteId);
      return keep;
    });

    updateBoss(state);
    updateEnemyBullets(state);
    maybeSpawnBoss(state, player);
  }

  function limitEnemySpeed(enemy) {
    var maxSpeed = enemy.rewardType ? 105 : enemy.kind === 'growth' ? 62 : enemy.kind === 'letter' ? 70 : enemy.kind === 'hunter' ? 92 : 145;
    if (enemy.attackState === 'windup' && enemy.kind === 'hunter') maxSpeed = 7;
    if (enemy.attackState === 'charge' && enemy.kind === 'hunter') maxSpeed = 560;
    var speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
    if (speed <= maxSpeed || speed <= 0) return;
    enemy.vx = enemy.vx / speed * maxSpeed;
    enemy.vy = enemy.vy / speed * maxSpeed;
  }

  function updateEnemyAttack(state, enemy, player) {
    if (enemy.rewardType || enemy.kind === 'growth' || enemy.kind === 'letter') return;
    if (state.time < enemy.calmUntil) return;
    if (Math.abs(enemy.x - state.camera.x) > state.screen.width * 0.46 || Math.abs(enemy.y - state.camera.y) > state.screen.height * 0.43) return;
    var distance = Utils.dist(enemy, player);
    if (enemy.attackState === 'charge') {
      enemy.attackAge += state.dt;
      var chargeDuration = 0.56;
      var chargeProgress = Utils.clamp(enemy.attackAge / chargeDuration, 0, 1);
      var burstSpeed = chargeProgress < 0.16 ? chargeProgress / 0.16 : chargeProgress > 0.82 ? (1 - chargeProgress) / 0.18 : 1;
      enemy.chargeBoost = 1.6;
      enemy.chargeScale = 1.34;
      enemy.vx = enemy.chargeDirection.x * 560 * Math.max(0, burstSpeed);
      enemy.vy = enemy.chargeDirection.y * 560 * Math.max(0, burstSpeed);
      if (enemy.attackAge >= chargeDuration) {
        enemy.attackState = 'idle';
        enemy.attackAge = 0;
        enemy.chargeBoost = 1;
        enemy.chargeScale = 1;
        enemy.attackCooldown = 2.5;
      }
      return;
    }
    if (enemy.attackState === 'pulse') {
      enemy.attackAge += state.dt;
      var activeDuration = 0.78;
      var activeProgress = Utils.clamp(enemy.attackAge / activeDuration, 0, 1);
      var activeRadius = 26 + activeProgress * 270;
      if (!enemy.pulseHit && distance <= activeRadius + CombatSystem.visualRadius(state) * 0.82) {
        enemy.pulseHit = true;
        CombatSystem.damageGrowth(state, enemy.attackDamage, enemy.attackLabel);
      }
      if (enemy.attackAge >= activeDuration) {
        enemy.attackState = 'idle';
        enemy.attackAge = 0;
        enemy.attackCooldown = 3.8;
      }
      return;
    }
    if (enemy.guardSchoolId) {
      var guardDx = player.x - enemy.schoolX;
      var guardDy = player.y - enemy.schoolY;
      if (guardDx * guardDx + guardDy * guardDy > 330 * 330) return;
    }
    if (enemy.attackState !== 'idle') {
      enemy.attackAge += state.dt;
      var duration = enemy.kind === 'disruptor' ? 1.15 : enemy.kind === 'spitter' ? 0.82 : 0.62;
      if (enemy.attackAge < duration) return;
      if (enemy.kind === 'disruptor') {
        enemy.attackState = 'pulse';
        enemy.attackAge = 0;
        enemy.pulseHit = false;
        enemy.attackFlash = 0.42;
        return;
      }
      if (enemy.kind === 'hunter') {
        enemy.attackState = 'charge';
        enemy.attackAge = 0;
        enemy.chargeDirection = Utils.normalize(enemy.attackTarget.x - enemy.x, enemy.attackTarget.y - enemy.y);
        enemy.attackFlash = 0.42;
        return;
      }
      resolveEnemyAttack(state, enemy, player, distance);
      enemy.attackState = 'idle';
      enemy.attackAge = 0;
      return;
    }
    if (enemy.attackCooldown > 0) return;
    if (enemy.kind === 'hunter' && distance > 315) return;
    if (enemy.kind === 'spitter' && distance > 335) return;
    if (enemy.kind === 'disruptor' && distance > 275) return;
    enemy.attackState = 'windup';
    enemy.attackAge = 0;
    enemy.pulseHit = false;
    enemy.attackTarget = { x: player.x + player.vx * 0.55, y: player.y + player.vy * 0.55 };
  }

  function resolveEnemyAttack(state, enemy, player, distance) {
    if (enemy.kind === 'spitter') {
      var aim = Utils.normalize(enemy.attackTarget.x - enemy.x, enemy.attackTarget.y - enemy.y);
      state.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: aim.x * 210, vy: aim.y * 210, life: 2.5, radius: 11, damage: enemy.attackDamage, label: 'Spitter hit', color: '#ff8a38' });
      enemy.attackCooldown = 2.7;
    }
    enemy.attackFlash = 0.42;
  }

  function updateEnemyBullets(state) {
    state.enemyBullets = state.enemyBullets.filter(function (bullet) {
      bullet.life -= state.dt;
      bullet.x += bullet.vx * state.dt;
      bullet.y += bullet.vy * state.dt;
      if (Utils.dist2(bullet, state.player) <= Math.pow(bullet.radius + CombatSystem.visualRadius(state) * 0.82, 2)) {
        CombatSystem.damageGrowth(state, bullet.damage, bullet.label);
        return false;
      }
      return bullet.life > 0;
    });
  }

  function steerEnemy(state, enemy, player, playerPower) {
    if (enemy.kind === 'growth' || enemy.kind === 'letter') applySchooling(state, enemy);
    if (enemy.kind === 'hunter' && enemy.attackState === 'windup') {
      enemy.vx *= Math.pow(0.72, state.dt * 60);
      enemy.vy *= Math.pow(0.72, state.dt * 60);
      return;
    }
    var toPlayer = Utils.normalize(player.x - enemy.x, player.y - enemy.y);
    var dx = player.x - enemy.x;
    var dy = player.y - enemy.y;
    var playerDist = Math.sqrt(dx * dx + dy * dy);
    var awareness = enemy.rewardType ? 420 : enemy.kind === 'growth' ? 190 : enemy.kind === 'letter' ? 225 : enemy.kind === 'hunter' ? 410 : enemy.kind === 'spitter' ? 440 : 360;

    if (enemy.rewardType) {
      var homeDx = enemy.homeX - enemy.x;
      var homeDy = enemy.homeY - enemy.y;
      var homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);
      if (homeDist > enemy.territoryRadius * 1.28) {
        var toHome = Utils.normalize(homeDx, homeDy);
        enemy.vx += toHome.x * state.dt * 118;
        enemy.vy += toHome.y * state.dt * 118;
        return;
      }
    }

    if (enemy.guardSchoolId) {
      var schoolDx = player.x - enemy.schoolX;
      var schoolDy = player.y - enemy.schoolY;
      var playerNearSchool = schoolDx * schoolDx + schoolDy * schoolDy < 350 * 350;
      if (!playerNearSchool) {
        var patrol = Utils.normalize(enemy.schoolX - enemy.x, enemy.schoolY - enemy.y);
        var patrolDist = Utils.dist(enemy, { x: enemy.schoolX, y: enemy.schoolY });
        enemy.vx += patrol.x * state.dt * (patrolDist > 210 ? 72 : 18);
        enemy.vy += patrol.y * state.dt * (patrolDist > 210 ? 72 : 18);
        enemy.vx += Math.cos(enemy.wave * 0.8) * state.dt * 18;
        enemy.vy += Math.sin(enemy.wave * 0.8) * state.dt * 18;
        return;
      }
    }

    if (playerDist < awareness) {
      var force = 0;
      if (enemy.kind === 'growth') force = playerDist < 105 ? -34 : -15;
      else if (enemy.kind === 'letter') force = playerDist < 120 ? -30 : -12;
      else if (enemy.kind === 'hunter') force = 78;
      else if (enemy.kind === 'spitter') force = playerDist < 245 ? -34 : playerDist > 360 ? 38 : 0;
      else if (enemy.kind === 'disruptor') force = playerDist > 225 ? 44 : -8;
      else force = enemy.power > playerPower ? 64 : -52;
      enemy.vx += toPlayer.x * state.dt * force;
      enemy.vy += toPlayer.y * state.dt * force;
      if (enemy.kind === 'spitter') {
        enemy.vx += -toPlayer.y * Math.sin(enemy.wave * 1.7) * state.dt * 48;
        enemy.vy += toPlayer.x * Math.sin(enemy.wave * 1.7) * state.dt * 48;
      }
    } else if (enemy.rewardType) {
      var returnDir = Utils.normalize(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
      enemy.vx += returnDir.x * state.dt * 34;
      enemy.vy += returnDir.y * state.dt * 34;
    }
  }

  function applySchooling(state, enemy) {
    var centerX = 0;
    var centerY = 0;
    var count = 0;
    state.enemies.forEach(function (other) {
      if (other === enemy || other.kind !== enemy.kind) return;
      if (enemy.schoolId && other.schoolId !== enemy.schoolId) return;
      var dx = other.x - enemy.x;
      var dy = other.y - enemy.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > 360 * 360) return;
      centerX += other.x;
      centerY += other.y;
      count += 1;
      if (d2 < 90 * 90 && d2 > 1) {
        enemy.vx -= dx / d2 * state.dt * 1200;
        enemy.vy -= dy / d2 * state.dt * 1200;
      }
    });
    if (!count) return;
    enemy.vx += (centerX / count - enemy.x) * state.dt * 0.08;
    enemy.vy += (centerY / count - enemy.y) * state.dt * 0.08;
    if (enemy.schoolId) {
      enemy.vx += (enemy.schoolX - enemy.x) * state.dt * 0.045;
      enemy.vy += (enemy.schoolY - enemy.y) * state.dt * 0.045;
    }
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
    boss.weaknessTimer = Math.max(0, (boss.weaknessTimer || 0) - state.dt);
    if (playerOutsideRoom || (boss.corrodeTimer <= 0 && boss.weaknessTimer <= 0)) {
      // Corrode temporarily lowers the recovery target instead of being
      // erased by the boss-room reset. Once its timer expires, full power
      // is restored gradually as before.
      var weakenFactor = boss.corrodeTimer > 0 ? Utils.clamp(Number(boss.corrodeFactor) || 0, 0, 0.9) : 0;
      var recoveryPower = boss.originalPower * (1 - weakenFactor);
      boss.power = Utils.lerp(boss.power, recoveryPower, 0.08);
    }
    if (playerOutsideRoom) {
      boss.hurt = 0;
    }
    syncEnemyRadius(boss);
    boss.revealScale = Utils.lerp(boss.revealScale, boss.revealed > 0 ? 1 : 0, 0.12);
    state.boss.notice = Math.max(0, state.boss.notice - state.dt);
  }

  function maybeSpawnBoss(state, player) {
    if (state.boss.active) return;
    var gate = MapSystem.bossGateNearPlayer(state);
    if (!gate) return;

    var boss = createEnemy(state, gate.x, gate.y - 34, {
      kind: 'boss',
      dropType: 'letter',
      fixedDrop: true,
      bias: Utils.pick(['b', 'o', 's', 's', Utils.randomLetter()])
    });
    boss.id = 'boss-' + gate.id;
    boss.boss = true;
    boss.kind = 'boss';
    boss.gateId = gate.id;
    boss.homeX = gate.x;
    boss.homeY = gate.y - 34;
    boss.roomWidth = gate.roomWidth;
    boss.roomHeight = gate.roomHeight;
    boss.denseCore = false;
    boss.powerDensity = 1;
    boss.power = bossPowerForLayer(gate.layerIndex);
    boss.originalPower = boss.power;
    syncEnemyRadius(boss);
    boss.bias = gate.final ? 'z' : boss.bias;
    boss.hue = gate.final ? 285 : 325;
    state.boss.active = boss;
    state.boss.notice = 3;
    GameUI.toast(
      state,
      I18n.t(gate.final ? 'finalBossRoom' : 'bossRoomEntered', gate.final ? 'Final boss room' : 'Boss room entered'),
      gate.bypassed ? I18n.t('bossRestoredBody', 'The bypassed boss is back at full power') : I18n.t('bossRoomHint', 'Defeat it here or slip past with enough speed')
    );
  }

  function removeEnemy(state, target) {
    if (target.rewardSiteId && !target.consumed) MapSystem.releaseRewardSite(state, target.rewardSiteId);
    state.enemies = state.enemies.filter(function (enemy) { return enemy !== target; });
    if (state.boss.active === target) state.boss.active = null;
  }

  window.EnemySystem = {
    createEnemy: createEnemy,
    bossPowerForLayer: bossPowerForLayer,
    update: update,
    removeEnemy: removeEnemy
  };
})();
