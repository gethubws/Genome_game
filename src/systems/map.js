(function () {
  var DROP_CHANCES = [0.25, 0.5, 0.75, 1];
  var LETTER_GROUPS = [
    ['a', 'e', 'i', 'o', 'u', 'y'],
    ['s', 't', 'r', 'n', 'l', 'd'],
    ['c', 'g', 'm', 'p', 'b', 'f'],
    ['h', 'k', 'v', 'w', 'x', 'z', 'q']
  ];
  var REGION_CODES = ['ALPHA', 'BETA', 'DELTA', 'ECHO', 'ION', 'NOVA', 'VEX'];

  function generate(state) {
    var config = GameConfig.map;
    var seed = 'run-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 100000).toString(36);
    var rng = mulberry32(hashString(seed));
    var map = state.map;

    map.seed = seed;
    map.seedHash = hashString(seed);
    map.width = config.worldWidth;
    map.height = config.layerCount * config.layerHeight;
    map.layers = [];
    map.regions = [];
    map.walls = [];
    map.gates = [];
    map.rewardSites = [];
    map.currentLayer = 1;
    map.completed = false;

    for (var i = 0; i < config.layerCount; i += 1) {
      createLayer(state, rng, i);
    }

    state.boss.depth = nextBossDepth(state);
    state.uiDirty = true;
  }

  function createLayer(state, rng, layerIndex) {
    var config = GameConfig.map;
    var top = layerIndex * config.layerHeight;
    var bottom = top + config.layerHeight;
    var group = LETTER_GROUPS[layerIndex % LETTER_GROUPS.length].slice();
    var layerLetters = pickMany(rng, group.concat(Utils.letters), 4);
    var layer = {
      index: layerIndex + 1,
      top: top,
      bottom: bottom,
      letters: layerLetters,
      dropChance: DROP_CHANCES[layerIndex] || 1,
      rewardBudget: config.rewardCounts[layerIndex] || 0,
      rewardClaimed: 0
    };

    state.map.layers.push(layer);
    createRegions(state, rng, layer, group);
    createGateAndWalls(state, rng, layer, layerIndex === config.layerCount - 1);
    createRewardSites(state, rng, layer);
  }

  function createRegions(state, rng, layer, group) {
    var config = GameConfig.map;
    var count = randInt(rng, config.regionCountMin, config.regionCountMax);
    var dangerCount = randInt(rng, config.dangerRegionsMin, config.dangerRegionsMax);
    var candidates = [];
    var i;

    for (i = 0; i < count; i += 1) candidates.push(i);
    shuffle(rng, candidates);

    for (i = 0; i < count; i += 1) {
      var highRisk = candidates.indexOf(i) < dangerCount;
      var yBand = (i + 0.45 + rng() * 0.28) / count;
      var x = rand(rng, -state.map.width * 0.38, state.map.width * 0.38);
      var y = layer.top + yBand * (layer.bottom - layer.top - 460) + 160;
      var letters = pickMany(rng, group.concat(layer.letters, Utils.letters), highRisk ? 4 : 3);
      var region = {
        id: 'region-' + layer.index + '-' + i,
        name: 'L' + layer.index + ' ' + REGION_CODES[i % REGION_CODES.length],
        layerIndex: layer.index,
        x: x,
        y: y,
        rx: rand(rng, 270, highRisk ? 520 : 430),
        ry: rand(rng, 350, highRisk ? 680 : 560),
        letters: letters,
        highRisk: highRisk,
        danger: highRisk ? rand(rng, 0.72, 0.95) : rand(rng, 0.18, 0.52)
      };
      state.map.regions.push(region);
    }
  }

  function createGateAndWalls(state, rng, layer, finalGate) {
    var config = GameConfig.map;
    var halfWidth = state.map.width / 2;
    var y = finalGate ? layer.bottom - 560 : layer.bottom - 210;
    var gateX = rand(rng, -halfWidth * 0.25, halfWidth * 0.25);
    var bypassSide = gateX < 0 ? 1 : -1;
    var bypassX = gateX + bypassSide * rand(rng, halfWidth * 0.52, halfWidth * 0.72);
    bypassX = Utils.clamp(bypassX, -halfWidth + 120, halfWidth - 120);
    var gate = {
      id: 'gate-' + layer.index,
      layerIndex: layer.index,
      x: gateX,
      y: y,
      width: config.gateGapWidth,
      bypassX: bypassX,
      bypassWidth: config.bypassGapWidth,
      defeated: false,
      bypassed: false,
      final: finalGate
    };

    state.map.gates.push(gate);
    addWallBand(state, gate);
  }

  function addWallBand(state, gate) {
    var config = GameConfig.map;
    var halfWidth = state.map.width / 2;
    var y = gate.y - config.wallBandThickness / 2;
    var gaps = [
      { start: gate.x - gate.width / 2, end: gate.x + gate.width / 2, kind: 'gate' },
      { start: gate.bypassX - gate.bypassWidth / 2, end: gate.bypassX + gate.bypassWidth / 2, kind: 'bypass' }
    ].sort(function (a, b) { return a.start - b.start; });
    var cursor = -halfWidth;

    gaps.forEach(function (gap) {
      var start = Utils.clamp(gap.start, -halfWidth, halfWidth);
      var end = Utils.clamp(gap.end, -halfWidth, halfWidth);
      if (start > cursor + 8) addWall(state, cursor, y, start - cursor, config.wallBandThickness, gate.id, gate.layerIndex);
      cursor = Math.max(cursor, end);
    });

    if (cursor < halfWidth - 8) addWall(state, cursor, y, halfWidth - cursor, config.wallBandThickness, gate.id, gate.layerIndex);
  }

  function addWall(state, x, y, w, h, gateId, layerIndex) {
    state.map.walls.push({
      id: 'wall-' + gateId + '-' + state.map.walls.length,
      x: x,
      y: y,
      w: w,
      h: h,
      gateId: gateId,
      layerIndex: layerIndex,
      kind: 'band'
    });
  }

  function createRewardSites(state, rng, layer) {
    var regions = state.map.regions.filter(function (region) {
      return region.layerIndex === layer.index && region.highRisk;
    });
    var budget = layer.rewardBudget;
    if (!regions.length || !budget) return;

    for (var i = 0; i < budget; i += 1) {
      var region = regions[i % regions.length];
      var angle = rand(rng, 0, Math.PI * 2);
      var radius = Math.sqrt(rng()) * 0.58;
      var type = rewardTypeFor(layer.index, i);
      state.map.rewardSites.push({
        id: 'reward-' + layer.index + '-' + i,
        layerIndex: layer.index,
        regionId: region.id,
        x: region.x + Math.cos(angle) * region.rx * radius,
        y: region.y + Math.sin(angle) * region.ry * radius,
        type: type,
        letter: region.letters[Math.floor(rng() * region.letters.length)],
        spawned: false,
        claimed: false
      });
    }
  }

  function rewardTypeFor(layerIndex, index) {
    if (layerIndex >= 3 && index % 8 === 7) return 'lock';
    if (layerIndex >= 2 && index % 4 === 3) return 'capacity';
    return 'letter';
  }

  function update(state) {
    resolvePlayerCollision(state);
    var layer = layerAtY(state, state.player.y);
    if (layer && state.map.currentLayer !== layer.index) {
      state.map.currentLayer = layer.index;
      state.recommendation.dirty = true;
      state.uiDirty = true;
    }
    markBypassedGates(state);
    state.boss.depth = nextBossDepth(state);
  }

  function resolvePlayerCollision(state) {
    if (!state.map || !state.map.walls.length) return;
    var player = state.player;
    var radius = playerCollisionRadius(state);
    var halfWidth = state.map.width / 2;
    var minX = -halfWidth + radius;
    var maxX = halfWidth - radius;

    if (player.x < minX) {
      player.x = minX;
      player.vx = Math.max(0, player.vx);
    } else if (player.x > maxX) {
      player.x = maxX;
      player.vx = Math.min(0, player.vx);
    }

    nearbyWalls(state, player.x, player.y, 260).forEach(function (wall) {
      resolveCircleRect(player, radius, wall);
    });
  }

  function playerCollisionRadius(state) {
    var radius = state.player.radius * 0.96;
    var hasSpeedWord = ['dash', 'rush', 'swim', 'sprint'].some(function (word) {
      return state.words.unlocked.has(word);
    });
    if (state.skills.dash.active && hasSpeedWord) return state.player.radius * 0.55;
    if (hasSpeedWord) return state.player.radius * 0.82;
    return radius;
  }

  function resolveCircleRect(circle, radius, rect) {
    var closestX = Utils.clamp(circle.x, rect.x, rect.x + rect.w);
    var closestY = Utils.clamp(circle.y, rect.y, rect.y + rect.h);
    var dx = circle.x - closestX;
    var dy = circle.y - closestY;
    var d2 = dx * dx + dy * dy;

    if (d2 > radius * radius) return false;

    if (d2 < 0.0001) {
      var left = Math.abs(circle.x - rect.x);
      var right = Math.abs(rect.x + rect.w - circle.x);
      var top = Math.abs(circle.y - rect.y);
      var bottom = Math.abs(rect.y + rect.h - circle.y);
      var min = Math.min(left, right, top, bottom);
      if (min === left) { dx = -1; dy = 0; }
      else if (min === right) { dx = 1; dy = 0; }
      else if (min === top) { dx = 0; dy = -1; }
      else { dx = 0; dy = 1; }
      d2 = 1;
    }

    var d = Math.sqrt(d2);
    var push = radius - d + 0.4;
    var nx = dx / d;
    var ny = dy / d;
    circle.x += nx * push;
    circle.y += ny * push;
    if (Math.abs(nx) > Math.abs(ny)) circle.vx *= -0.18;
    else circle.vy *= -0.18;
    return true;
  }

  function isBlocked(state, x, y, radius) {
    var halfWidth = state.map.width / 2;
    if (x < -halfWidth + radius || x > halfWidth - radius) return true;
    return nearbyWalls(state, x, y, radius + 12).some(function (wall) {
      var closestX = Utils.clamp(x, wall.x, wall.x + wall.w);
      var closestY = Utils.clamp(y, wall.y, wall.y + wall.h);
      var dx = x - closestX;
      var dy = y - closestY;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  function nearbyWalls(state, x, y, pad) {
    return state.map.walls.filter(function (wall) {
      return x + pad >= wall.x && x - pad <= wall.x + wall.w && y + pad >= wall.y && y - pad <= wall.y + wall.h;
    });
  }

  function markBypassedGates(state) {
    state.map.gates.forEach(function (gate) {
      if (gate.final || gate.defeated || gate.bypassed) return;
      if (state.player.y > gate.y + 260) {
        gate.bypassed = true;
        if (state.boss.active && state.boss.active.gateId === gate.id) state.boss.active = null;
        GameUI.toast(state, 'Gate bypassed', 'No boss reward from layer ' + gate.layerIndex);
        state.recommendation.dirty = true;
        state.uiDirty = true;
      }
    });
  }

  function queryPoint(state, x, y) {
    var layer = layerAtY(state, y) || state.map.layers[0];
    var region = regionAt(state, x, y, layer.index);
    var noise = valueNoise(state.map.seedHash || 1, x, y, 620);
    var danger = Utils.clamp(0.06 + layer.index * 0.05 + noise * 0.22, 0, 1);
    var letters = layer.letters;

    if (region) {
      var influence = regionInfluence(region, x, y);
      danger = Utils.clamp(danger * (1 - influence) + region.danger * influence, 0, 1);
      letters = region.letters;
    }

    return {
      layer: layer,
      layerIndex: layer.index,
      region: region,
      danger: danger,
      letters: letters,
      dropChance: layer.dropChance
    };
  }

  function layerAtY(state, y) {
    if (!state.map.layers.length) return null;
    var index = Utils.clamp(Math.floor(Math.max(0, y) / GameConfig.map.layerHeight), 0, state.map.layers.length - 1);
    return state.map.layers[index];
  }

  function regionAt(state, x, y, layerIndex) {
    var best = null;
    var bestScore = 0;
    state.map.regions.forEach(function (region) {
      if (region.layerIndex !== layerIndex) return;
      var score = regionInfluence(region, x, y);
      if (score > bestScore) {
        best = region;
        bestScore = score;
      }
    });
    return bestScore > 0.05 ? best : null;
  }

  function regionInfluence(region, x, y) {
    var dx = (x - region.x) / region.rx;
    var dy = (y - region.y) / region.ry;
    var d = Math.sqrt(dx * dx + dy * dy);
    return Utils.clamp(1 - d, 0, 1);
  }

  function pickBiasLetter(state, x, y) {
    var info = queryPoint(state, x, y);
    return Utils.pick(info.letters || Utils.letters);
  }

  function nextBossGate(state) {
    if (!state.map || !state.map.gates.length) return null;
    for (var i = 0; i < state.map.gates.length; i += 1) {
      var gate = state.map.gates[i];
      if (!gate.defeated && (!gate.bypassed || gate.final)) return gate;
    }
    return null;
  }

  function nextBossDepth(state) {
    var gate = nextBossGate(state);
    return gate ? Utils.depthAtY(gate.y) : Utils.depthAtY(state.map.height);
  }

  function markBossDefeated(state, gateId) {
    var gate = state.map.gates.find(function (item) { return item.id === gateId; });
    if (!gate) return null;
    gate.defeated = true;
    gate.bypassed = false;
    if (gate.final) state.map.completed = true;
    state.recommendation.dirty = true;
    state.uiDirty = true;
    return gate;
  }

  function rewardSiteNearCamera(state) {
    if (!state.map.rewardSites) return null;
    var maxX = state.screen.width * 0.66;
    var maxY = state.screen.height * 0.58;
    for (var i = 0; i < state.map.rewardSites.length; i += 1) {
      var site = state.map.rewardSites[i];
      if (site.claimed || site.spawned) continue;
      if (Math.abs(site.x - state.camera.x) > maxX) continue;
      if (Math.abs(site.y - state.camera.y) > maxY) continue;
      return site;
    }
    return null;
  }

  function markRewardSpawned(state, siteId) {
    var site = findRewardSite(state, siteId);
    if (site) site.spawned = true;
  }

  function claimRewardSite(state, siteId) {
    var site = findRewardSite(state, siteId);
    if (!site || site.claimed) return;
    site.claimed = true;
    var layer = state.map.layers[site.layerIndex - 1];
    if (layer) layer.rewardClaimed += 1;
    state.recommendation.dirty = true;
    state.uiDirty = true;
  }

  function releaseRewardSite(state, siteId) {
    var site = findRewardSite(state, siteId);
    if (site && !site.claimed) site.spawned = false;
  }

  function findRewardSite(state, siteId) {
    if (!siteId || !state.map.rewardSites) return null;
    return state.map.rewardSites.find(function (site) { return site.id === siteId; }) || null;
  }

  function findBestRegionForLetters(state, letters) {
    if (!letters || !letters.length) return null;
    var counts = countLetters(letters);
    var best = null;
    var bestScore = -Infinity;

    state.map.regions.forEach(function (region) {
      var score = 0;
      var regionCounts = countLetters(region.letters);
      Object.keys(counts).forEach(function (letter) {
        score += Math.min(counts[letter], regionCounts[letter] || 0) * 10;
      });
      score += region.highRisk ? 2 : 0;
      score += region.layerIndex * 0.7;
      score -= Math.sqrt(Math.pow(region.x - state.player.x, 2) + Math.pow(region.y - state.player.y, 2)) / 950;
      if (score > bestScore) {
        best = region;
        bestScore = score;
      }
    });

    return best;
  }

  function describeRegion(region) {
    if (!region) return 'scan nearby zones';
    return region.name + ' / ' + region.letters.map(function (letter) { return letter.toUpperCase(); }).join('');
  }

  function clampToWorldX(state, x, radius) {
    var halfWidth = state.map.width / 2;
    return Utils.clamp(x, -halfWidth + radius, halfWidth - radius);
  }

  function visibleRegions(state, pad) {
    var minX = state.camera.x - state.screen.width / 2 - pad;
    var maxX = state.camera.x + state.screen.width / 2 + pad;
    var minY = state.camera.y - state.screen.height / 2 - pad;
    var maxY = state.camera.y + state.screen.height / 2 + pad;
    return state.map.regions.filter(function (region) {
      return region.x + region.rx > minX && region.x - region.rx < maxX && region.y + region.ry > minY && region.y - region.ry < maxY;
    });
  }

  function visibleWalls(state, pad) {
    var minX = state.camera.x - state.screen.width / 2 - pad;
    var maxX = state.camera.x + state.screen.width / 2 + pad;
    var minY = state.camera.y - state.screen.height / 2 - pad;
    var maxY = state.camera.y + state.screen.height / 2 + pad;
    return state.map.walls.filter(function (wall) {
      return wall.x + wall.w > minX && wall.x < maxX && wall.y + wall.h > minY && wall.y < maxY;
    });
  }

  function visibleGates(state, pad) {
    var minY = state.camera.y - state.screen.height / 2 - pad;
    var maxY = state.camera.y + state.screen.height / 2 + pad;
    return state.map.gates.filter(function (gate) { return gate.y > minY && gate.y < maxY; });
  }

  function countLetters(letters) {
    var counts = {};
    letters.forEach(function (letter) {
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }

  function pickMany(rng, source, count) {
    var pool = source.slice();
    var result = [];
    while (pool.length && result.length < count) {
      var index = Math.floor(rng() * pool.length);
      var letter = pool.splice(index, 1)[0];
      if (result.indexOf(letter) === -1) result.push(letter);
    }
    return result;
  }

  function shuffle(rng, list) {
    for (var i = list.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
  }

  function rand(rng, min, max) {
    return min + rng() * (max - min);
  }

  function randInt(rng, min, max) {
    return Math.floor(rand(rng, min, max + 1));
  }

  function valueNoise(seedHash, x, y, scale) {
    var gx = Math.floor(x / scale);
    var gy = Math.floor(y / scale);
    var tx = smooth((x / scale) - gx);
    var ty = smooth((y / scale) - gy);
    var a = cellNoise(seedHash, gx, gy);
    var b = cellNoise(seedHash, gx + 1, gy);
    var c = cellNoise(seedHash, gx, gy + 1);
    var d = cellNoise(seedHash, gx + 1, gy + 1);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }

  function cellNoise(seedHash, x, y) {
    var n = seedHash ^ (x * 374761393) ^ (y * 668265263);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.MapSystem = {
    generate: generate,
    update: update,
    queryPoint: queryPoint,
    layerAtY: layerAtY,
    pickBiasLetter: pickBiasLetter,
    nextBossGate: nextBossGate,
    nextBossDepth: nextBossDepth,
    markBossDefeated: markBossDefeated,
    rewardSiteNearCamera: rewardSiteNearCamera,
    markRewardSpawned: markRewardSpawned,
    claimRewardSite: claimRewardSite,
    releaseRewardSite: releaseRewardSite,
    findBestRegionForLetters: findBestRegionForLetters,
    describeRegion: describeRegion,
    clampToWorldX: clampToWorldX,
    isBlocked: isBlocked,
    visibleRegions: visibleRegions,
    visibleWalls: visibleWalls,
    visibleGates: visibleGates
  };
})();
