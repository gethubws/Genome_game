(function () {
  function resize(state) {
    var canvas = state.canvas;
    var quality = window.SettingsSystem ? SettingsSystem.get().quality : 'standard';
    var dprCap = quality === 'high' ? 2 : quality === 'performance' ? 1 : 1.5;
    var dpr = Math.max(1, Math.min(dprCap, window.devicePixelRatio || 1));
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(320, rect.width || window.innerWidth);
    var height = Math.max(520, rect.height || window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    state.screen.width = width;
    state.screen.height = height;
    state.screen.dpr = dpr;
    state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.uiDirty = true;
  }

  function updateCamera(state) {
    var targetX = state.player.x;
    var targetY = state.player.y + GameConfig.camera.lookAhead;
    state.camera.x = Utils.lerp(state.camera.x, targetX, GameConfig.camera.follow);
    state.camera.y = Utils.lerp(state.camera.y, targetY, GameConfig.camera.follow);
  }

  function updateEffects(state) {
    state.particles = state.particles.filter(function (p) {
      p.life -= state.dt;
      p.x += p.vx * state.dt;
      p.y += p.vy * state.dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      return p.life > 0;
    });

    state.floatingTexts = state.floatingTexts.filter(function (t) {
      t.life -= state.dt;
      t.y -= state.dt * 22;
      return t.life > 0;
    });
    state.shockwaves = state.shockwaves.filter(function (wave) {
      wave.age += state.dt;
      return wave.age < wave.life;
    });
  }

  function draw(state) {
    var ctx = state.ctx;
    ctx.clearRect(0, 0, state.screen.width, state.screen.height);
    drawBackground(state, ctx);
    drawMapOverlay(state, ctx);
    drawParticles(state, ctx, true);
    drawShockwaves(state, ctx);
    state.enemies.forEach(function (enemy) { drawEnemy(state, ctx, enemy); });
    if (state.boss.active) drawBoss(state, ctx, state.boss.active);
    drawBullets(state, ctx);
    drawScan(state, ctx);
    drawSkillFields(state, ctx);
    drawPlayer(state, ctx);
    drawParticles(state, ctx, false);
    drawFloatingTexts(state, ctx);
  }

  function drawShockwaves(state, ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    state.shockwaves.forEach(function (wave) {
      var t = Utils.clamp(wave.age / wave.life, 0, 1);
      var s = Utils.worldToScreen(state, wave);
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 4 - t * 2.5;
      ctx.shadowColor = wave.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(s.x, s.y, wave.radius * t, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawBackground(state, ctx) {
    var depth = Utils.depthAtY(state.player.y);
    var w = state.screen.width;
    var h = state.screen.height;
    var cx = w * 0.5;
    var cy = h * 0.48;
    var radius = Math.min(w, h) * 0.34;

    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#18225d');
    bg.addColorStop(0.18, '#2879b8');
    bg.addColorStop(0.48, '#c7fbef');
    bg.addColorStop(0.72, '#f6ead8');
    bg.addColorStop(1, '#30205d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawCrystalField(state, ctx);
    drawRadarField(state, ctx, cx, cy, radius);
    drawDepthMarks(state, ctx, depth);
  }

  function drawCrystalField(state, ctx) {
    ctx.save();
    var w = state.screen.width;
    var h = state.screen.height;
    var colors = ['#34d9ff', '#9a62ff', '#ff3e8d', '#ffc84a'];
    for (var i = 0; i < 34; i += 1) {
      var x = (i * 137 + state.time * 14 - state.camera.x * 0.08) % (w + 120) - 60;
      var y = (i * 83 - state.time * 9 - state.camera.y * 0.08) % (h + 120) - 60;
      ctx.globalAlpha = 0.14 + (i % 4) * 0.035;
      ctx.fillStyle = colors[i % colors.length];
      fillPolygon(ctx, x, y, 5 + (i % 5) * 4, 3 + (i % 4), state.time * 0.2 + i);
    }
    drawMountainBand(ctx, w, h, 0.83, '#17235a');
    drawMountainBand(ctx, w, h, 0.91, '#101a42');
    ctx.restore();
  }

  function drawRadarField(state, ctx, x, y, radius) {
    ctx.save();
    var glow = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius * 1.25);
    glow.addColorStop(0, 'rgba(255,255,255,0.72)');
    glow.addColorStop(0.32, 'rgba(85,235,232,0.42)');
    glow.addColorStop(0.72, 'rgba(105,205,245,0.16)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    for (var i = 1; i <= 4; i += 1) {
      ctx.globalAlpha = 0.2 + i * 0.05;
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.82)' : 'rgba(53,216,255,0.62)';
      ctx.lineWidth = i === 4 ? 2 : 1;
      ctx.setLineDash(i === 2 ? [2, 5] : []);
      ctx.beginPath();
      ctx.arc(x, y, radius * i / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(x - radius, y);
    ctx.lineTo(x + radius, y);
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x, y + radius);
    ctx.stroke();
    ctx.restore();
  }

  function drawMountainBand(ctx, w, h, base, color) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var x = 0; x <= w + 80; x += 80) {
      ctx.lineTo(x, h * base + Math.sin(x * 0.019) * 30 + ((x / 80) % 3) * 18);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  function drawDepthMarks(state, ctx, depth) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 10px ui-sans-serif, system-ui';
    var meterStep = 100;
    var pixelStep = meterStep / GameConfig.metersPerPixel;
    var start = Math.floor((state.camera.y - state.screen.height / 2) / pixelStep) * pixelStep;
    for (var worldY = start; worldY < state.camera.y + state.screen.height / 2 + pixelStep; worldY += pixelStep) {
      var y = Utils.worldToScreen(state, { x: 0, y: worldY }).y;
      var label = Math.max(0, Math.floor(worldY * GameConfig.metersPerPixel)) + 'm';
      ctx.fillRect(state.screen.width - 72, y, 42, 1);
      ctx.fillText(label, state.screen.width - 122, y + 4);
    }
    ctx.restore();
  }

  function drawMapOverlay(state, ctx) {
    if (!state.map || !state.map.layers.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    MapSystem.visibleRegions(state, 180).forEach(function (region) {
      drawRegionField(state, ctx, region);
    });
    ctx.restore();

    ctx.save();
    MapSystem.visibleWalls(state, 120).forEach(function (wall) {
      drawWallBlock(state, ctx, wall);
    });
    MapSystem.visibleGates(state, 180).forEach(function (gate) {
      drawGateMarker(state, ctx, gate);
    });
    ctx.restore();
  }

  function drawRegionField(state, ctx, region) {
    var s = Utils.worldToScreen(state, region);
    var danger = region.highRisk;
    ctx.save();
    ctx.globalAlpha = danger ? 0.16 : 0.09;
    ctx.fillStyle = danger ? '#ff3e8d' : '#35d8ff';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, region.rx, region.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = danger ? 0.38 : 0.22;
    ctx.strokeStyle = danger ? '#ffc84a' : '#4debd4';
    ctx.lineWidth = danger ? 2 : 1;
    ctx.setLineDash(danger ? [12, 10] : [4, 10]);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, region.rx, region.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawWallBlock(state, ctx, wall) {
    var s = Utils.worldToScreen(state, { x: wall.x, y: wall.y });
    ctx.save();
    ctx.globalAlpha = 0.76;
    ctx.fillStyle = 'rgba(12, 20, 52, 0.82)';
    ctx.strokeStyle = 'rgba(101, 229, 255, 0.38)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, s.x, s.y, wall.w, wall.h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([10, 16]);
    ctx.beginPath();
    ctx.moveTo(s.x + 12, s.y + wall.h * 0.5);
    ctx.lineTo(s.x + wall.w - 12, s.y + wall.h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawGateMarker(state, ctx, gate) {
    var s = Utils.worldToScreen(state, gate);
    var color = gate.final ? '#ff3e8d' : gate.defeated ? '#4debd4' : '#ffc84a';
    ctx.save();
    ctx.globalAlpha = gate.defeated ? 0.12 : 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 16, gate.roomWidth * 0.5, gate.roomHeight * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = gate.defeated ? 0.42 : 0.82;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = gate.final ? 3 : 2;
    ctx.setLineDash(gate.bypassed ? [6, 8] : []);
    ctx.beginPath();
    ctx.moveTo(s.x - gate.width * 0.5, s.y - 36);
    ctx.lineTo(s.x - gate.width * 0.5, s.y + 36);
    ctx.moveTo(s.x + gate.width * 0.5, s.y - 36);
    ctx.lineTo(s.x + gate.width * 0.5, s.y + 36);
    ctx.stroke();
    ctx.setLineDash([]);
    fillPolygon(ctx, s.x, s.y, gate.final ? 16 : 12, gate.final ? 5 : 4, state.time * 0.9);
    ctx.restore();
  }

  function drawParticles(state, ctx, behind) {
    ctx.save();
    state.particles.forEach(function (p) {
      var s = Utils.worldToScreen(state, p);
      var alpha = Utils.clamp(p.life / p.maxLife, 0, 1);
      if (behind && p.size > 6) alpha *= 0.45;
      if (!behind && p.size > 6) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    drawAmbientSpecks(state, ctx);
    ctx.restore();
  }

  function drawAmbientSpecks(state, ctx) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 80; i += 1) {
      var x = (i * 127.7 + state.time * 9 - state.camera.x * 0.1) % (state.screen.width + 40) - 20;
      var y = (i * 73.3 + state.time * 18 - state.camera.y * 0.22) % (state.screen.height + 40) - 20;
      var r = 1 + (i % 5) * 0.18;
      ctx.fillRect(x, y, r, r);
    }
    ctx.restore();
  }

  function drawEnemy(state, ctx, enemy) {
    var s = Utils.worldToScreen(state, enemy);
    if (offscreen(state, s, enemy.radius + 70)) return;
    var style = enemyStyle(state, enemy);
    if (enemy.kind === 'hunter' && enemy.attackState === 'charge') {
      ctx.save();
      ctx.globalAlpha = 0.66;
      ctx.fillStyle = style.color;
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 20;
      var nx = -enemy.chargeDirection.y;
      var ny = enemy.chargeDirection.x;
      var tailX = s.x - enemy.chargeDirection.x * 118;
      var tailY = s.y - enemy.chargeDirection.y * 118;
      ctx.beginPath();
      ctx.moveTo(s.x - enemy.chargeDirection.x * 8 + nx * enemy.radius * 0.52, s.y - enemy.chargeDirection.y * 8 + ny * enemy.radius * 0.52);
      ctx.lineTo(tailX, tailY);
      ctx.lineTo(s.x - enemy.chargeDirection.x * 8 - nx * enemy.radius * 0.52, s.y - enemy.chargeDirection.y * 8 - ny * enemy.radius * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (enemy.rewardType) {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      for (var ring = 0; ring < 2; ring += 1) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, enemy.radius + 8 + ring * 8 + Math.sin(state.time * 3 + ring) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (enemy.attackFlash > 0) {
      ctx.save();
      ctx.globalAlpha = enemy.attackFlash * 1.8;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, enemy.radius + (1 - enemy.attackFlash) * 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (enemy.revealed > 0) drawTargetLine(state, ctx, s, style);
    var visualAngle = enemy.kind === 'growth' ? Math.sin(state.time * 1.8 + enemy.wave) * 0.16 : enemy.angle + state.time * (enemy.kind === 'disruptor' ? 0.9 : 0.45);
    drawGeometricTarget(ctx, s.x, s.y, enemy.radius * (enemy.chargeScale || 1), visualAngle, style, enemy.hurt);
    if (enemy.denseCore) {
      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = '#fff7c7';
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(3, enemy.radius * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (enemy.revealed > 0 || enemy.hurt > 0) {
      drawTargetStatus(ctx, s.x, s.y, enemy.radius * (enemy.chargeScale || 1), style, enemy, canShowTargetPower(enemy));
    }
    drawAttackTelegraph(state, ctx, enemy, s, style);
    drawEnemyInfo(ctx, s, enemy, style);
  }

  function drawBoss(state, ctx, boss) {
    var s = Utils.worldToScreen(state, boss);
    var style = bossStyle(boss);
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = 3;
    for (var i = 0; i < style.rings; i += 1) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, boss.radius + 8 + i * 11 + Math.sin(state.time * 5 + i) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    drawTargetLine(state, ctx, s, style);
    drawLayeredBoss(ctx, s.x, s.y, boss.radius, boss.angle + state.time * 0.25, style, boss.hurt, state.time);
    drawTargetStatus(ctx, s.x, s.y, boss.radius, style, boss, true);
    drawEnemyInfo(ctx, s, boss, style);
  }

  function bossStyle(boss) {
    var layer = boss.layerIndex || 1;
    var styles = [
      { color: '#ff315e', secondary: '#ffc84a', glow: 'rgba(255,49,94,0.68)', outerSides: 3, innerSides: 6, rings: 3 },
      { color: '#35d8ff', secondary: '#9a62ff', glow: 'rgba(53,216,255,0.66)', outerSides: 4, innerSides: 8, rings: 4 },
      { color: '#9a62ff', secondary: '#4debd4', glow: 'rgba(154,98,255,0.7)', outerSides: 5, innerSides: 10, rings: 4 },
      { color: '#ff3e8d', secondary: '#ffd36f', glow: 'rgba(255,62,141,0.78)', outerSides: 7, innerSides: 12, rings: 5 }
    ];
    var style = styles[Utils.clamp(layer - 1, 0, styles.length - 1)];
    return {
      color: style.color,
      secondary: style.secondary,
      glow: style.glow,
      outerSides: style.outerSides,
      innerSides: style.innerSides,
      rings: style.rings,
      shape: 'burst',
      danger: true,
      boss: true
    };
  }

  function enemyStyle(state, enemy) {
    if (enemy.rewardType === 'capacity') return { color: '#fff08a', secondary: '#35d8ff', glow: 'rgba(255,240,138,0.78)', shape: 'octagon', kind: 'reward', danger: true };
    if (enemy.rewardType === 'lock') return { color: '#ff6fd8', secondary: '#ffd36f', glow: 'rgba(255,111,216,0.76)', shape: 'hex', kind: 'reward', danger: true };
    if (enemy.rewardType || enemy.fixedDrop) return { color: '#ffc84a', secondary: '#f8fbff', glow: 'rgba(255,200,74,0.72)', shape: 'hex', kind: 'reward', danger: true };
    if (enemy.kind === 'growth') return { color: '#7cf29a', secondary: '#ffd36f', glow: 'rgba(124,242,154,0.62)', shape: 'circle', kind: 'growth', danger: false };
    if (enemy.kind === 'letter') return { color: '#35d8ff', secondary: '#f8fbff', glow: 'rgba(53,216,255,0.58)', shape: 'diamond', kind: 'letter', danger: false };
    if (enemy.kind === 'hunter') return { color: '#ff315e', secondary: '#ffd36f', glow: 'rgba(255,49,94,0.72)', shape: 'triangle', kind: 'hunter', danger: true };
    if (enemy.kind === 'spitter') return { color: '#ff8a38', secondary: '#ffef91', glow: 'rgba(255,138,56,0.68)', shape: 'square', kind: 'spitter', danger: true };
    return { color: '#9a62ff', secondary: '#4debd4', glow: 'rgba(154,98,255,0.7)', shape: 'hex', kind: 'disruptor', danger: true };
  }

  function colorToGlow(color) {
    var map = {
      '#35d8ff': 'rgba(53,216,255,0.55)',
      '#9a62ff': 'rgba(154,98,255,0.55)',
      '#ff8a38': 'rgba(255,138,56,0.55)',
      '#4debd4': 'rgba(77,235,212,0.55)'
    };
    return map[color] || 'rgba(255,255,255,0.35)';
  }

  function drawTargetLine(state, ctx, s, style) {
    if (!style.danger) return;
    var p = Utils.worldToScreen(state, state.player);
    var dx = s.x - p.x;
    var dy = s.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > Math.min(state.screen.width, state.screen.height) * 0.58) return;
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.danger ? 1.4 : 1;
    ctx.setLineDash(style.danger ? [] : [4, 8]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawAttackTelegraph(state, ctx, enemy, s, style) {
    if (enemy.attackState === 'idle') return;
    if (enemy.kind === 'hunter') return;
    var duration = enemy.attackState === 'pulse' ? 0.78 : enemy.kind === 'disruptor' ? 1.15 : enemy.kind === 'spitter' ? 0.82 : 0.62;
    var progress = Utils.clamp(enemy.attackAge / duration, 0, 1);
    ctx.save();
    ctx.globalAlpha = enemy.attackState === 'pulse' ? 0.95 - progress * 0.2 : 0.25 + progress * 0.45;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = enemy.attackState === 'pulse' ? 5 - progress * 2 : 2 + progress;
    ctx.setLineDash(enemy.attackState === 'pulse' ? [] : [5, 7]);
    if (enemy.kind === 'disruptor') {
      if (enemy.attackState === 'pulse') {
        ctx.shadowColor = style.color;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 26 + progress * 270, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 296, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.75;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 296 - progress * 230, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      var target = Utils.worldToScreen(state, enemy.attackTarget);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGeometricTarget(ctx, x, y, radius, angle, style, hurt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = hurt > 0 ? 0.72 : 1;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = style.boss ? 26 : 16;

    // `radius` is already the shared power-to-size result. Do not shrink
    // ordinary targets here: doing so made equal-power fish look smaller than
    // the player even though collision/consumption used the full radius.
    var r = Math.max(1, Number(radius) || 1);
    ctx.fillStyle = style.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = style.danger ? 2.4 : 1.6;

    if (style.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); }
    else if (style.shape === 'triangle') drawPolygonPath(ctx, r, 3, -Math.PI / 2);
    else if (style.shape === 'square') drawPolygonPath(ctx, r, 4, Math.PI / 4);
    else if (style.shape === 'hex') drawPolygonPath(ctx, r, 6, Math.PI / 6);
    else if (style.shape === 'octagon') drawPolygonPath(ctx, r, 8, Math.PI / 8);
    else if (style.shape === 'diamond') drawPolygonPath(ctx, r, 4, 0);
    else drawStarPath(ctx, r, r * 0.52, style.boss ? 12 : 8);

    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha *= 0.26;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = style.secondary || '#f8fbff';
    ctx.fillStyle = style.secondary || '#f8fbff';
    ctx.lineWidth = 2;
    if (style.kind === 'growth') {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.35, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
    } else if (style.kind === 'letter') {
      ctx.beginPath(); ctx.moveTo(-r * 0.42, 0); ctx.lineTo(r * 0.42, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
    } else if (style.kind === 'hunter') {
      ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.28); ctx.lineTo(r * 0.2, 0); ctx.lineTo(-r * 0.35, r * 0.28); ctx.stroke();
    } else if (style.kind === 'spitter') {
      ctx.fillRect(r * 0.08, -r * 0.18, r * 0.72, r * 0.36);
      ctx.beginPath(); ctx.arc(-r * 0.28, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
    } else if (style.kind === 'disruptor') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.stroke();
    } else if (style.kind === 'reward') {
      drawStarPath(ctx, r * 0.46, r * 0.2, 6); ctx.fill();
    }
    ctx.restore();
  }

  function drawLayeredBoss(ctx, x, y, radius, angle, style, hurt, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = hurt > 0 ? 0.76 : 1;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 30;

    // Bosses use the same outer-radius semantics as the player and ordinary
    // enemies; the inner layers provide visual hierarchy without changing
    // their combat-size silhouette.
    var outer = Math.max(1, Number(radius) || 1);
    ctx.fillStyle = style.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 2.6;
    drawPolygonPath(ctx, outer, style.outerSides, -Math.PI / 2);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-time * 0.9);
    ctx.globalAlpha *= 0.78;
    ctx.fillStyle = style.secondary;
    ctx.strokeStyle = 'rgba(17,26,61,0.72)';
    ctx.lineWidth = 2;
    drawPolygonPath(ctx, outer * 0.62, style.innerSides, Math.PI / style.innerSides);
    ctx.fill();
    ctx.stroke();

    ctx.rotate(time * 1.7);
    ctx.globalAlpha = hurt > 0 ? 0.95 : 0.82;
    ctx.fillStyle = '#f8fbff';
    drawStarPath(ctx, outer * 0.36, outer * 0.16, Math.max(6, Math.floor(style.innerSides / 2)));
    ctx.fill();
    ctx.restore();
  }

  function canShowTargetPower(enemy) {
    return !!(enemy && (enemy.boss || enemy.revealed > 0));
  }

  function drawTargetStatus(ctx, x, y, radius, style, enemy, showPower) {
    ctx.save();
    // Status marks sit below the full body radius. This used to be based on
    // the old 72%-scaled body and would overlap the target after equal-size
    // rendering was restored.
    var baseY = y + Math.max(18, radius + 10);
    ctx.globalAlpha = enemy.hurt > 0 ? 0.95 : 0.7;
    ctx.fillStyle = style.color;
    for (var i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x - 8 + i * 8, baseY, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!showPower) {
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - 13, baseY + 6, 26, 2);
    ctx.fillStyle = style.color;
    ctx.fillRect(x - 13, baseY + 6, 26 * Utils.clamp(enemy.power / enemy.originalPower, 0.05, 1), 2);
    ctx.restore();
  }

  function localizedEnemyRole(enemy) {
    if (enemy.boss) return 'Boss';
    var rewardLabels = {
      capacity: ['rewardCapacity', 'Capacity Reward'],
      lock: ['rewardLock', 'Lock Reward'],
      letter: ['rewardLetter', 'Letter Reward']
    };
    var enemyLabels = {
      growth: ['enemyGrowth', 'Growth Fish'],
      letter: ['enemyLetter', 'Letter Fish'],
      hunter: ['enemyHunter', 'Hunter'],
      spitter: ['enemySpitter', 'Spitter'],
      disruptor: ['enemyDisruptor', 'Disruptor']
    };
    var label = enemy.rewardType ? rewardLabels[enemy.rewardType] : enemyLabels[enemy.kind];
    return label && window.I18n && I18n.t ? I18n.t(label[0], label[1]) : (label ? label[1] : 'Target');
  }

  function drawEnemyInfo(ctx, s, enemy, style) {
    if (enemy.revealScale <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = enemy.revealScale * Utils.clamp(enemy.revealed / 0.35, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var y = s.y - enemy.radius - 24;
    var width = Math.max(102, enemy.radius * 4.1);
    var height = 35;
    ctx.fillStyle = 'rgba(17,26,61,0.86)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.6;
    roundRect(ctx, s.x - width / 2, y - height / 2, width, height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 10px ui-sans-serif, system-ui';
    ctx.fillStyle = style.color;
    var role = localizedEnemyRole(enemy);
    ctx.fillText(role + '  ' + (enemy.power * (enemy.chargeBoost || 1)).toFixed(1), s.x, y - 7);
    ctx.font = '800 9px ui-sans-serif, system-ui';
    ctx.fillStyle = '#f8fbff';
    var growthLabel = window.I18n && I18n.t ? I18n.t('scanGrowthPower', 'GROWTH POWER') : 'GROWTH POWER';
    var letterLabel = window.I18n && I18n.t ? I18n.t('scanLetter', 'LETTER') : 'LETTER';
    ctx.fillText(enemy.dropType === 'growth' ? growthLabel + ' +' + enemy.growthValue.toFixed(1) : letterLabel + ' ' + enemy.bias.toUpperCase(), s.x, y + 8);
    ctx.restore();
  }

  function drawBullets(state, ctx) {
    ctx.save();
    state.bullets.forEach(function (bullet) {
      var s = Utils.worldToScreen(state, bullet);
      var alpha = Utils.clamp(bullet.life / bullet.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = bullet.color;
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 16;
      drawStarPathAt(ctx, s.x, s.y, bullet.radius * 2.1, bullet.radius * 0.7, 6, state.time * 4);
      ctx.fill();
    });
    state.enemyBullets.forEach(function (bullet) {
      var s = Utils.worldToScreen(state, bullet);
      ctx.globalAlpha = Utils.clamp(bullet.life / 0.4, 0.35, 1);
      var color = bullet.color || GameConfig.palette.danger;
      ctx.strokeStyle = color;
      ctx.lineWidth = bullet.radius * 0.72;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(s.x - bullet.vx * 0.12, s.y - bullet.vy * 0.12);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = '#fff4b8';
      drawStarPathAt(ctx, s.x, s.y, bullet.radius * 2.1, bullet.radius * 0.78, 5, -state.time * 5);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawScan(state, ctx) {
    var skill = state.skills.scan;
    if (!skill.active) return;
    var t = Utils.clamp(skill.age / skill.duration, 0, 1);
    var radius = skill.radius * t;
    var p = Utils.worldToScreen(state, state.player);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = '#35d8ff';
    ctx.lineWidth = 2 + t * 4;
    ctx.shadowColor = '#35d8ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha *= 0.22;
    ctx.fillStyle = '#35d8ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, radius, -0.35 + state.time * 3, 0.35 + state.time * 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSkillFields(state, ctx) {
    var p = Utils.worldToScreen(state, state.player);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (state.skills.nova.active) {
      var novaT = Utils.clamp(state.skills.nova.age / state.skills.nova.duration, 0, 1);
      ctx.globalAlpha = 1 - novaT;
      ctx.strokeStyle = GameConfig.palette.pink;
      ctx.lineWidth = 5 - novaT * 3;
      ctx.shadowColor = GameConfig.palette.pink;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, state.skills.nova.radius * novaT, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (state.skills.guard.active) {
      var pulse = 0.86 + Math.sin(state.time * 7) * 0.06;
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = GameConfig.palette.gold;
      ctx.lineWidth = 3;
      ctx.shadowColor = GameConfig.palette.gold;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, CombatSystem.visualRadius(state) * 1.25 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(state, ctx) {
    var player = state.player;
    var p = Utils.worldToScreen(state, player);
    var radius = CombatSystem.visualRadius(state);
    var aura = radius * 1.18;
    var flags = player.visualFlags;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = player.invulnerable > 0 && Math.floor(state.time * 18) % 2 === 0 ? 0.55 : 1;

    ctx.strokeStyle = player.accent;
    ctx.globalAlpha *= 0.18;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, aura, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = player.invulnerable > 0 && Math.floor(state.time * 18) % 2 === 0 ? 0.55 : 1;

    ctx.fillStyle = '#f8fbff';
    ctx.strokeStyle = player.accent;
    ctx.lineWidth = 3;
    ctx.shadowColor = player.accent;
    ctx.shadowBlur = SettingsSystem.get().quality === 'performance' ? 8 : 20;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (flags.tail || flags.fish) drawOrbitTrait(ctx, radius, player.accent, state.time);
    if (flags.fin || flags.scale) drawCoreGlyph(ctx, radius, player.color);
    drawPlayerFace(ctx, radius, flags);
    ctx.restore();
  }

  function drawOrbitTrait(ctx, radius, color, time) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.rotate(time * 1.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.34, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCoreGlyph(ctx, radius, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.24;
    fillPolygon(ctx, 0, 0, radius * 0.62, 6, Math.PI / 6);
    ctx.restore();
  }

  function drawPlayerFace(ctx, radius, flags) {
    ctx.save();
    ctx.fillStyle = '#111a3d';
    ctx.beginPath();
    ctx.arc(-radius * 0.27, -radius * 0.08, Math.max(2, radius * 0.08), 0, Math.PI * 2);
    ctx.arc(radius * 0.27, -radius * 0.08, Math.max(2, radius * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111a3d';
    ctx.lineWidth = Math.max(1.4, radius * 0.08);
    ctx.beginPath();
    ctx.arc(0, radius * 0.08, radius * 0.24, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    if (flags.scanSkill) {
      ctx.strokeStyle = '#ffc84a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloatingTexts(state, ctx) {
    var textMode = window.SettingsSystem ? SettingsSystem.get().combatText : 'full';
    if (textMode === 'off') return;
    ctx.save();
    state.floatingTexts.forEach(function (t) {
      if (textMode === 'compact' && !/POWER|GENOME|\+\w/i.test(t.text)) return;
      var s = Utils.worldToScreen(state, t);
      var alpha = Utils.clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = '900 16px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(17, 26, 61, 0.62)';
      ctx.lineWidth = 5;
      ctx.fillStyle = t.color;
      ctx.strokeText(t.text, s.x, s.y);
      ctx.fillText(t.text, s.x, s.y);
    });
    ctx.restore();
  }

  function fillPolygon(ctx, x, y, radius, sides, angle) {
    drawPolygonPathAt(ctx, x, y, radius, sides, angle);
    ctx.fill();
  }

  function drawPolygonPath(ctx, radius, sides, angle) {
    ctx.beginPath();
    for (var i = 0; i < sides; i += 1) {
      var a = angle + i * Math.PI * 2 / sides;
      var x = Math.cos(a) * radius;
      var y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPolygonPathAt(ctx, x, y, radius, sides, angle) {
    ctx.beginPath();
    for (var i = 0; i < sides; i += 1) {
      var a = angle + i * Math.PI * 2 / sides;
      var px = x + Math.cos(a) * radius;
      var py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawStarPath(ctx, outer, inner, points) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i += 1) {
      var r = i % 2 ? inner : outer;
      var a = -Math.PI / 2 + i * Math.PI / points;
      var x = Math.cos(a) * r;
      var y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStarPathAt(ctx, x, y, outer, inner, points, angle) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i += 1) {
      var r = i % 2 ? inner : outer;
      var a = angle - Math.PI / 2 + i * Math.PI / points;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function offscreen(state, s, pad) {
    return s.x < -pad || s.x > state.screen.width + pad || s.y < -pad || s.y > state.screen.height + pad;
  }

  window.RenderSystem = {
    resize: resize,
    updateCamera: updateCamera,
    updateEffects: updateEffects,
    draw: draw,
    canShowTargetPower: canShowTargetPower
  };
})();
