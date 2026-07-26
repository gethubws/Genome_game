(function () {
  if (!window.SkillEffects) return;

  var E = SkillEffects.EVENTS;
  var palette = (window.GameConfig && GameConfig.palette) || {};

  function numberOr(value, fallback) {
    var numeric = Number(value);
    return typeof numeric === 'number' && isFinite(numeric) ? numeric : fallback;
  }

  function now(state) {
    return numberOr(state && state.time, 0);
  }

  function label(en, zh) {
    return window.I18n && typeof I18n.locale === 'function' && I18n.locale() === 'zh-CN' ? zh : en;
  }

  function cue(state, target, text, color, life) {
    if (!state || !target || !state.floatingTexts) return;
    state.floatingTexts.push({
      x: numberOr(target.x, numberOr(state.player && state.player.x, 0)),
      y: numberOr(target.y, numberOr(state.player && state.player.y, 0)) - numberOr(target.radius, 12) - 18,
      text: text,
      color: color || palette.cyan || '#65e5ff',
      life: life || 0.82,
      maxLife: life || 0.82
    });
  }

  function shockwave(state, origin, radius, color, life) {
    if (!state || !origin || !state.shockwaves) return;
    state.shockwaves.push({
      x: origin.x,
      y: origin.y,
      age: 0,
      life: life || 0.48,
      radius: radius,
      color: color || palette.cyan || '#65e5ff'
    });
  }

  function burst(state, origin, color, count) {
    if (!state || !origin) return;
    if (window.ShotSkill && typeof ShotSkill.burst === 'function') {
      ShotSkill.burst(state, origin.x, origin.y, color, count);
      return;
    }
    if (!state.particles || !window.GameState || typeof GameState.createParticle !== 'function') return;
    for (var i = 0; i < count; i += 1) {
      var angle = Math.PI * 2 * i / Math.max(1, count);
      state.particles.push(GameState.createParticle(
        origin.x,
        origin.y,
        Math.cos(angle) * 70,
        Math.sin(angle) * 70,
        color,
        0.42,
        3
      ));
    }
  }

  function entities(state) {
    var list = state && state.enemies ? state.enemies.slice() : [];
    if (state && state.boss && state.boss.active) list.push(state.boss.active);
    return list.filter(function (target) { return target && !target.consumed; });
  }

  function powered(state, id) {
    return !!(window.SkillEffects && typeof SkillEffects.isPowered === 'function' && SkillEffects.isPowered(state, id));
  }

  function playerPower(state) {
    if (window.CombatSystem && typeof CombatSystem.effectivePower === 'function') {
      var computed = Number(CombatSystem.effectivePower(state));
      if (computed > 0 && isFinite(computed)) return computed;
    }
    return Math.max(0.1, numberOr(state && state.player && state.player.basePower, 1) + numberOr(state && state.growthPower, 0));
  }

  function layerGrowthValue(state) {
    var layer = state && state.map ? Math.max(1, numberOr(state.map.currentLayer, 1)) : 1;
    var growth = (window.GameConfig && GameConfig.growth) || {};
    return numberOr(growth.fishBase, 1) + Math.max(0, layer - 1) * numberOr(growth.fishPerLayer, 0);
  }

  function resetAttack(target, cooldown) {
    if (!target) return;
    if (target.attackState && target.attackState !== 'idle') target.attackState = 'idle';
    target.attackAge = 0;
    target.pulseHit = false;
    target.chargeBoost = 1;
    target.chargeScale = 1;
    target.attackCooldown = Math.max(numberOr(target.attackCooldown, 0), numberOr(cooldown, 0));
  }

  function weaken(state, sourceId, target, amount, duration) {
    if (!target || !(amount > 0)) return 0;
    if (window.SkillSystem && typeof SkillSystem.weakenTarget === 'function') {
      return SkillSystem.weakenTarget(state, sourceId, target, amount, duration).weaken;
    }
    var applied = Math.max(0, Math.min(0.82, numberOr(amount, 0)));
    target.power = Math.max(0.1, numberOr(target.power, 0.1) * (1 - applied));
    target.weaknessTimer = Math.max(numberOr(target.weaknessTimer, 0), numberOr(duration, 0));
    target.hurt = Math.max(numberOr(target.hurt, 0), 0.45);
    return applied;
  }

  function revealTarget(state, target, revealTime, context) {
    if (!target) return;
    var duration = Math.max(0.2, numberOr(revealTime, 1));
    target.revealed = Math.max(numberOr(target.revealed, 0), duration);
    target.revealScale = Math.max(numberOr(target.revealScale, 0), 0.35);
    var event = {
      sourceId: 'scan',
      target: target,
      revealTime: duration
    };
    Object.keys(context || {}).forEach(function (key) { event[key] = context[key]; });
    SkillEffects.emit(state, E.TARGET_REVEALED, event);
  }

  function releaseMoltPulse(state, effect, origin) {
    var time = now(state);
    if (time <= numberOr(effect.state.lastPulseAt, -1000) + 0.05) return 0;
    effect.state.lastPulseAt = time;

    var novaLinked = powered(state, 'nova');
    var radius = 138 + effect.traitPotency * 9;
    if (novaLinked) radius *= 1.22;
    var skill = state.skills && state.skills.growth;
    var baseWeaken = 0.07 + Math.min(0.07, numberOr(skill && skill.totalBonus, 0) * 0.012);
    if (novaLinked) baseWeaken += 0.025;
    var hits = 0;
    var center = origin || state.player;
    entities(state).forEach(function (target) {
      if (Utils.dist(target, center) > radius) return;
      var amount = baseWeaken * (target.frozen > 0 ? 1.2 : 1);
      weaken(state, 'molt-pulse', target, amount, 1.45);
      var push = Utils.normalize(target.x - center.x, target.y - center.y);
      target.vx = numberOr(target.vx, 0) + push.x * (target.boss ? 35 : 90);
      target.vy = numberOr(target.vy, 0) + push.y * (target.boss ? 35 : 90);
      hits += 1;
    });
    shockwave(state, center, radius, palette.gold || '#ffd36f', 0.58);
    burst(state, center, palette.gold || '#ffd36f', 18);
    cue(state, center, label('MOLT PULSE', '蜕壳脉冲'), palette.gold || '#ffd36f');
    if (skill && hits) skill.cooldown = Math.max(0, numberOr(skill.cooldown, 0) - Math.min(0.8, hits * 0.12));
    return hits;
  }

  SkillEffects.registerEffects([
    {
      id: 'freeze.frost-trail', family: 'freeze', traits: ['frost-trail'],
      name: 'Frost Trail', nameZh: '霜痕航迹',
      description: 'Freeze leaves a lingering trail that chills pursuers; Dash lays a wider, stronger trail.',
      descriptionZh: '施放冻结后留下持续霜痕，追入航迹的敌人会被再度冻结；冲刺期间铺出的霜痕更宽、更强。',
      defaults: { remaining: 0, sampleWait: 0, points: [], contacts: [] },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'freeze') return;
          effect.state.remaining = 2.3 + effect.traitPotency * 0.12;
          effect.state.sampleWait = 0;
          effect.state.points = [];
          effect.state.contacts = [];
          cue(event.state, event.state.player, label('FROST TRAIL', '霜痕航迹'), palette.cyan || '#65e5ff');
        },
        [E.UPDATE]: function (event, effect) {
          var dt = Math.max(0, numberOr(event.dt, 0));
          if (!(effect.state.remaining > 0) || !event.state.player) return;
          effect.state.remaining = Math.max(0, effect.state.remaining - dt);
          effect.state.sampleWait -= dt;
          if (effect.state.sampleWait <= 0) {
            var dashing = !!(event.state.skills && event.state.skills.dash && event.state.skills.dash.active);
            effect.state.points.push({
              x: event.state.player.x,
              y: event.state.player.y,
              radius: dashing ? 38 : 25,
              freeze: dashing ? 0.58 : 0.36,
              life: dashing ? 1.05 : 0.78
            });
            effect.state.sampleWait += dashing ? 0.075 : 0.12;
            if (event.state.particles && window.GameState && typeof GameState.createParticle === 'function') {
              event.state.particles.push(GameState.createParticle(
                event.state.player.x,
                event.state.player.y,
                0,
                0,
                palette.cyan || '#65e5ff',
                0.32,
                dashing ? 5 : 3
              ));
            }
          }
          effect.state.points.forEach(function (point) { point.life -= dt; });
          effect.state.points = effect.state.points.filter(function (point) { return point.life > 0; }).slice(-32);
          var previousContacts = effect.state.contacts || [];
          var nextContacts = [];
          entities(event.state).forEach(function (target) {
            var contact = null;
            for (var i = effect.state.points.length - 1; i >= 0; i -= 1) {
              var point = effect.state.points[i];
              var radius = point.radius + numberOr(target.radius, 0) * 0.45;
              var dx = target.x - point.x;
              var dy = target.y - point.y;
              if (dx * dx + dy * dy > radius * radius) continue;
              contact = { point: point, radius: radius, distance: Math.sqrt(dx * dx + dy * dy) };
              break;
            }
            if (!contact) return;
            nextContacts.push(target);
            var duration = contact.point.freeze + effect.traitPotency * 0.035;
            target.frozen = Math.max(numberOr(target.frozen, 0), duration);
            if (previousContacts.indexOf(target) !== -1) return;
            SkillEffects.emit(event.state, E.STATUS_APPLIED, {
              sourceId: 'freeze',
              status: 'frozen',
              target: target,
              radius: contact.radius,
              duration: duration,
              distance: contact.distance,
              trail: true
            });
            cue(event.state, target, label('TRAIL FREEZE', '霜痕冻结'), palette.cyan || '#65e5ff', 0.62);
          });
          effect.state.contacts = nextContacts;
        }
      },
      meta: { synergies: ['dash'] }
    },
    {
      id: 'freeze.brittle-lattice', family: 'freeze', traits: ['brittle-lattice'],
      name: 'Brittle Lattice', nameZh: '脆晶格',
      description: 'Shot, Nova and Corrode crack frozen targets harder; corrosion deepens the fracture.',
      descriptionZh: '射击、脉冲与侵蚀会对冻结目标造成更强削弱；目标已被侵蚀时，脆裂增幅进一步提高。',
      hooks: {
        [E.TARGET_WEAKEN]: function (event, effect) {
          if (!event.target || !(event.target.frozen > 0)) return;
          if (event.sourceId !== 'shot' && event.sourceId !== 'nova' && event.sourceId !== 'corrode') return;
          var multiplier = 1.12 + Math.min(0.12, effect.traitPotency * 0.018);
          if (event.target.corrodeTimer > 0) multiplier += 0.06;
          event.amount = Math.min(0.82, numberOr(event.amount, 0) * multiplier);
          event.duration = numberOr(event.duration, 0) + 0.24;
          if (numberOr(event.target.brittleCueAt, 0) <= now(event.state)) {
            event.target.brittleCueAt = now(event.state) + 0.55;
            cue(event.state, event.target, label('BRITTLE', '脆裂'), palette.cyan || '#65e5ff', 0.62);
          }
        }
      },
      meta: { synergies: ['shot', 'nova', 'corrode'] }
    },
    {
      id: 'freeze.ice-chain', family: 'freeze', traits: ['ice-chain'],
      name: 'Ice Chain', nameZh: '冰链跃迁',
      description: 'Freeze jumps beyond the field to nearby enemies, preferring corroded targets.',
      descriptionZh: '冻结会越过技能边缘跳向附近敌人，并优先追踪已被侵蚀的目标。',
      defaults: { castTime: -1, jumps: 0 },
      hooks: {
        [E.STATUS_APPLIED]: function (event, effect) {
          if (event.status !== 'frozen' || !event.target || event.chain) return;
          var time = now(event.state);
          if (Math.abs(time - numberOr(effect.state.castTime, -1)) > 0.001) {
            effect.state.castTime = time;
            effect.state.jumps = 0;
          }
          var maxJumps = effect.traitPotency >= 4 ? 3 : 2;
          if (effect.state.jumps >= maxJumps) return;
          var range = 135 + effect.traitPotency * 8;
          var best = null;
          var bestScore = Infinity;
          entities(event.state).forEach(function (target) {
            if (target === event.target || target.frozen >= event.duration * 0.45) return;
            if (Utils.dist(target, event.state.player) <= numberOr(event.radius, 0)) return;
            var distance = Utils.dist(target, event.target);
            var chainRange = range + (target.corrodeTimer > 0 ? 50 : 0);
            if (distance > chainRange) return;
            var score = distance - (target.corrodeTimer > 0 ? 70 : 0);
            if (score < bestScore) {
              best = target;
              bestScore = score;
            }
          });
          if (!best) return;
          effect.state.jumps += 1;
          var duration = Math.max(0.45, numberOr(event.duration, 1) * 0.58);
          best.frozen = Math.max(numberOr(best.frozen, 0), duration);
          SkillEffects.emit(event.state, E.STATUS_APPLIED, {
            sourceId: 'freeze',
            status: 'frozen',
            target: best,
            radius: range,
            duration: duration,
            distance: Utils.dist(best, event.target),
            chain: true
          });
          cue(event.state, best, label('ICE CHAIN', '冰链跃迁'), palette.cyan || '#65e5ff');
          shockwave(event.state, best, numberOr(best.radius, 12) * 2.4, palette.cyan || '#65e5ff', 0.36);
        }
      },
      meta: { synergies: ['corrode', 'scan'] }
    },
    {
      id: 'freeze.cold-front', family: 'freeze', traits: ['cold-front'],
      name: 'Cold Front', nameZh: '寒潮锋面',
      description: 'Freeze drives enemies outward and turns hostile shots away from the player.',
      descriptionZh: '冻结形成向外推进的寒潮，推开范围内敌人，并把来袭弹体偏转回外侧。',
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'freeze') return;
          var state = event.state;
          var radius = numberOr(event.skill && event.skill.lastRadius, 150);
          entities(state).forEach(function (target) {
            if (!(target.frozen > 0) || Utils.dist(target, state.player) > radius) return;
            var outward = Utils.normalize(target.x - state.player.x, target.y - state.player.y);
            var force = target.boss ? 45 : 145 + effect.traitPotency * 8;
            target.vx = numberOr(target.vx, 0) + outward.x * force;
            target.vy = numberOr(target.vy, 0) + outward.y * force;
            if (!target.boss && target.attackState && target.attackState !== 'idle') target.attackAge = Math.max(0, numberOr(target.attackAge, 0) - 0.35);
          });
          (state.enemyBullets || []).forEach(function (bullet) {
            if (Utils.dist(bullet, state.player) > radius) return;
            var outward = Utils.normalize(bullet.x - state.player.x, bullet.y - state.player.y);
            var speed = Math.max(70, Math.sqrt(numberOr(bullet.vx, 0) * numberOr(bullet.vx, 0) + numberOr(bullet.vy, 0) * numberOr(bullet.vy, 0)) * 0.42);
            bullet.vx = outward.x * speed;
            bullet.vy = outward.y * speed;
            bullet.life = Math.min(numberOr(bullet.life, 1), 1.1);
            bullet.coldDeflected = true;
          });
          shockwave(state, state.player, radius, palette.cyan || '#65e5ff', 0.55);
          cue(state, state.player, label('COLD FRONT', '寒潮锋面'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'freeze.time-pocket', family: 'freeze', traits: ['time-pocket'],
      name: 'Time Pocket', nameZh: '时滞冰域',
      description: 'The frozen field lingers as a time pocket that slows hostile shots and enemy windups.',
      descriptionZh: '冻结区域会短暂保留为时滞冰域，持续拖慢敌方弹体与攻击蓄力。',
      defaults: { remaining: 0, x: 0, y: 0, radius: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'freeze') return;
          effect.state.remaining = 2.1 + effect.traitPotency * 0.13;
          effect.state.x = event.state.player.x;
          effect.state.y = event.state.player.y;
          effect.state.radius = numberOr(event.skill && event.skill.lastRadius, 150) * 0.92;
          shockwave(event.state, event.state.player, effect.state.radius, palette.cyan || '#65e5ff', 0.72);
          cue(event.state, event.state.player, label('TIME POCKET', '时滞冰域'), palette.cyan || '#65e5ff');
        },
        [E.UPDATE]: function (event, effect) {
          if (!(effect.state.remaining > 0)) return;
          var dt = Math.max(0, numberOr(event.dt, 0));
          effect.state.remaining = Math.max(0, effect.state.remaining - dt);
          var center = { x: effect.state.x, y: effect.state.y };
          var radius = numberOr(effect.state.radius, 0);
          var bulletFactor = Math.pow(0.18, dt);
          (event.state.enemyBullets || []).forEach(function (bullet) {
            if (Utils.dist(bullet, center) > radius) return;
            bullet.vx = numberOr(bullet.vx, 0) * bulletFactor;
            bullet.vy = numberOr(bullet.vy, 0) * bulletFactor;
            bullet.timePocket = true;
          });
          entities(event.state).forEach(function (target) {
            if (!(target.frozen > 0) || Utils.dist(target, center) > radius) return;
            if (target.attackState && target.attackState !== 'idle') {
              target.attackAge = Math.max(0, numberOr(target.attackAge, 0) - dt * 0.68);
            }
            target.attackCooldown = numberOr(target.attackCooldown, 0) + dt * 0.62;
          });
        }
      }
    },
    {
      id: 'freeze.permafrost', family: 'freeze', traits: ['permafrost'],
      name: 'Permafrost', nameZh: '永冻层',
      description: 'Weakened or corroded targets freeze longer, and further weakening extends the freeze.',
      descriptionZh: '已被削弱或侵蚀的目标会冻结更久，冻结期间再次受到削弱还会延长冻结。',
      hooks: {
        [E.STATUS_APPLIED]: function (event, effect) {
          if (event.status !== 'frozen' || !event.target) return;
          var multiplier = 1.2 + Math.min(0.24, effect.traitPotency * 0.03);
          if (event.target.weaknessTimer > 0) multiplier += 0.16;
          if (event.target.corrodeTimer > 0) multiplier += 0.24;
          event.target.frozen = Math.max(numberOr(event.target.frozen, 0), numberOr(event.duration, 1) * multiplier);
          event.target.permafrost = true;
        },
        [E.TARGET_WEAKENED]: function (event) {
          if (!event.target || !(event.target.frozen > 0)) return;
          if (event.sourceId !== 'shot' && event.sourceId !== 'nova' && event.sourceId !== 'corrode') return;
          var extension = 0.16 + Math.min(0.85, numberOr(event.amount, 0) * 1.45);
          if (event.sourceId === 'corrode') extension *= 1.3;
          event.target.frozen = Math.min(10, numberOr(event.target.frozen, 0) + extension);
        }
      },
      meta: { synergies: ['shot', 'nova', 'corrode'] }
    },
    {
      id: 'freeze.glacial-anchor', family: 'freeze', traits: ['glacial-anchor'],
      name: 'Glacial Anchor', nameZh: '冰川锚',
      description: 'Each Freeze anchors the strongest caught enemy, cancelling its attack and cracking its power.',
      descriptionZh: '每次冻结都会锚定范围内最强的敌人，中断其动作并直接击裂一部分战力。',
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'freeze') return;
          var radius = numberOr(event.skill && event.skill.lastRadius, 150);
          var strongest = null;
          entities(event.state).forEach(function (target) {
            if (!(target.frozen > 0) || Utils.dist(target, event.state.player) > radius) return;
            if (!strongest || numberOr(target.power, 0) > numberOr(strongest.power, 0)) strongest = target;
          });
          if (!strongest) return;
          strongest.vx = 0;
          strongest.vy = 0;
          strongest.frozen = Math.max(numberOr(strongest.frozen, 0), 1.5 + effect.traitPotency * 0.12);
          resetAttack(strongest, 1.35);
          var amount = strongest.boss ? 0.035 : 0.075 + Math.min(0.04, effect.traitPotency * 0.006);
          if (strongest.corrodeTimer > 0) amount *= 1.3;
          weaken(event.state, 'glacial-anchor', strongest, amount, 1.8);
          cue(event.state, strongest, label('GLACIAL ANCHOR', '冰川锚'), palette.cyan || '#65e5ff');
          shockwave(event.state, strongest, numberOr(strongest.radius, 12) * 3, palette.cyan || '#65e5ff', 0.44);
        }
      },
      meta: { synergies: ['corrode'] }
    },
    {
      id: 'freeze.shard-harvest', family: 'freeze', traits: ['shard-harvest'],
      name: 'Shard Harvest', nameZh: '碎晶收割',
      description: 'Consuming a frozen enemy yields reserve and refunds Freeze; while Shot is powered, shards seek nearby targets.',
      descriptionZh: '吞噬冻结敌人会获得额外成长储备并返还冻结冷却；射击仍由当前基因供能时，碎晶还会追击附近目标。',
      hooks: {
        [E.ENEMY_CONSUMED]: function (event, effect) {
          var source = event.enemy;
          if (!source || event.isBoss || !(source.frozen > 0)) return;
          var reserve = Math.min(layerGrowthValue(event.state) * 1.2, Math.max(layerGrowthValue(event.state) * 0.32, numberOr(event.gain, 0) * 0.22));
          event.state.growthPower = numberOr(event.state.growthPower, 0) + reserve;
          if (event.state.skills && event.state.skills.freeze) {
            event.state.skills.freeze.cooldown = Math.max(0, numberOr(event.state.skills.freeze.cooldown, 0) - (0.38 + effect.traitPotency * 0.035));
          }
          var shardCount = effect.traitPotency >= 4 ? 4 : 3;
          if (powered(event.state, 'shot') && event.state.bullets) {
            entities(event.state)
              .filter(function (target) { return target !== source && Utils.dist(target, source) <= 430; })
              .sort(function (a, b) { return Utils.dist(a, source) - Utils.dist(b, source); })
              .slice(0, shardCount)
              .forEach(function (target) {
                var direction = Utils.normalize(target.x - source.x, target.y - source.y);
                event.state.bullets.push({
                  x: source.x,
                  y: source.y,
                  vx: direction.x * 260,
                  vy: direction.y * 260,
                  radius: 3.5,
                  life: 1.3,
                  maxLife: 1.3,
                  weaken: 0.055 + effect.traitPotency * 0.005,
                  weaknessDuration: 0.9,
                  color: palette.cyan || '#65e5ff',
                  hitIds: Object.create(null),
                  frostShard: true
                });
              });
          }
          cue(event.state, source, label('SHARD HARVEST +', '碎晶收割 +') + reserve.toFixed(1), palette.gold || '#ffd36f');
          burst(event.state, source, palette.cyan || '#65e5ff', 12);
        }
      },
      meta: { synergies: ['shot', 'growth'] }
    },

    {
      id: 'scan.school-census', family: 'scan', traits: ['school-census'],
      name: 'School Census', nameZh: '鱼群普查',
      description: 'Scanning one school member reveals the entire school and its guards.',
      descriptionZh: '扫描任意一条群游鱼，会同步揭示整个鱼群以及守护该鱼群的敌人。',
      priority: -20,
      defaults: { propagating: false, scannedSchools: null },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'scan') effect.state.scannedSchools = Object.create(null);
        },
        [E.TARGET_REVEALED]: function (event, effect) {
          if (!event.target || effect.state.propagating) return;
          var schoolId = event.target.schoolId || event.target.guardSchoolId;
          if (!schoolId) return;
          var scannedSchools = effect.state.scannedSchools || (effect.state.scannedSchools = Object.create(null));
          if (scannedSchools[schoolId]) return;
          scannedSchools[schoolId] = true;
          var members = entities(event.state).filter(function (target) {
            return target.schoolId === schoolId || target.guardSchoolId === schoolId;
          });
          if (members.length <= 1) return;
          effect.state.propagating = true;
          members.forEach(function (target) {
            if (target === event.target) return;
            revealTarget(event.state, target, numberOr(event.revealTime, 2) * 0.82, { schoolCensus: true });
          });
          effect.state.propagating = false;
          cue(event.state, event.target, label('SCHOOL x', '鱼群 x') + members.length, palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'scan.drop-oracle', family: 'scan', traits: ['drop-oracle'],
      name: 'Drop Oracle', nameZh: '掉落预言',
      description: 'Scanning a letter-bearing enemy fixes its displayed bias as the actual drop.',
      descriptionZh: '扫描携带字母的敌人后，其显示的偏向字母会被锁定为实际掉落。',
      hooks: {
        [E.TARGET_REVEALED]: function (event) {
          var target = event.target;
          if (!target || target.boss || target.dropType !== 'letter' || target.oracleLocked) return;
          target.oracleLocked = true;
          target.fixedDrop = true;
          target.dropChance = 1;
          target.special = true;
          cue(event.state, target, label('DROP LOCKED: ', '掉落锁定：') + String(target.bias || '?').toUpperCase(), palette.gold || '#ffd36f', 1);
        }
      }
    },
    {
      id: 'scan.route-survey', family: 'scan', traits: ['route-survey'],
      name: 'Route Survey', nameZh: '航路测绘',
      description: 'Scan charts a forward corridor beyond its normal radius; Dashing along it gains speed and combat boost.',
      descriptionZh: '扫描会测绘前方超出常规半径的航路；沿已测绘航路冲刺时，速度与临时战力同步提高。',
      defaults: { routeCue: false },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && event.skill) {
            effect.state.routeCue = false;
            return;
          }
          if (event.id !== 'scan' || !event.skill) return;
          var state = event.state;
          var direction = { x: Math.cos(numberOr(state.player.angle, 0)), y: Math.sin(numberOr(state.player.angle, 0)) };
          var radius = numberOr(event.skill.radius, 220) * 1.85;
          var duration = numberOr(event.skill.revealTime, 2.5);
          var routes = entities(state).map(function (target) {
            var delta = Utils.normalize(target.x - state.player.x, target.y - state.player.y);
            var alignment = delta.x * direction.x + delta.y * direction.y;
            return { target: target, distance: Utils.dist(target, state.player), alignment: alignment };
          }).filter(function (entry) {
            return entry.distance <= radius && entry.alignment >= 0.55;
          }).sort(function (a, b) {
            return (b.alignment * 180 - b.distance) - (a.alignment * 180 - a.distance);
          }).slice(0, 4);
          routes.forEach(function (entry) {
            entry.target.routeSurveyUntil = now(state) + duration;
            revealTarget(state, entry.target, duration * 0.72, { routeSurvey: true });
          });
          if (routes.length) cue(state, state.player, label('ROUTE x', '航路 x') + routes.length, palette.mint || '#64f0b6');
        },
        'dash:update': function (event, effect) {
          if (!event.skill || !event.skill.active) return;
          var state = event.state;
          var direction = event.skill.direction || { x: Math.cos(numberOr(state.player.angle, 0)), y: Math.sin(numberOr(state.player.angle, 0)) };
          var onRoute = entities(state).some(function (target) {
            if (numberOr(target.routeSurveyUntil, 0) < now(state)) return false;
            var distance = Utils.dist(target, state.player);
            if (distance > 430) return false;
            var toward = Utils.normalize(target.x - state.player.x, target.y - state.player.y);
            return toward.x * direction.x + toward.y * direction.y > 0.72;
          });
          if (!onRoute) return;
          event.skill.boost = numberOr(event.skill.boost, 1) * (1.1 + Math.min(0.06, effect.traitPotency * 0.01));
          state.player.vx *= 1.06;
          state.player.vy *= 1.06;
          if (!effect.state.routeCue) {
            effect.state.routeCue = true;
            cue(state, state.player, label('SURVEY RUSH', '测绘突进'), palette.mint || '#64f0b6');
          }
        }
      },
      meta: { synergies: ['dash'] }
    },
    {
      id: 'scan.density-xray', family: 'scan', traits: ['density-xray'],
      name: 'Density X-Ray', nameZh: '密度透视',
      description: 'Scan fractures Bosses and dense-core enemies, exposing the power hidden inside deceptively small bodies.',
      descriptionZh: '扫描会击裂首领与高密度敌人的战力核心，揭穿小体型下隐藏的战力。',
      hooks: {
        [E.TARGET_REVEALED]: function (event) {
          var target = event.target;
          if (!target || numberOr(target.densityXrayUntil, 0) > now(event.state)) return;
          var density = Math.max(1, numberOr(target.powerDensity, target.denseCore ? 1.6 : 1));
          if (density < 1.15 && !target.boss) return;
          target.densityXrayUntil = now(event.state) + 1.6;
          target.densityExposed = true;
          var amount = target.boss ? 0.035 : Math.min(0.15, 0.055 + (density - 1) * 0.08);
          if (target.corrodeTimer > 0) amount *= 1.2;
          weaken(event.state, 'density-xray', target, amount, 1.7);
          cue(event.state, target, label('DENSITY BREAK', '密度击裂'), palette.pink || '#ff6fa8');
        }
      },
      meta: { synergies: ['corrode'] }
    },
    {
      id: 'scan.target-lock', family: 'scan', traits: ['target-lock'],
      name: 'Target Lock', nameZh: '目标锁定',
      description: 'Revealed targets attract Gene Bolts; a locked hit lands with extra weakening.',
      descriptionZh: '已揭示目标会牵引基因弹修正弹道；锁定命中还会造成额外削弱。',
      hooks: {
        [E.TARGET_REVEALED]: function (event) {
          if (!event.target) return;
          event.target.scanLockedUntil = now(event.state) + Math.max(0.8, numberOr(event.revealTime, 2));
          cue(event.state, event.target, label('LOCK', '锁定'), palette.mint || '#64f0b6', 0.62);
        },
        [E.PROJECTILE_PREPARE]: function (event) {
          if (event.id !== 'shot' || !event.bullet) return;
          var state = event.state;
          var bullet = event.bullet;
          var heading = Utils.normalize(numberOr(bullet.vx, 0), numberOr(bullet.vy, 0));
          var best = null;
          var bestScore = Infinity;
          entities(state).forEach(function (target) {
            if (numberOr(target.scanLockedUntil, 0) < now(state)) return;
            var distance = Utils.dist(target, bullet);
            if (distance > 650) return;
            var toward = Utils.normalize(target.x - bullet.x, target.y - bullet.y);
            var alignment = heading.x * toward.x + heading.y * toward.y;
            if (alignment < 0.18) return;
            var score = distance + (1 - alignment) * 260 - (target.boss ? 90 : 0);
            if (score < bestScore) {
              best = target;
              bestScore = score;
            }
          });
          if (!best) return;
          var speed = Math.sqrt(numberOr(bullet.vx, 0) * numberOr(bullet.vx, 0) + numberOr(bullet.vy, 0) * numberOr(bullet.vy, 0));
          var lead = {
            x: best.x + numberOr(best.vx, 0) * 0.18,
            y: best.y + numberOr(best.vy, 0) * 0.18
          };
          var direction = Utils.normalize(lead.x - bullet.x, lead.y - bullet.y);
          bullet.vx = direction.x * speed;
          bullet.vy = direction.y * speed;
          bullet.lockedTargetId = best.id;
          bullet.color = palette.mint || '#64f0b6';
        },
        [E.PROJECTILE_HIT]: function (event, effect) {
          if (!event.bullet || !event.target || event.bullet.lockedTargetId !== event.target.id) return;
          event.weaken = Math.min(0.82, numberOr(event.weaken, 0) * (1.15 + Math.min(0.08, effect.traitPotency * 0.012)));
          cue(event.state, event.target, label('LOCKED HIT', '锁定命中'), palette.mint || '#64f0b6');
        }
      },
      meta: { synergies: ['shot'] }
    },
    {
      id: 'scan.predictive-interference', family: 'scan', traits: ['predictive-interference'],
      name: 'Predictive Interference', nameZh: '预判干扰',
      description: 'Scanning an attacker jams its current windup and disrupts shots it already launched.',
      descriptionZh: '扫描攻击型敌人会干扰其当前蓄力，并拖慢它已经发射的弹体。',
      hooks: {
        [E.TARGET_REVEALED]: function (event, effect) {
          var target = event.target;
          if (!target || target.kind === 'growth' || target.kind === 'letter' || numberOr(target.predictiveJamUntil, 0) > now(event.state)) return;
          target.predictiveJamUntil = now(event.state) + 1.15;
          var interrupted = !!(target.attackState && target.attackState !== 'idle');
          if (interrupted) resetAttack(target, 1.1 + effect.traitPotency * 0.08);
          else target.attackCooldown = numberOr(target.attackCooldown, 0) + 0.42 + effect.traitPotency * 0.035;
          (event.state.enemyBullets || []).forEach(function (bullet) {
            if (bullet.source !== target) return;
            bullet.vx = numberOr(bullet.vx, 0) * 0.38;
            bullet.vy = numberOr(bullet.vy, 0) * 0.38;
            bullet.life = Math.min(numberOr(bullet.life, 1), 0.9);
            bullet.scanJammed = true;
          });
          cue(event.state, target, interrupted ? label('ATTACK JAMMED', '攻击干扰') : label('PREDICTED', '行动预判'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'scan.echo-radar', family: 'scan', traits: ['echo-radar'],
      name: 'Echo Radar', nameZh: '回波雷达',
      description: 'A delayed second scan returns from the cast point, revealing missed targets and refunding cooldown for new contacts.',
      descriptionZh: '首次扫描后会从施放点返回一轮延迟回波，补充揭示遗漏目标，并按新发现数量返还冷却。',
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'scan' || !event.skill) return;
          var origin = { x: event.state.player.x, y: event.state.player.y };
          var radius = numberOr(event.skill.radius, 220) * 1.18;
          var revealTime = numberOr(event.skill.revealTime, 2.5) * 0.62;
          effect.schedule(1.05, function (state) {
            var contacts = 0;
            entities(state).forEach(function (target) {
              if (Utils.dist(target, origin) > radius) return;
              var wasHidden = !(target.revealed > revealTime * 0.45);
              revealTarget(state, target, revealTime, { echoRadar: true });
              if (wasHidden) contacts += 1;
            });
            if (state.skills && state.skills.scan && contacts) {
              state.skills.scan.cooldown = Math.max(0, numberOr(state.skills.scan.cooldown, 0) - Math.min(0.9, contacts * 0.12));
            }
            shockwave(state, origin, radius, palette.cyan || '#65e5ff', 0.72);
            cue(state, origin, label('ECHO CONTACTS ', '回波目标 ') + contacts, palette.cyan || '#65e5ff');
          }, { cancelWhenInactive: false });
        }
      },
      meta: { synergies: ['echo'] }
    },
    {
      id: 'scan.kill-window', family: 'scan', traits: ['kill-window'],
      name: 'Kill Window', nameZh: '斩杀窗口',
      description: 'Scan marks near-threshold threats; the next offensive skill cracks them into consumable range.',
      descriptionZh: '扫描会标记战力略高于玩家的临界敌人；下一次攻击技能会精准将其压入可吞噬范围。',
      hooks: {
        [E.TARGET_REVEALED]: function (event, effect) {
          if (!event.target) return;
          var current = playerPower(event.state);
          var ratio = numberOr(event.target.power, 0) / Math.max(0.1, current);
          if (ratio <= 1.02 || ratio > 1.72 + Math.min(0.18, effect.traitPotency * 0.03)) return;
          event.target.killWindowReady = true;
          event.target.killWindowUntil = now(event.state) + Math.max(0.8, numberOr(event.revealTime, 2));
          cue(event.state, event.target, label('KILL WINDOW', '斩杀窗口'), palette.danger || '#ff667c');
        },
        [E.TARGET_WEAKEN]: function (event, effect) {
          var target = event.target;
          if (!target || !target.killWindowReady || numberOr(target.killWindowUntil, 0) < now(event.state)) return;
          if (event.sourceId !== 'shot' && event.sourceId !== 'nova' && event.sourceId !== 'corrode') return;
          var current = playerPower(event.state);
          var required = 1 - current / Math.max(0.1, numberOr(target.power, 0.1));
          var multiplier = 1.22 + Math.min(0.1, effect.traitPotency * 0.015);
          if (target.frozen > 0) multiplier += 0.08;
          if (numberOr(target.scanLockedUntil, 0) >= now(event.state)) multiplier += 0.06;
          event.amount = Math.min(0.82, Math.max(numberOr(event.amount, 0) * multiplier, required > 0 ? required + 0.018 : 0));
          target.killWindowReady = false;
          cue(event.state, target, label('WINDOW BROKEN', '突破窗口'), palette.danger || '#ff667c');
        }
      },
      meta: { synergies: ['shot', 'nova', 'corrode', 'freeze'] }
    },

    {
      id: 'growth.reserve-cell', family: 'growth', traits: ['reserve-cell'],
      priority: 20,
      name: 'Reserve Cell', nameZh: '储备细胞',
      description: 'Unused Growth charges become reserve power and cooldown refund when the surge expires.',
      descriptionZh: '成长强化自然结束时，未使用的次数会转化为成长储备，并返还一部分冷却。',
      defaults: { wasActive: false, lastCharges: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'growth' || !event.skill) return;
          effect.state.wasActive = true;
          effect.state.lastCharges = numberOr(event.skill.charges, 0);
        },
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'after' || !event.skill) return;
          effect.state.lastCharges = numberOr(event.skill.charges, 0);
          effect.state.wasActive = !!event.skill.active;
        },
        [E.PLAYER_DAMAGE]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (!skill) return;
          effect.state.lastCharges = numberOr(skill.charges, 0);
          effect.state.wasActive = !!skill.active;
        },
        [E.UPDATE]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (!skill) return;
          if (skill.active) {
            effect.state.wasActive = true;
            effect.state.lastCharges = numberOr(skill.charges, 0);
            return;
          }
          if (!effect.state.wasActive) return;
          effect.state.wasActive = false;
          var charges = Math.max(0, Math.floor(numberOr(effect.state.lastCharges, 0)));
          effect.state.lastCharges = 0;
          if (!charges) return;
          var gain = layerGrowthValue(event.state) * charges * (0.26 + Math.min(0.12, effect.traitPotency * 0.018));
          event.state.growthPower = numberOr(event.state.growthPower, 0) + gain;
          skill.cooldown = Math.max(0, numberOr(skill.cooldown, 0) - charges * 0.38);
          cue(event.state, event.state.player, label('RESERVE CELL +', '储备细胞 +') + gain.toFixed(1), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'growth.risk-bloom', family: 'growth', traits: ['risk-bloom'],
      name: 'Risk Bloom', nameZh: '险境绽放',
      description: 'Empowered catches near stronger enemies gain a large risk bonus, strongest beside a Boss.',
      descriptionZh: '在强于玩家的敌人附近吞噬成长鱼会获得险境加成；Boss 身边的收益最高。',
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'before' || !event.empowered || !event.enemy) return;
          var current = playerPower(event.state);
          var threat = null;
          var ratio = 1;
          entities(event.state).forEach(function (target) {
            if (target === event.enemy || Utils.dist(target, event.enemy) > 300) return;
            var targetRatio = numberOr(target.power, 0) / Math.max(0.1, current);
            if (target.boss) targetRatio += 1.2;
            if (targetRatio > ratio) {
              ratio = targetRatio;
              threat = target;
            }
          });
          if (!threat || ratio <= 1.08) return;
          var bonus = 1.24 + Math.min(0.3, (ratio - 1) * 0.08) + (threat.boss ? 0.12 : 0);
          bonus += Math.min(0.08, effect.traitPotency * 0.012);
          event.amount = numberOr(event.amount, 0) * bonus;
          cue(event.state, event.enemy, label('RISK BLOOM x', '险境绽放 x') + bonus.toFixed(2), palette.danger || '#ff667c');
        }
      },
      meta: { synergies: ['dash', 'scan'] }
    },
    {
      id: 'growth.school-harvest', family: 'growth', traits: ['school-harvest'],
      name: 'School Harvest', nameZh: '鱼群丰收',
      description: 'Rapid catches from one school escalate in value; every third catch preserves a Growth charge.',
      descriptionZh: '短时间内连续吞噬同一鱼群会逐步提高收益；每第三条鱼不会消耗成长次数。',
      defaults: { schoolId: null, count: 0, expiresAt: 0 },
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'before' || !event.empowered || !event.enemy || !event.enemy.schoolId) return;
          var time = now(event.state);
          if (time > numberOr(effect.state.expiresAt, 0) || effect.state.schoolId !== event.enemy.schoolId) {
            effect.state.schoolId = event.enemy.schoolId;
            effect.state.count = 0;
          }
          effect.state.count = Math.max(0, numberOr(effect.state.count, 0)) + 1;
          effect.state.expiresAt = time + 4.2;
          event.amount = numberOr(event.amount, 0) * (1 + Math.min(0.36, (effect.state.count - 1) * 0.08));
          if (effect.state.count % 3 === 0 && event.skill) {
            // GrowthSkill consumes one charge immediately after this phase;
            // a temporary value above the cap settles back to the cap.
            event.skill.charges = numberOr(event.skill.charges, 0) + 1;
            cue(event.state, event.enemy, label('CHARGE KEPT', '成长次数保留'), palette.gold || '#ffd36f');
          }
        }
      },
      meta: { synergies: ['scan.school-census'] }
    },
    {
      id: 'growth.cultivation', family: 'growth', traits: ['cultivation'],
      name: 'Cultivation', nameZh: '培育场',
      description: 'While Growth is active, nearby growth fish mature in value and drift toward the player.',
      descriptionZh: '成长强化期间，附近成长鱼会持续成熟、提高战力收益，并缓慢向玩家聚拢。',
      defaults: { sparkWait: 0 },
      hooks: {
        [E.UPDATE]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (!skill || !skill.active) return;
          var dt = Math.max(0, numberOr(event.dt, 0));
          effect.state.sparkWait -= dt;
          (event.state.enemies || []).forEach(function (target) {
            if (target.dropType !== 'growth' || target.consumed || Utils.dist(target, event.state.player) > 310) return;
            if (target.cultivationBase == null) target.cultivationBase = Math.max(0.1, numberOr(target.growthValue, layerGrowthValue(event.state)));
            var cap = target.cultivationBase * (1.42 + Math.min(0.28, effect.traitPotency * 0.04));
            var rate = target.cultivationBase * (0.075 + effect.traitPotency * 0.006);
            target.growthValue = Math.min(cap, numberOr(target.growthValue, target.cultivationBase) + rate * dt);
            var pull = Utils.normalize(event.state.player.x - target.x, event.state.player.y - target.y);
            target.vx = numberOr(target.vx, 0) + pull.x * dt * 24;
            target.vy = numberOr(target.vy, 0) + pull.y * dt * 24;
            if (!target.cultivated) {
              target.cultivated = true;
              cue(event.state, target, label('CULTIVATING', '正在培育'), palette.gold || '#ffd36f', 0.72);
            }
            if (effect.state.sparkWait <= 0 && event.state.particles && window.GameState && typeof GameState.createParticle === 'function') {
              event.state.particles.push(GameState.createParticle(target.x, target.y, 0, -18, palette.gold || '#ffd36f', 0.45, 3));
              effect.state.sparkWait = 0.24;
            }
          });
        }
      },
      meta: { synergies: ['nova.feeding-vortex'] }
    },
    {
      id: 'growth.adaptive-digestion', family: 'growth', traits: ['adaptive-digestion'],
      name: 'Adaptive Digestion', nameZh: '适应性消化',
      description: 'Switching to a different school or region grants a strong bonus to the next empowered catch.',
      descriptionZh: '在不同鱼群或区域之间切换捕食时，下一次成长强化会获得显著适应加成。',
      defaults: { lastSource: null },
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'before' || !event.empowered || !event.enemy) return;
          var source = event.enemy.schoolId || event.enemy.regionId || ('layer-' + numberOr(event.enemy.layerIndex, 0));
          if (effect.state.lastSource && source !== effect.state.lastSource) {
            var bonus = 1.25 + Math.min(0.12, effect.traitPotency * 0.018);
            event.amount = numberOr(event.amount, 0) * bonus;
            cue(event.state, event.enemy, label('ADAPTED x', '适应消化 x') + bonus.toFixed(2), palette.mint || '#64f0b6');
          }
          effect.state.lastSource = source;
        }
      },
      meta: { synergies: ['scan.route-survey', 'dash'] }
    },
    {
      id: 'growth.symbiotic-intake', family: 'growth', traits: ['symbiotic-intake'],
      name: 'Symbiotic Intake', nameZh: '共生摄取',
      description: 'Letter catches during Growth feed reserve and duration; every second one restores a charge.',
      descriptionZh: '成长强化期间吞噬字母鱼会补充成长储备并延长持续时间；每第二条还会恢复一次成长次数。',
      defaults: { intakeCount: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'growth') effect.state.intakeCount = 0;
        },
        [E.ENEMY_CONSUMED]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (!skill || !skill.active || event.isBoss || event.dropType !== 'letter' || !event.enemy) return;
          effect.state.intakeCount = Math.max(0, numberOr(effect.state.intakeCount, 0)) + 1;
          var gain = layerGrowthValue(event.state) * 0.28;
          if (event.enemy.revealed > 0) gain += layerGrowthValue(event.state) * 0.16;
          if (event.enemy.frozen > 0 || event.enemy.corrodeTimer > 0) gain += layerGrowthValue(event.state) * 0.12;
          event.state.growthPower = numberOr(event.state.growthPower, 0) + gain;
          skill.age = Math.max(0, numberOr(skill.age, 0) - 0.7);
          if (effect.state.intakeCount % 2 === 0) skill.charges = Math.min(7, numberOr(skill.charges, 0) + 1);
          cue(event.state, event.enemy, label('SYMBIOSIS +', '共生摄取 +') + gain.toFixed(1), palette.gold || '#ffd36f');
        }
      },
      meta: { synergies: ['scan', 'freeze', 'corrode'] }
    },
    {
      id: 'growth.regrowth', family: 'growth', traits: ['regrowth'],
      priority: 10,
      name: 'Regrowth', nameZh: '再生',
      description: 'While Growth is active, spend one charge to reduce reserve damage. With no reserve, preserve one genome factor, or two against a frozen attacker.',
      descriptionZh: '成长强化期间受击会消耗一次成长次数：尚有成长战力时大幅减伤；成长战力耗尽时保住一个基因因子，若攻击者已冻结则保住两个。',
      hooks: {
        [E.PLAYER_DAMAGE]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (event.cancelled || !skill || !skill.active || !(skill.charges > 0) || !(event.amount > 0)) return;
          var frozenAttacker = !!(event.source && event.source.frozen > 0);
          var protection = 0;
          var preserved = 0;
          if (event.state.growthPower > 0) {
            protection = 0.56 + Math.min(0.18, effect.traitPotency * 0.025);
            if (frozenAttacker) protection += 0.1;
            protection = Math.min(0.84, protection);
            event.amount = numberOr(event.amount, 0) * (1 - protection);
          } else {
            preserved = frozenAttacker ? 2 : 1;
            event.factorLossReduction = Math.max(numberOr(event.factorLossReduction, 0), preserved);
          }
          skill.charges = Math.max(0, numberOr(skill.charges, 0) - 1);
          if (skill.charges <= 0) {
            skill.active = false;
            skill.multiplier = 1;
            skill.moltPending = true;
          }
          var text = preserved
            ? label('GENOME HELD -', '基因保留 -') + preserved
            : label('REGROWTH -', '再生减伤 -') + Math.round(protection * 100) + '%';
          cue(event.state, event.state.player, text, palette.gold || '#ffd36f');
        }
      },
      meta: { synergies: ['freeze'] }
    },
    {
      id: 'growth.molt-pulse', family: 'growth', traits: ['molt-pulse'],
      name: 'Molt Pulse', nameZh: '蜕壳脉冲',
      description: 'Spending the final Growth charge sheds a weakening pulse; a powered Nova widens it and frozen targets crack harder.',
      descriptionZh: '消耗最后一次成长强化时释放削弱脉冲；脉冲仍由当前基因供能时会扩大范围，冻结目标则会受到更强击裂。',
      defaults: { lastPulseAt: -1000 },
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'after' || !event.consumedCharge || !event.skill || event.skill.charges > 0) return;
          releaseMoltPulse(event.state, effect, event.enemy || event.state.player);
        },
        [E.PLAYER_DAMAGED]: function (event, effect) {
          var skill = event.state.skills && event.state.skills.growth;
          if (!skill || !skill.moltPending) return;
          skill.moltPending = false;
          releaseMoltPulse(event.state, effect, event.state.player);
        }
      },
      meta: { synergies: ['nova', 'freeze'] }
    }
  ]);
})();
