(function () {
  if (!window.SkillEffects) return;

  var E = SkillEffects.EVENTS;
  var palette = (window.GameConfig && GameConfig.palette) || {};

  function numberOr(value, fallback) {
    var number = Number(value);
    return isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    if (window.Utils && typeof Utils.clamp === 'function') return Utils.clamp(value, min, max);
    return Math.max(min, Math.min(max, value));
  }

  function label(en, zh) {
    return window.I18n && typeof I18n.locale === 'function' && I18n.locale() === 'zh-CN' ? zh : en;
  }

  function cue(state, target, text, color) {
    if (!state || !state.floatingTexts || !target) return;
    state.floatingTexts.push({
      x: target.x,
      y: target.y - (target.radius || 12) - 18,
      text: text,
      color: color || palette.cyan || '#65e5ff',
      life: 0.82,
      maxLife: 0.82
    });
  }

  function shockwave(state, origin, radius, color, life) {
    if (!state || !state.shockwaves || !origin) return;
    state.shockwaves.push({
      x: origin.x,
      y: origin.y,
      age: 0,
      life: life || 0.48,
      radius: radius,
      color: color || palette.cyan || '#65e5ff'
    });
  }

  function entities(state) {
    var list = (state.enemies || []).filter(function (target) {
      return target && !target.consumed;
    });
    if (state.boss && state.boss.active && !state.boss.active.consumed) list.push(state.boss.active);
    return list;
  }

  function hostile(target) {
    return !!target && !target.rewardType && target.kind !== 'growth' && target.kind !== 'letter';
  }

  function distance(a, b) {
    if (window.Utils && typeof Utils.dist === 'function') return Utils.dist(a, b);
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function normalize(x, y) {
    if (window.Utils && typeof Utils.normalize === 'function') return Utils.normalize(x, y);
    var length = Math.sqrt(x * x + y * y) || 1;
    return { x: x / length, y: y / length };
  }

  function resetAttack(target, cooldown) {
    if (!target) return;
    target.attackState = 'idle';
    target.attackAge = 0;
    target.attackCooldown = Math.max(numberOr(target.attackCooldown, 0), cooldown || 0);
    target.pulseHit = false;
    target.chargeBoost = 1;
    target.chargeScale = 1;
  }

  function weaken(state, sourceId, target, amount, duration) {
    if (!target || target.consumed) return null;
    if (window.SkillSystem && typeof SkillSystem.weakenTarget === 'function') {
      return SkillSystem.weakenTarget(state, sourceId, target, amount, duration);
    }
    var applied = clamp(numberOr(amount, 0), 0, 0.82);
    target.power = Math.max(0.1, numberOr(target.power, 0.1) * (1 - applied));
    target.weaknessTimer = Math.max(numberOr(target.weaknessTimer, 0), numberOr(duration, 0));
    target.hurt = Math.max(numberOr(target.hurt, 0), 0.45);
    return { weaken: applied };
  }

  function applyFreeze(state, target, duration, sourceId, radius, targetDistance) {
    if (!target || target.consumed) return;
    target.frozen = Math.max(numberOr(target.frozen, 0), duration);
    if (window.SkillEffects && typeof SkillEffects.emit === 'function') {
      SkillEffects.emit(state, E.STATUS_APPLIED, {
        sourceId: sourceId || 'effect',
        status: 'frozen',
        target: target,
        duration: duration,
        radius: radius || 1,
        distance: targetDistance == null ? 0 : targetDistance
      });
    }
  }

  function rotate(vectorX, vectorY, angle) {
    var cosine = Math.cos(angle);
    var sine = Math.sin(angle);
    return {
      x: vectorX * cosine - vectorY * sine,
      y: vectorX * sine + vectorY * cosine
    };
  }

  function pointSegmentDistance(point, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0.000001) return distance(point, a);
    var t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    var x = a.x + dx * t;
    var y = a.y + dy * t;
    var ox = point.x - x;
    var oy = point.y - y;
    return Math.sqrt(ox * ox + oy * oy);
  }

  function pathDistance(point, points) {
    if (!points || !points.length) return Infinity;
    if (points.length === 1) return distance(point, points[0]);
    var best = Infinity;
    for (var i = 1; i < points.length; i += 1) {
      best = Math.min(best, pointSegmentDistance(point, points[i - 1], points[i]));
    }
    return best;
  }

  function nearestTarget(state, origin, radius, test) {
    var best = null;
    var bestDistance = radius;
    entities(state).forEach(function (target) {
      if (test && !test(target)) return;
      var targetDistance = distance(origin, target);
      if (targetDistance > bestDistance) return;
      best = target;
      bestDistance = targetDistance;
    });
    return best;
  }

  function currentTime(state) {
    return numberOr(state && state.time, 0);
  }

  SkillEffects.registerEffects([
    {
      id: 'dash.feeding-line', family: 'dash', trait: 'feeding-line',
      name: 'Feeding Line', nameZh: '捕食航线',
      description: 'Growth fish consumed during Dash grant bonus reserve and feed extra time back into the current run.',
      descriptionZh: '冲刺中吞噬成长鱼会额外获得成长战力，并把一小段时间补回本次冲刺。',
      defaults: { extension: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && !event.redirected) effect.state.extension = 0;
        },
        [E.ENEMY_CONSUMED]: function (event, effect) {
          var dash = event.state.skills && event.state.skills.dash;
          if (!dash || !dash.active || event.isBoss || event.dropType !== 'growth') return;
          var gain = Math.max(0.1, numberOr(event.gain, numberOr(event.enemy && event.enemy.growthValue, 1)));
          var bonus = gain * (0.16 + Math.min(0.12, effect.traitPotency * 0.018));
          event.state.growthPower += bonus;
          var cap = Math.max(0.12, numberOr(dash.duration, 0.5) * 0.65);
          var extension = Math.min(0.12, Math.max(0, cap - numberOr(effect.state.extension, 0)));
          dash.age = Math.max(0, numberOr(dash.age, 0) - extension);
          effect.state.extension += extension;
          dash.cooldown = Math.max(0, numberOr(dash.cooldown, 0) - 0.1);
          cue(event.state, event.state.player, label('FEEDING LINE +', '捕食航线 +') + bonus.toFixed(1), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'dash.slipstream', family: 'dash', trait: 'slipstream',
      name: 'Slipstream', nameZh: '伴流',
      description: 'Gene bolts caught in the Dash wake accelerate, while hostile projectiles behind you are swept sideways once.',
      descriptionZh: '进入冲刺尾流的基因弹会加速并延长射程，身后的敌方弹体则会被伴流横向拨开一次。',
      defaults: { cueReady: true },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && !event.redirected) effect.state.cueReady = true;
        },
        'dash:update': function (event, effect) {
          var state = event.state;
          var skill = event.skill;
          if (!skill || !skill.active) return;
          var direction = skill.direction || { x: 0, y: 1 };
          var affected = false;
          (state.bullets || []).forEach(function (bullet) {
            if (!bullet || bullet.slipstreamed || distance(bullet, state.player) > 125) return;
            bullet.vx *= 1.28;
            bullet.vy *= 1.28;
            bullet.life = Math.max(numberOr(bullet.life, 0), 0) + 0.26;
            bullet.maxLife = Math.max(numberOr(bullet.maxLife, bullet.life), bullet.life);
            bullet.slipstreamed = true;
            affected = true;
          });
          (state.enemyBullets || []).forEach(function (bullet) {
            if (!bullet || bullet.slipstreamDeflected) return;
            var dx = bullet.x - state.player.x;
            var dy = bullet.y - state.player.y;
            var along = dx * direction.x + dy * direction.y;
            var side = dx * -direction.y + dy * direction.x;
            if (along < -145 || along > 28 || Math.abs(side) > 72) return;
            var sign = side < 0 ? -1 : 1;
            bullet.vx += -direction.y * sign * 190;
            bullet.vy += direction.x * sign * 190;
            bullet.slipstreamDeflected = true;
            affected = true;
          });
          if (affected && effect.state.cueReady) {
            effect.state.cueReady = false;
            cue(state, state.player, label('SLIPSTREAM', '伴流'), palette.cyan || '#65e5ff');
          }
        }
      }
    },
    {
      id: 'dash.breach-phase', family: 'dash', trait: 'breach-phase',
      name: 'Breach Phase', nameZh: '破障相位',
      description: 'The first damaging contact during each Dash phases through you and fractures the attacker instead.',
      descriptionZh: '每次冲刺首次遭遇的伤害会被相位穿过，并改为削弱和打断攻击者。',
      defaults: { used: false },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && !event.redirected) effect.state.used = false;
        },
        [E.PLAYER_DAMAGE]: function (event, effect) {
          var dash = event.state.skills && event.state.skills.dash;
          if (event.cancelled || !dash || !dash.active || effect.state.used) return;
          effect.state.used = true;
          event.cancelled = true;
          event.state.player.invulnerable = Math.max(numberOr(event.state.player.invulnerable, 0), 0.2);
          if (event.source) {
            weaken(event.state, 'dash-breach', event.source, 0.1 + Math.min(0.06, effect.traitPotency * 0.012), 1.6);
            resetAttack(event.source, 1.1);
          }
          cue(event.state, event.state.player, label('PHASE BREACH', '相位破障'), palette.mint || '#64f0b6');
        }
      }
    },
    {
      id: 'dash.frost-wake', family: 'dash', trait: 'frost-wake',
      name: 'Frost Wake', nameZh: '霜痕尾流',
      description: 'Dash paints a narrow freezing wake; repeated passes refresh the chill and set up shatter effects.',
      descriptionZh: '冲刺会划出狭窄的冻结尾流，重复掠过可刷新寒意，并为碎冰类效果创造条件。',
      hooks: {
        'dash:update': function (event, effect) {
          var skill = event.skill;
          if (!skill || !skill.active) return;
          var state = event.state;
          var radius = 42 + Math.min(20, effect.traitPotency * 3);
          var now = currentTime(state);
          entities(state).forEach(function (target) {
            var targetDistance = distance(target, state.player);
            if (targetDistance > radius + numberOr(target.radius, 0) || numberOr(target.frostWakeLock, 0) > now) return;
            target.frostWakeLock = now + 0.18;
            applyFreeze(state, target, 0.55 + Math.min(0.45, effect.traitPotency * 0.08), 'dash-frost-wake', radius, targetDistance);
            target.vx *= 0.72;
            target.vy *= 0.72;
          });
        }
      }
    },
    {
      id: 'dash.schoolbreaker', family: 'dash', trait: 'schoolbreaker',
      name: 'Schoolbreaker', nameZh: '破群冲锋',
      description: 'Ramming a school formation during Dash scatters the whole group and cracks its guards.',
      descriptionZh: '冲刺撞入鱼群阵形时会驱散整群单位，并削弱、打断其中的护卫。',
      defaults: { broken: null },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && !event.redirected) effect.state.broken = Object.create(null);
        },
        'dash:update': function (event, effect) {
          var state = event.state;
          if (!event.skill || !event.skill.active) return;
          var broken = effect.state.broken || (effect.state.broken = Object.create(null));
          var trigger = nearestTarget(state, state.player, 50 + numberOr(state.player.radius, 18), function (target) {
            return !!(target.schoolId || target.guardSchoolId);
          });
          if (!trigger) return;
          var schoolId = trigger.schoolId || trigger.guardSchoolId;
          if (!schoolId || broken[schoolId]) return;
          broken[schoolId] = true;
          var members = entities(state).filter(function (target) {
            return target.schoolId === schoolId || target.guardSchoolId === schoolId;
          });
          members.forEach(function (target) {
            var away = normalize(target.x - state.player.x, target.y - state.player.y);
            target.vx += away.x * (target.boss ? 80 : 260);
            target.vy += away.y * (target.boss ? 80 : 260);
            target.schoolId = null;
            target.guardSchoolId = null;
            if (hostile(target)) {
              weaken(state, 'dash-schoolbreaker', target, 0.08, 1.5);
              resetAttack(target, 1.2);
            }
          });
          shockwave(state, state.player, 150, palette.gold || '#ffd36f', 0.5);
          cue(state, state.player, label('SCHOOL BROKEN', '鱼群击破'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'dash.afterimage', family: 'dash', trait: 'afterimage',
      name: 'Afterimage', nameZh: '残像脱壳',
      description: 'A completed Dash leaves a brief decoy that absorbs the next hit aimed at you.',
      descriptionZh: '完整结束冲刺后会留下短暂残像，替你承受接下来的第一次伤害。',
      defaults: { timeLeft: 0 },
      hooks: {
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id !== 'dash' || !event.natural) return;
          effect.state.timeLeft = 0.72 + Math.min(0.38, effect.traitPotency * 0.06);
        },
        [E.UPDATE]: function (event, effect) {
          effect.state.timeLeft = Math.max(0, numberOr(effect.state.timeLeft, 0) - numberOr(event.dt, 0));
        },
        [E.PLAYER_DAMAGE]: function (event, effect) {
          if (event.cancelled || !(effect.state.timeLeft > 0)) return;
          effect.state.timeLeft = 0;
          event.cancelled = true;
          event.state.player.invulnerable = Math.max(numberOr(event.state.player.invulnerable, 0), 0.24);
          shockwave(event.state, event.state.player, 90, palette.cyan || '#65e5ff', 0.36);
          cue(event.state, event.state.player, label('AFTERIMAGE', '残像承伤'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'dash.wake-collapse', family: 'dash', trait: 'wake-collapse',
      name: 'Wake Collapse', nameZh: '尾流塌缩',
      description: 'When Dash ends, its travelled path collapses inward and weakens every enemy crossed by the wake.',
      descriptionZh: '冲刺结束时整条航迹向内塌缩，削弱所有被尾流扫过的敌人。',
      defaults: { points: null },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'dash' || event.redirected) return;
          effect.state.points = [{ x: event.state.player.x, y: event.state.player.y }];
        },
        'dash:update': function (event, effect) {
          var points = effect.state.points || (effect.state.points = []);
          var current = { x: event.state.player.x, y: event.state.player.y };
          var last = points[points.length - 1];
          if (!last || distance(last, current) >= 26) points.push(current);
        },
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id !== 'dash') return;
          var points = effect.state.points || [];
          points.push({ x: event.state.player.x, y: event.state.player.y });
          var width = 48 + Math.min(28, effect.traitPotency * 4);
          var hits = 0;
          entities(event.state).forEach(function (target) {
            if (pathDistance(target, points) > width + numberOr(target.radius, 0)) return;
            weaken(event.state, 'dash-wake-collapse', target, target.boss ? 0.055 : 0.09 + Math.min(0.06, effect.traitPotency * 0.01), 1.8);
            target.vx *= 0.55;
            target.vy *= 0.55;
            hits += 1;
          });
          effect.state.points = [];
          if (hits) {
            shockwave(event.state, event.state.player, 105, palette.pink || '#ff6fa8', 0.42);
            cue(event.state, event.state.player, label('WAKE COLLAPSE x', '尾流塌缩 x') + hits, palette.pink || '#ff6fa8');
          }
        }
      }
    },
    {
      id: 'dash.momentum-bank', family: 'dash', trait: 'momentum-bank',
      name: 'Momentum Bank', nameZh: '动量储库',
      description: 'Distance travelled during Dash is banked as temporary combat power; the next different skill spends it for cooldown refund.',
      descriptionZh: '冲刺距离会被储存为短暂战斗力，下一次释放其他技能时消耗储能并返还该技能冷却。',
      defaults: { distance: 0, lastX: 0, lastY: 0, bonusLog: 0, timeLeft: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'dash' && !event.redirected) {
            effect.state.distance = 0;
            effect.state.lastX = event.state.player.x;
            effect.state.lastY = event.state.player.y;
            return;
          }
          if (!event.id || event.id === 'dash' || !(effect.state.timeLeft > 0) || !event.skill) return;
          var refund = 0.4 + Math.min(1.4, numberOr(effect.state.bonusLog, 0) * 2.6);
          event.skill.cooldown = Math.max(0, numberOr(event.skill.cooldown, 0) - refund);
          effect.state.timeLeft = 0;
          effect.state.bonusLog = 0;
          cue(event.state, event.state.player, label('MOMENTUM SPENT', '动量释放'), palette.gold || '#ffd36f');
        },
        'dash:update': function (event, effect) {
          var x = event.state.player.x;
          var y = event.state.player.y;
          var dx = x - numberOr(effect.state.lastX, x);
          var dy = y - numberOr(effect.state.lastY, y);
          effect.state.distance += Math.sqrt(dx * dx + dy * dy);
          effect.state.lastX = x;
          effect.state.lastY = y;
        },
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id !== 'dash' || !event.natural) return;
          var travelled = numberOr(effect.state.distance, 0);
          if (travelled < 70) return;
          var multiplier = 1 + Math.min(0.58, travelled / 850 * (0.34 + effect.traitPotency * 0.025));
          effect.state.bonusLog = Math.log(multiplier);
          effect.state.timeLeft = 5.5;
          cue(event.state, event.state.player, label('MOMENTUM x', '动量 x') + multiplier.toFixed(2), palette.gold || '#ffd36f');
        },
        [E.POWER_LOG_MULTIPLIER]: function (event, effect) {
          if (effect.state.timeLeft > 0 && event.log !== Infinity) {
            event.log = numberOr(event.log, 0) + numberOr(effect.state.bonusLog, 0);
          }
        },
        [E.UPDATE]: function (event, effect) {
          effect.state.timeLeft = Math.max(0, numberOr(effect.state.timeLeft, 0) - numberOr(event.dt, 0));
        },
        [E.PLAYER_DAMAGED]: function (_event, effect) {
          effect.state.timeLeft = 0;
          effect.state.bonusLog = 0;
        }
      }
    },

    {
      id: 'shot.ricochet-lock', family: 'shot', trait: 'ricochet-lock',
      name: 'Ricochet Lock', nameZh: '折射锁定',
      description: 'A bolt that would expire on impact can lock onto a nearby unhit target and ricochet with reduced strength.',
      descriptionZh: '本应在命中后消散的基因弹会锁定附近尚未命中的目标，并以较低强度折射过去。',
      hooks: {
        [E.PROJECTILE_PREPARE]: function (event, effect) {
          if (event.id !== 'shot' || !event.bullet) return;
          event.bullet.ricochetsLeft = effect.traitPotency >= 4 ? 2 : 1;
        },
        [E.PROJECTILE_HIT]: function (event) {
          var bullet = event.bullet;
          if (!bullet || event.consume === false || !(bullet.ricochetsLeft > 0)) return;
          var next = nearestTarget(event.state, event.target, 285, function (target) {
            if (target === event.target || target.consumed) return false;
            return !(target.id && bullet.hitIds && bullet.hitIds[target.id]);
          });
          if (!next) return;
          var direction = normalize(next.x - bullet.x, next.y - bullet.y);
          var speed = Math.max(120, Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) * 0.9);
          bullet.vx = direction.x * speed;
          bullet.vy = direction.y * speed;
          bullet.weaken = Math.max(0.02, numberOr(bullet.weaken, 0.1) * 0.8);
          bullet.life = Math.max(numberOr(bullet.life, 0), 0.45);
          bullet.ricochetsLeft -= 1;
          event.consume = false;
          cue(event.state, next, label('RICOCHET', '折射锁定'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'shot.harpoon', family: 'shot', trait: 'harpoon',
      name: 'Harpoon', nameZh: '基因鱼叉',
      description: 'Hits tether the target briefly, pulling ordinary enemies toward you and slowing a boss that tries to leave.',
      descriptionZh: '命中会短暂钩住目标，把普通敌人牵向自身，并拖慢试图远离的 Boss。',
      hooks: {
        [E.PROJECTILE_HIT]: function (event, effect) {
          if (!event.target) return;
          event.target.harpoonUntil = currentTime(event.state) + 1.05 + Math.min(0.8, effect.traitPotency * 0.12);
          event.target.harpoonStrength = 1 + Math.min(0.7, effect.traitPotency * 0.1);
          cue(event.state, event.target, label('HARPOONED', '鱼叉锁链'), palette.gold || '#ffd36f');
        },
        [E.UPDATE]: function (event) {
          var state = event.state;
          var time = currentTime(state);
          entities(state).forEach(function (target) {
            if (!(numberOr(target.harpoonUntil, 0) > time)) return;
            var direction = normalize(state.player.x - target.x, state.player.y - target.y);
            var strength = (target.boss ? 58 : 165) * numberOr(target.harpoonStrength, 1);
            target.vx += direction.x * strength * numberOr(event.dt, 0);
            target.vy += direction.y * strength * numberOr(event.dt, 0);
            if (target.boss) target.attackCooldown = Math.max(numberOr(target.attackCooldown, 0), 0.15);
          });
        }
      }
    },
    {
      id: 'shot.split-genome', family: 'shot', trait: 'split-genome', priority: 30,
      name: 'Split Genome', nameZh: '分裂基因',
      description: 'Each shot buds two lighter side bolts that inherit the current projectile build.',
      descriptionZh: '每次射击会分裂出两枚较轻的侧向基因弹，并继承本次弹体已有的其他改造。',
      hooks: {
        [E.PROJECTILE_PREPARE]: function (event, effect) {
          var bullet = event.bullet;
          if (event.id !== 'shot' || !bullet || bullet.splitChild || !event.state.bullets) return;
          var angle = 0.13 + Math.min(0.07, effect.traitPotency * 0.01);
          [-angle, angle].forEach(function (offset) {
            var velocity = rotate(bullet.vx, bullet.vy, offset);
            var child = Object.assign({}, bullet, {
              vx: velocity.x * 0.9,
              vy: velocity.y * 0.9,
              radius: Math.max(2, numberOr(bullet.radius, 4) * 0.76),
              life: numberOr(bullet.life, 1) * 0.78,
              maxLife: numberOr(bullet.maxLife, bullet.life) * 0.78,
              weaken: Math.max(0.02, numberOr(bullet.weaken, 0.1) * 0.52),
              hitIds: Object.create(null),
              splitChild: true
            });
            event.state.bullets.push(child);
          });
        }
      }
    },
    {
      id: 'shot.quarry-mark', family: 'shot', trait: 'quarry-mark',
      name: 'Quarry Mark', nameZh: '猎物标记',
      description: 'The first hit marks a quarry; later bolts against the same target weaken harder and cycle Shot faster.',
      descriptionZh: '首次命中会标记猎物，后续基因弹攻击同一目标时削弱更强，并更快推进射击冷却。',
      hooks: {
        [E.PROJECTILE_HIT]: function (event, effect) {
          var target = event.target;
          if (!target) return;
          var now = currentTime(event.state);
          if (numberOr(target.quarryMarkUntil, 0) > now) {
            event.weaken = Math.min(0.82, numberOr(event.weaken, 0) * (1.2 + Math.min(0.12, effect.traitPotency * 0.018)));
            target.quarryMarkUntil = now + 4.5;
            if (event.state.skills && event.state.skills.shot) {
              event.state.skills.shot.cooldown = Math.max(0, numberOr(event.state.skills.shot.cooldown, 0) - 0.11);
            }
            cue(event.state, target, label('QUARRY HIT', '猎物追击'), palette.gold || '#ffd36f');
            return;
          }
          target.quarryMarkUntil = now + 4.5;
          cue(event.state, target, label('QUARRY MARK', '猎物标记'), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'shot.primer-shot', family: 'shot', trait: 'primer-shot',
      name: 'Primer Shot', nameZh: '引信弹',
      description: 'Shot plants a gene primer that the next different weakening skill detonates for a stronger, longer debuff.',
      descriptionZh: '射击会植入基因引信，下一次由其他技能造成的削弱将引爆它，获得更强且更持久的效果。',
      hooks: {
        [E.PROJECTILE_HIT]: function (event, effect) {
          if (!event.target) return;
          event.target.genePrimerUntil = currentTime(event.state) + 5;
          event.target.genePrimerPotency = effect.traitPotency;
          cue(event.state, event.target, label('PRIMED', '引信植入'), palette.orange || '#ff8a38');
        },
        [E.TARGET_WEAKEN]: function (event) {
          var target = event.target;
          if (!target || event.sourceId === 'shot' || numberOr(target.genePrimerUntil, 0) <= currentTime(event.state)) return;
          event.amount = Math.min(0.82, numberOr(event.amount, 0) * (1.17 + Math.min(0.11, numberOr(target.genePrimerPotency, 0) * 0.018)));
          event.duration = numberOr(event.duration, 0) + 0.45;
          target.genePrimerUntil = 0;
          cue(event.state, target, label('PRIMER BURST', '引信爆发'), palette.orange || '#ff8a38');
        }
      }
    },
    {
      id: 'shot.frost-needle', family: 'shot', trait: 'frost-needle',
      name: 'Frost Needle', nameZh: '霜针',
      description: 'Hits chill an unfrozen target; striking an already frozen target consumes part of the freeze for bonus weakening.',
      descriptionZh: '命中未冻结目标时施加寒意；攻击已冻结目标则消耗部分冻结时间，换取额外削弱。',
      hooks: {
        [E.PROJECTILE_HIT]: function (event, effect) {
          var target = event.target;
          if (!target) return;
          if (target.frozen > 0) {
            event.weaken = Math.min(0.82, numberOr(event.weaken, 0) + 0.07 + Math.min(0.05, effect.traitPotency * 0.008));
            target.frozen *= 0.55;
            cue(event.state, target, label('FROST PUNCTURE', '霜裂穿刺'), palette.cyan || '#65e5ff');
            return;
          }
          applyFreeze(event.state, target, 0.62 + Math.min(0.55, effect.traitPotency * 0.09), 'shot-frost-needle', 1, 0);
        }
      }
    },
    {
      id: 'shot.waveguide-shot', family: 'shot', trait: 'waveguide-shot',
      name: 'Waveguide Shot', nameZh: '波导弹道',
      description: 'Gene bolts gently bend toward nearby revealed, marked or attacking targets without making a full turn backward.',
      descriptionZh: '基因弹会柔和修正弹道，优先追向附近已揭示、已标记或正在攻击的目标，但不会原地掉头。',
      hooks: {
        [E.PROJECTILE_PREPARE]: function (event, effect) {
          if (event.id !== 'shot' || !event.bullet) return;
          event.bullet.waveguide = true;
          event.bullet.waveguideTurn = 1.8 + Math.min(1.5, effect.traitPotency * 0.2);
        },
        [E.UPDATE]: function (event) {
          var state = event.state;
          (state.bullets || []).forEach(function (bullet) {
            if (!bullet || !bullet.waveguide) return;
            var speed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
            if (speed <= 0) return;
            var forward = { x: bullet.vx / speed, y: bullet.vy / speed };
            var best = null;
            var bestScore = Infinity;
            entities(state).forEach(function (target) {
              if (target.id && bullet.hitIds && bullet.hitIds[target.id]) return;
              var dx = target.x - bullet.x;
              var dy = target.y - bullet.y;
              var targetDistance = Math.sqrt(dx * dx + dy * dy);
              if (targetDistance > 275 || targetDistance <= 0) return;
              var facing = (dx / targetDistance) * forward.x + (dy / targetDistance) * forward.y;
              if (facing < -0.12) return;
              var priority = target.revealed > 0 || target.quarryMarkUntil > currentTime(state) || (target.attackState && target.attackState !== 'idle') ? 85 : 0;
              var score = targetDistance - priority;
              if (score < bestScore) {
                best = target;
                bestScore = score;
              }
            });
            if (!best) return;
            var desired = normalize(best.x - bullet.x, best.y - bullet.y);
            var blend = clamp(numberOr(event.dt, 0) * numberOr(bullet.waveguideTurn, 2), 0, 0.28);
            var direction = normalize(forward.x * (1 - blend) + desired.x * blend, forward.y * (1 - blend) + desired.y * blend);
            bullet.vx = direction.x * speed;
            bullet.vy = direction.y * speed;
          });
        }
      }
    },
    {
      id: 'shot.repeater-circuit', family: 'shot', trait: 'repeater-circuit',
      name: 'Repeater Circuit', nameZh: '复进回路',
      description: 'Rapid hits on different targets build a circuit: later bolts fly harder and each new link refunds Shot cooldown.',
      descriptionZh: '短时间内连续命中不同目标会建立回路，后续弹体更强，每接通一个新目标都会返还射击冷却。',
      defaults: { stacks: 0, lastTarget: null, timeLeft: 0 },
      hooks: {
        [E.PROJECTILE_PREPARE]: function (event, effect) {
          if (event.id !== 'shot' || !event.bullet || !(effect.state.timeLeft > 0)) return;
          var stacks = clamp(numberOr(effect.state.stacks, 0), 0, 5);
          event.bullet.weaken *= 1 + stacks * 0.055;
          event.bullet.vx *= 1 + stacks * 0.035;
          event.bullet.vy *= 1 + stacks * 0.035;
        },
        [E.PROJECTILE_HIT]: function (event, effect) {
          if (!event.target) return;
          if (effect.state.timeLeft > 0 && effect.state.lastTarget !== event.target) {
            effect.state.stacks = Math.min(5, numberOr(effect.state.stacks, 0) + 1);
          } else if (effect.state.lastTarget === event.target) {
            effect.state.stacks = 0;
          } else {
            effect.state.stacks = 1;
          }
          effect.state.lastTarget = event.target;
          effect.state.timeLeft = 2.25;
          if (event.state.skills && event.state.skills.shot) {
            event.state.skills.shot.cooldown = Math.max(0, numberOr(event.state.skills.shot.cooldown, 0) - 0.06 - effect.state.stacks * 0.025);
          }
          if (effect.state.stacks >= 2) cue(event.state, event.target, label('CIRCUIT x', '回路 x') + effect.state.stacks, palette.mint || '#64f0b6');
        },
        [E.UPDATE]: function (event, effect) {
          effect.state.timeLeft = Math.max(0, numberOr(effect.state.timeLeft, 0) - numberOr(event.dt, 0));
          if (effect.state.timeLeft <= 0) {
            effect.state.stacks = 0;
            effect.state.lastTarget = null;
          }
        },
        [E.PLAYER_DAMAGED]: function (_event, effect) {
          effect.state.stacks = 0;
          effect.state.lastTarget = null;
          effect.state.timeLeft = 0;
        }
      }
    },

    {
      id: 'nova.repulsion-ring', family: 'nova', trait: 'repulsion-ring',
      name: 'Repulsion Ring', nameZh: '斥力环',
      description: 'Nova throws targets in its outer band away from the core and interrupts attacks caught on the ring.',
      descriptionZh: '脉冲会把外圈目标推离核心，并打断恰好落在斥力环上的攻击动作。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova') return;
          var origin = event.origin || event.state.player;
          (event.targets || []).forEach(function (target) {
            var targetDistance = distance(target, origin);
            if (targetDistance < numberOr(event.radius, 100) * 0.5) return;
            var direction = normalize(target.x - origin.x, target.y - origin.y);
            var force = (target.boss ? 80 : 230) * (1 + Math.min(0.35, effect.traitPotency * 0.05));
            target.vx += direction.x * force;
            target.vy += direction.y * force;
            if (hostile(target) && target.attackState && target.attackState !== 'idle') resetAttack(target, 0.75);
          });
        }
      }
    },
    {
      id: 'nova.chain-pulse', family: 'nova', trait: 'chain-pulse',
      name: 'Chain Pulse', nameZh: '链式脉冲',
      description: 'Primary Nova jumps from struck targets to nearby enemies outside the original wave, with each jump losing force.',
      descriptionZh: '主脉冲会从已命中目标继续跳向原范围外的附近敌人，每次跳跃都会衰减强度。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova' || !event.primary || event.replay || !event.targets || !event.targets.length) return;
          var seen = event.targets.slice();
          var frontier = event.targets.slice();
          var limit = effect.traitPotency >= 4 ? 4 : 3;
          var jumps = 0;
          while (frontier.length && jumps < limit) {
            var source = frontier.shift();
            var next = nearestTarget(event.state, source, 155, function (target) {
              return seen.indexOf(target) === -1;
            });
            if (!next) continue;
            seen.push(next);
            frontier.push(next);
            var scale = Math.pow(0.72, jumps + 1);
            weaken(event.state, 'nova-chain', next, numberOr(event.weaken, 0.1) * scale, Math.max(0.5, numberOr(event.duration, 1) * 0.72));
            shockwave(event.state, next, 54, palette.pink || '#ff6fa8', 0.3);
            jumps += 1;
          }
          if (jumps) cue(event.state, event.state.player, label('CHAIN x', '链式脉冲 x') + jumps, palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'nova.silence-field', family: 'nova', trait: 'silence-field',
      name: 'Silence Field', nameZh: '静默场',
      description: 'Enemies touched by Nova lose their current attack and cannot begin another one for a short interval.',
      descriptionZh: '被脉冲触及的敌人会中止当前攻击，并在短时间内无法再次进入蓄力。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova') return;
          var duration = 1 + Math.min(1.15, effect.traitPotency * 0.16);
          (event.targets || []).forEach(function (target) {
            if (!hostile(target)) return;
            resetAttack(target, duration);
            target.silencedUntil = currentTime(event.state) + duration;
            cue(event.state, target, label('SILENCED', '静默'), palette.cyan || '#65e5ff');
          });
        }
      }
    },
    {
      id: 'nova.perimeter-mine', family: 'nova', trait: 'perimeter-mine',
      name: 'Perimeter Mine', nameZh: '周界脉雷',
      description: 'Nova leaves an armed ring at its origin; an enemy crossing the perimeter triggers a smaller delayed pulse.',
      descriptionZh: '脉冲会在原点留下武装周界，敌人进入环带时触发一轮较小的延迟脉冲。',
      defaults: { mine: null },
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova' || !event.primary || event.replay) return;
          var origin = event.origin || event.state.player;
          effect.state.mine = {
            x: origin.x,
            y: origin.y,
            radius: Math.max(70, numberOr(event.radius, 120) * 0.72),
            weaken: numberOr(event.weaken, 0.12) * 0.52,
            duration: Math.max(0.6, numberOr(event.duration, 1.4) * 0.72),
            age: 0,
            life: 5.2
          };
          shockwave(event.state, effect.state.mine, effect.state.mine.radius, palette.gold || '#ffd36f', 1.15);
        },
        [E.UPDATE]: function (event, effect) {
          var mine = effect.state.mine;
          if (!mine) return;
          mine.age += numberOr(event.dt, 0);
          if (mine.age >= mine.life) {
            effect.state.mine = null;
            return;
          }
          if (mine.age < 0.32) return;
          var trigger = nearestTarget(event.state, mine, mine.radius * 1.12, function (target) {
            if (!hostile(target)) return false;
            var targetDistance = distance(target, mine);
            return targetDistance >= mine.radius * 0.58;
          });
          if (!trigger) return;
          effect.state.mine = null;
          if (window.NovaSkill && typeof NovaSkill.resolvePulse === 'function') {
            NovaSkill.resolvePulse(event.state, {
              origin: mine,
              radius: mine.radius * 0.82,
              weaken: mine.weaken,
              duration: mine.duration,
              sourceId: 'nova-mine',
              primary: false,
              replay: true
            });
          } else {
            entities(event.state).forEach(function (target) {
              if (distance(target, mine) <= mine.radius * 0.82) weaken(event.state, 'nova-mine', target, mine.weaken, mine.duration);
            });
          }
          shockwave(event.state, mine, mine.radius, palette.gold || '#ffd36f', 0.5);
          cue(event.state, trigger, label('PERIMETER MINE', '周界脉雷'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'nova.forward-lobe', family: 'nova', trait: 'forward-lobe', priority: -10,
      name: 'Forward Lobe', nameZh: '前向波瓣',
      description: 'Nova shifts into a tighter forward lobe, trading rear coverage for greater weakening at the aimed location.',
      descriptionZh: '脉冲会收束并前移，把后方覆盖换成目标方向上更强的削弱。',
      hooks: {
        [E.AREA_PREPARE]: function (event, effect) {
          if (event.id !== 'nova' || event.replay) return;
          var player = event.state.player;
          var direction = Math.abs(numberOr(player.vx, 0)) + Math.abs(numberOr(player.vy, 0)) > 25
            ? normalize(player.vx, player.vy)
            : { x: Math.cos(numberOr(player.angle, 0)), y: Math.sin(numberOr(player.angle, 0)) };
          var baseRadius = numberOr(event.radius, 120);
          event.origin = {
            x: player.x + direction.x * baseRadius * 0.38,
            y: player.y + direction.y * baseRadius * 0.38
          };
          event.radius = baseRadius * 0.88;
          event.weaken = Math.min(0.82, numberOr(event.weaken, 0.1) * (1.1 + Math.min(0.08, effect.traitPotency * 0.012)));
        }
      }
    },
    {
      id: 'nova.feeding-vortex', family: 'nova', trait: 'feeding-vortex',
      name: 'Feeding Vortex', nameZh: '捕食涡流',
      description: 'Prey touched by Nova spiral toward you for a few seconds; consuming one advances Nova cooldown.',
      descriptionZh: '被脉冲触及的成长鱼与字母鱼会在数秒内卷向主角，吞噬其中任意一条都会推进脉冲冷却。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova') return;
          (event.targets || []).forEach(function (target) {
            if (target.kind !== 'growth' && target.kind !== 'letter') return;
            target.feedingVortexUntil = currentTime(event.state) + 1.8 + Math.min(1.3, effect.traitPotency * 0.18);
          });
        },
        [E.UPDATE]: function (event) {
          var state = event.state;
          var time = currentTime(state);
          (state.enemies || []).forEach(function (target) {
            if (!(numberOr(target.feedingVortexUntil, 0) > time)) return;
            var direction = normalize(state.player.x - target.x, state.player.y - target.y);
            var tangent = { x: -direction.y, y: direction.x };
            target.vx += (direction.x * 210 + tangent.x * 80) * numberOr(event.dt, 0);
            target.vy += (direction.y * 210 + tangent.y * 80) * numberOr(event.dt, 0);
          });
        },
        [E.ENEMY_CONSUMED]: function (event) {
          if (!event.enemy || !(numberOr(event.enemy.feedingVortexUntil, 0) > currentTime(event.state)) || !event.state.skills || !event.state.skills.nova) return;
          event.state.skills.nova.cooldown = Math.max(0, numberOr(event.state.skills.nova.cooldown, 0) - 0.28);
        }
      }
    },
    {
      id: 'nova.catalytic-pulse', family: 'nova', trait: 'catalytic-pulse',
      name: 'Catalytic Pulse', nameZh: '催化脉冲',
      description: 'Nova gains extra weakening for each useful status already on a target: freeze, corrosion, reveal, quarry mark or primer.',
      descriptionZh: '目标身上已有的冻结、侵蚀、揭示、猎物标记或基因引信，都会分别催化本次脉冲削弱。',
      hooks: {
        [E.TARGET_WEAKEN]: function (event, effect) {
          if (event.sourceId !== 'nova' && event.sourceId !== 'nova-mine' && event.sourceId !== 'nova-chain') return;
          var target = event.target;
          if (!target) return;
          var statuses = 0;
          if (target.frozen > 0) statuses += 1;
          if (target.corrodeTimer > 0) statuses += 1;
          if (target.revealed > 0) statuses += 1;
          if (target.quarryMarkUntil > currentTime(event.state)) statuses += 1;
          if (target.genePrimerUntil > currentTime(event.state)) statuses += 1;
          if (!statuses) return;
          var bonus = Math.min(0.42, statuses * (0.065 + Math.min(0.025, effect.traitPotency * 0.004)));
          event.amount = Math.min(0.82, numberOr(event.amount, 0) * (1 + bonus));
          event.duration = numberOr(event.duration, 0) + statuses * 0.12;
          cue(event.state, target, label('CATALYSIS x', '状态催化 x') + statuses, palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'nova.cascade-engine', family: 'nova', trait: 'cascade-engine',
      name: 'Cascade Engine', nameZh: '级联引擎',
      description: 'Every target in the primary pulse refunds Nova cooldown; a large catch also advances the slowest other powered skill.',
      descriptionZh: '主脉冲每命中一个目标都会返还自身冷却；命中数量足够多时，还会推进另一个仍由当前基因供能、且冷却最滞后的技能。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova' || !event.primary || event.replay || !event.state.skills || !event.state.skills.nova) return;
          var count = (event.targets || []).length;
          if (!count) return;
          var refund = Math.min(2.1, count * (0.12 + Math.min(0.05, effect.traitPotency * 0.007)));
          event.state.skills.nova.cooldown = Math.max(0, numberOr(event.state.skills.nova.cooldown, 0) - refund);
          if (count >= 5) {
            var best = null;
            (event.state.player.activeSlots || []).forEach(function (id) {
              if (!id || id === 'nova' || !event.state.skills[id] || !SkillEffects.isPowered(event.state, id)) return;
              var skill = event.state.skills[id];
              if (!best || numberOr(skill.cooldown, 0) > numberOr(best.cooldown, 0)) best = skill;
            });
            if (best) best.cooldown = Math.max(0, numberOr(best.cooldown, 0) - 0.75);
          }
          cue(event.state, event.state.player, label('CASCADE x', '级联 x') + count, palette.mint || '#64f0b6');
        }
      }
    },

    {
      id: 'guard.mirror-shell', family: 'guard', trait: 'mirror-shell',
      name: 'Mirror Shell', nameZh: '镜面护壳',
      description: 'Every blocked hit reflects a portion of its force back as weakening, even outside the perfect-parry window.',
      descriptionZh: '每次成功格挡都会把部分冲击反射成削弱，即使已经错过完美格挡时机也会生效。',
      hooks: {
        [E.GUARD_ABSORBED]: function (event, effect) {
          if (!event.source || event.source.consumed) return;
          var amount = 0.1 + Math.min(0.09, effect.traitPotency * 0.014);
          weaken(event.state, 'guard-mirror', event.source, event.source.boss ? amount * 0.65 : amount, 1.8);
          cue(event.state, event.source, label('REFLECT', '镜面反射'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'guard.layered-carapace', family: 'guard', trait: 'layered-carapace',
      name: 'Layered Carapace', nameZh: '层叠甲壳',
      description: 'The first block sheds only an outer layer, leaving a short inner Guard that can absorb another hit.',
      descriptionZh: '第一次格挡只会剥落外层甲壳，并留下一个持续较短的内层护膜，可再承受一次攻击。',
      defaults: { layers: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'guard') effect.state.layers = effect.traitPotency >= 4.5 ? 2 : 1;
        },
        [E.GUARD_ABSORBED]: function (event, effect) {
          var guard = event.guard;
          if (!guard || !(effect.state.layers > 0)) return;
          effect.state.layers -= 1;
          guard.active = true;
          var invulnerability = numberOr(event.state.player && event.state.player.invulnerable, 0);
          var remaining = Math.max(
            invulnerability + 0.12,
            0.5 + Math.min(0.32, effect.traitPotency * 0.05)
          );
          guard.duration = Math.max(numberOr(guard.duration, remaining), remaining);
          guard.age = Math.max(0, numberOr(guard.duration, remaining) - remaining);
          cue(event.state, event.state.player, label('INNER LAYER ', '内层护膜 ') + effect.state.layers, palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'guard.anchor-plate', family: 'guard', trait: 'anchor-plate',
      name: 'Anchor Plate', nameZh: '锚定甲板',
      description: 'Holding nearly still slows Guard consumption; blocking after anchoring punishes the attacker and refunds cooldown.',
      descriptionZh: '保持近乎静止会减慢护膜消耗；完成锚定后再格挡，可额外削弱攻击者并返还冷却。',
      defaults: { anchored: 0 },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'guard') effect.state.anchored = 0;
        },
        [E.UPDATE]: function (event, effect) {
          var guard = event.state.skills && event.state.skills.guard;
          if (!guard || !guard.active) {
            effect.state.anchored = Math.max(0, numberOr(effect.state.anchored, 0) - numberOr(event.dt, 0));
            return;
          }
          var speed = Math.sqrt(event.state.player.vx * event.state.player.vx + event.state.player.vy * event.state.player.vy);
          if (speed <= 42) {
            guard.age = Math.max(0, numberOr(guard.age, 0) - numberOr(event.dt, 0) * 0.48);
            effect.state.anchored = Math.min(1.5, numberOr(effect.state.anchored, 0) + numberOr(event.dt, 0));
          } else {
            effect.state.anchored = Math.max(0, numberOr(effect.state.anchored, 0) - numberOr(event.dt, 0) * 1.4);
          }
        },
        [E.GUARD_ABSORBED]: function (event, effect) {
          if (effect.state.anchored < 0.45) return;
          if (event.source) weaken(event.state, 'guard-anchor', event.source, event.source.boss ? 0.06 : 0.12, 1.6);
          if (event.guard) event.guard.cooldown = Math.max(0, numberOr(event.guard.cooldown, 0) - 0.75);
          effect.state.anchored = 0;
          cue(event.state, event.state.player, label('ANCHORED BLOCK', '锚定格挡'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'guard.last-reserve', family: 'guard', trait: 'last-reserve',
      name: 'Last Reserve', nameZh: '最后储备',
      description: 'When a hit would reach an empty growth reserve and tear the genome, Guard triggers automatically on an internal cooldown.',
      descriptionZh: '成长战力已经耗尽、下一击将撕裂基因组时，守护会按独立冷却自动触发一次。',
      defaults: { readyAt: 0 },
      hooks: {
        [E.PLAYER_DAMAGE]: function (event, effect) {
          var state = event.state;
          var now = currentTime(state);
          if (event.cancelled || !(event.amount > 0) || now < numberOr(effect.state.readyAt, 0) || state.growthPower > 0 || !state.genome || !state.genome.letters.length) return;
          event.cancelled = true;
          effect.state.readyAt = now + Math.max(8, 12 - effect.traitPotency * 0.45);
          state.player.invulnerable = Math.max(numberOr(state.player.invulnerable, 0), 0.45);
          if (state.skills && state.skills.guard) {
            state.skills.guard.active = false;
            state.skills.guard.cooldown = Math.max(numberOr(state.skills.guard.cooldown, 0), 6.5);
          }
          shockwave(state, state.player, 115, palette.gold || '#ffd36f', 0.48);
          cue(state, state.player, label('LAST RESERVE', '最后储备'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'guard.word-bastion', family: 'guard', trait: 'word-bastion',
      name: 'Word Bastion', nameZh: '词阵壁垒',
      description: 'Every live word occurrence, including overlaps and repeats, extends Guard when it opens.',
      descriptionZh: '护膜展开时，当前每一个有效单词实例都会延长其持续时间，重叠词与重复词同样计入。',
      hooks: {
        [E.SKILL_STARTED]: function (event) {
          if (event.id !== 'guard' || !event.skill) return;
          var count = event.state.words && event.state.words.potentialOccurrences ? event.state.words.potentialOccurrences.length : 0;
          if (!count) return;
          var extension = Math.min(2.4, count * 0.075);
          event.skill.duration += extension;
          cue(event.state, event.state.player, label('WORD BASTION +', '词阵壁垒 +') + extension.toFixed(1) + 's', palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'guard.retaliation-seal', family: 'guard', trait: 'retaliation-seal',
      name: 'Retaliation Seal', nameZh: '反击刻印',
      description: 'Blocking seals the attacker; the next offensive skill to weaken that target consumes the seal for a large bonus.',
      descriptionZh: '格挡会给攻击者刻下反击印记；下一次进攻技能削弱该目标时消耗印记并获得显著增幅。',
      hooks: {
        [E.GUARD_ABSORBED]: function (event, effect) {
          if (!event.source) return;
          event.source.retaliationSealUntil = currentTime(event.state) + 5.5;
          event.source.retaliationSealPotency = effect.traitPotency;
        },
        [E.TARGET_WEAKEN]: function (event) {
          var target = event.target;
          if (!target || event.sourceId === 'guard-mirror' || event.sourceId === 'guard-anchor' || event.sourceId === 'parry') return;
          if (numberOr(target.retaliationSealUntil, 0) <= currentTime(event.state)) return;
          event.amount = Math.min(0.82, numberOr(event.amount, 0) * (1.25 + Math.min(0.16, numberOr(target.retaliationSealPotency, 0) * 0.022)));
          event.duration = numberOr(event.duration, 0) + 0.4;
          target.retaliationSealUntil = 0;
          cue(event.state, target, label('RETALIATION', '反击刻印'), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'guard.countercurrent', family: 'guard', trait: 'countercurrent',
      name: 'Countercurrent', nameZh: '逆向回流',
      description: 'A blocked force launches you away from its source and sweeps nearby hostile shots aside; a powered Dash also gains cooldown.',
      descriptionZh: '格挡会把冲击转成反向水流，将主角推离来源并拨开附近敌方弹体；冲刺仍由当前基因供能时，还会推进其冷却。',
      hooks: {
        [E.GUARD_ABSORBED]: function (event, effect) {
          var state = event.state;
          var source = event.source || { x: state.player.x, y: state.player.y + 1 };
          var direction = normalize(state.player.x - source.x, state.player.y - source.y);
          var force = 210 + Math.min(160, effect.traitPotency * 24);
          state.player.vx += direction.x * force;
          state.player.vy += direction.y * force;
          (state.enemyBullets || []).forEach(function (bullet) {
            if (distance(bullet, state.player) > 155) return;
            var away = normalize(bullet.x - state.player.x, bullet.y - state.player.y);
            var speed = Math.max(170, Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy));
            bullet.vx = away.x * speed;
            bullet.vy = away.y * speed;
          });
          if (state.skills && state.skills.dash && SkillEffects.isPowered(state, 'dash')) {
            state.skills.dash.cooldown = Math.max(0, numberOr(state.skills.dash.cooldown, 0) - 0.9);
          }
          cue(state, state.player, label('COUNTERCURRENT', '逆向回流'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'guard.bastion-field', family: 'guard', trait: 'bastion-field',
      name: 'Bastion Field', nameZh: '壁垒场',
      description: 'While Guard is active, nearby enemy windups and hostile projectiles are slowed inside a defensive field.',
      descriptionZh: '护膜生效期间，防御场会拖慢附近敌人的蓄力过程与进入范围的敌方弹体。',
      hooks: {
        [E.UPDATE]: function (event, effect) {
          var state = event.state;
          var guard = state.skills && state.skills.guard;
          if (!guard || !guard.active) return;
          var radius = 125 + Math.min(75, effect.traitPotency * 10);
          entities(state).forEach(function (target) {
            if (!hostile(target) || distance(target, state.player) > radius + numberOr(target.radius, 0)) return;
            target.vx *= Math.max(0.7, 1 - numberOr(event.dt, 0) * 2.2);
            target.vy *= Math.max(0.7, 1 - numberOr(event.dt, 0) * 2.2);
            if (target.attackState === 'windup') target.attackAge = Math.max(0, numberOr(target.attackAge, 0) - numberOr(event.dt, 0) * 0.58);
          });
          (state.enemyBullets || []).forEach(function (bullet) {
            if (distance(bullet, state.player) > radius) return;
            var slowdown = Math.max(0.78, 1 - numberOr(event.dt, 0) * 2.4);
            bullet.vx *= slowdown;
            bullet.vy *= slowdown;
          });
        }
      }
    }
  ]);
})();
