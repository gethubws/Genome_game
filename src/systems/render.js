(function () {
  function resize(state) {
    var canvas = state.canvas;
    var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
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
  }

  function draw(state) {
    var ctx = state.ctx;
    ctx.clearRect(0, 0, state.screen.width, state.screen.height);
    drawBackground(state, ctx);
    drawParticles(state, ctx, true);
    state.enemies.forEach(function (enemy) { drawEnemy(state, ctx, enemy); });
    if (state.boss.active) drawBoss(state, ctx, state.boss.active);
    drawBullets(state, ctx);
    drawScan(state, ctx);
    drawPlayer(state, ctx);
    drawParticles(state, ctx, false);
    drawFloatingTexts(state, ctx);
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
    drawTargetLine(state, ctx, s, style);
    drawGeometricTarget(ctx, s.x, s.y, enemy.radius, enemy.angle + state.time * 0.45, style, enemy.hurt);
    drawTargetStatus(ctx, s.x, s.y, enemy.radius, style, enemy);
    drawEnemyInfo(ctx, s, enemy, style);
  }

  function drawBoss(state, ctx, boss) {
    var s = Utils.worldToScreen(state, boss);
    var style = { color: '#ff3e8d', glow: 'rgba(255,62,141,0.62)', shape: 'burst', danger: true, boss: true };
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = style.glow;
    ctx.lineWidth = 3;
    for (var i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, boss.radius + 8 + i * 12 + Math.sin(state.time * 5 + i) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    drawTargetLine(state, ctx, s, style);
    drawGeometricTarget(ctx, s.x, s.y, boss.radius, boss.angle + state.time * 0.25, style, boss.hurt);
    drawTargetStatus(ctx, s.x, s.y, boss.radius, style, boss);
    drawEnemyInfo(ctx, s, boss, style);
  }

  function enemyStyle(state, enemy) {
    var stronger = enemy.power > CombatSystem.effectivePower(state);
    if (enemy.fixedDrop) return { color: '#ffc84a', glow: 'rgba(255,200,74,0.58)', shape: 'hex', danger: false };
    if (stronger) return { color: '#ff315e', glow: 'rgba(255,49,94,0.62)', shape: 'triangle', danger: true };
    var code = enemy.bias.charCodeAt(0);
    var shapes = ['square', 'hex', 'burst', 'diamond'];
    var colors = ['#35d8ff', '#9a62ff', '#ff8a38', '#4debd4'];
    return {
      color: colors[code % colors.length],
      glow: colorToGlow(colors[code % colors.length]),
      shape: shapes[code % shapes.length],
      danger: false
    };
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
    var p = Utils.worldToScreen(state, state.player);
    var dx = s.x - p.x;
    var dy = s.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > Math.min(state.screen.width, state.screen.height) * 0.58) return;
    ctx.save();
    ctx.globalAlpha = style.danger ? 0.34 : 0.18;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.danger ? 1.4 : 1;
    ctx.setLineDash(style.danger ? [] : [4, 8]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawGeometricTarget(ctx, x, y, radius, angle, style, hurt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = hurt > 0 ? 0.72 : 1;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = style.boss ? 26 : 16;

    var r = style.boss ? radius * 0.72 : Math.max(12, radius * 0.72);
    ctx.fillStyle = style.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = style.danger ? 2.4 : 1.6;

    if (style.shape === 'triangle') drawPolygonPath(ctx, r, 3, -Math.PI / 2);
    else if (style.shape === 'square') drawPolygonPath(ctx, r, 4, Math.PI / 4);
    else if (style.shape === 'hex') drawPolygonPath(ctx, r, 6, Math.PI / 6);
    else if (style.shape === 'diamond') drawPolygonPath(ctx, r, 4, 0);
    else drawStarPath(ctx, r, r * 0.52, style.boss ? 12 : 8);

    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha *= 0.26;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
  }

  function drawTargetStatus(ctx, x, y, radius, style, enemy) {
    ctx.save();
    var baseY = y + Math.max(16, radius * 0.88);
    ctx.globalAlpha = enemy.hurt > 0 ? 0.95 : 0.7;
    ctx.fillStyle = style.color;
    for (var i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x - 8 + i * 8, baseY, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - 13, baseY + 6, 26, 2);
    ctx.fillStyle = style.color;
    ctx.fillRect(x - 13, baseY + 6, 26 * Utils.clamp(enemy.power / enemy.originalPower, 0.05, 1), 2);
    ctx.restore();
  }

  function drawEnemyInfo(ctx, s, enemy, style) {
    if (enemy.revealScale <= 0.02) return;
    ctx.save();
    ctx.globalAlpha = enemy.revealScale * Utils.clamp(enemy.revealed / 0.35, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var y = s.y - enemy.radius - 18;
    var size = Math.max(17, enemy.radius * 0.58);
    ctx.fillStyle = 'rgba(17,26,61,0.86)';
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.6;
    roundRect(ctx, s.x - size * 0.62, y - size * 0.52, size * 1.24, size, 5);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 ' + Math.max(12, size * 0.58) + 'px ui-sans-serif, system-ui';
    ctx.fillStyle = style.color;
    ctx.fillText(enemy.bias.toUpperCase(), s.x, y);
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

  function drawPlayer(state, ctx) {
    var player = state.player;
    var p = Utils.worldToScreen(state, player);
    var aura = CombatSystem.visualRadius(state);
    var radius = Utils.clamp(aura * 0.54, 15, 28);
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
    ctx.shadowBlur = 20;
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
    ctx.save();
    state.floatingTexts.forEach(function (t) {
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
    draw: draw
  };
})();
