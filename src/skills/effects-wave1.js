(function () {
  if (!window.SkillEffects) return;

  var E = SkillEffects.EVENTS;
  var palette = (window.GameConfig && GameConfig.palette) || {};

  function cue(state, target, text, color) {
    if (!state || !state.floatingTexts || !target) return;
    state.floatingTexts.push({
      x: target.x,
      y: target.y - (target.radius || 12) - 18,
      text: text,
      color: color || palette.cyan || '#65e5ff',
      life: 0.8,
      maxLife: 0.8
    });
  }

  function label(en, zh) {
    return window.I18n && typeof I18n.locale === 'function' && I18n.locale() === 'zh-CN' ? zh : en;
  }

  function entities(state) {
    var list = (state.enemies || []).slice();
    if (state.boss && state.boss.active) list.push(state.boss.active);
    return list;
  }

  function resetAttack(target, cooldown) {
    if (!target) return;
    if (target.attackState && target.attackState !== 'idle') target.attackState = 'idle';
    target.attackAge = 0;
    target.pulseHit = false;
    target.chargeBoost = 1;
    target.chargeScale = 1;
    target.attackCooldown = Math.max(Number(target.attackCooldown) || 0, cooldown || 0);
  }

  function layerGrowthValue(state) {
    var layer = state && state.map ? Number(state.map.currentLayer) || 1 : 1;
    var growth = (window.GameConfig && GameConfig.growth) || {};
    return Number(growth.fishBase || 1) + Math.max(0, layer - 1) * Number(growth.fishPerLayer || 0);
  }

  function replaySnapshot(state, event) {
    var id = event && event.id;
    var skill = state.skills && state.skills[id];
    var snapshot = { id: id, scale: 0.55 };
    if (id === 'shot') {
      var latestBullet = state.bullets && state.bullets[state.bullets.length - 1];
      snapshot.bullet = latestBullet ? Object.assign({}, latestBullet) : null;
    } else if (id === 'dash') {
      snapshot.direction = skill && skill.direction ? { x: skill.direction.x, y: skill.direction.y } : null;
      snapshot.duration = skill && skill.duration;
      snapshot.maxBoost = skill && skill.maxBoost;
      snapshot.speed = skill && skill.speed;
    } else if (id === 'nova') {
      snapshot.radius = skill && skill.radius;
      snapshot.weaken = skill && skill.weaken;
      snapshot.duration = skill && skill.weaknessDuration;
    } else if (id === 'freeze') {
      snapshot.radius = skill && skill.lastRadius;
      snapshot.duration = skill && skill.lastDuration;
    } else if (id === 'scan') {
      snapshot.radius = skill && skill.radius;
      snapshot.revealTime = skill && skill.revealTime;
    } else if (id === 'corrode') {
      snapshot.target = skill && skill.target;
      snapshot.weaken = skill && skill.weaken;
      snapshot.duration = (skill && skill.effectDuration) || 1.5;
    } else if (id === 'splice') {
      snapshot.letter = skill && skill.lastSequence ? skill.lastSequence.slice(-1) : '';
    }
    return snapshot;
  }

  function replaySkill(state, snapshot) {
    if (!snapshot || !snapshot.id) return false;
    var scale = Number(snapshot.scale) || 0.55;
    if (snapshot.id === 'shot' && snapshot.bullet) {
      var original = snapshot.bullet;
      var bullet = Object.assign({}, original, {
        x: original.x,
        y: original.y,
        vx: original.vx * 0.94,
        vy: original.vy * 0.94,
        weaken: Math.max(0.02, (Number(original.weaken) || 0.1) * scale),
        life: Math.min(Number(original.maxLife) || 1.8, Number(original.life) || 1.2),
        maxLife: Number(original.maxLife) || 1.8,
        hitIds: Object.create(null),
        replay: true
      });
      state.bullets.push(bullet);
      cue(state, state.player, label('REPRISE', '复唱'), palette.pink || '#ff6fa8');
      return true;
    }
    if (snapshot.id === 'nova' && window.NovaSkill && typeof NovaSkill.resolvePulse === 'function') {
      NovaSkill.resolvePulse(state, {
        origin: state.player,
        radius: Math.max(30, (Number(snapshot.radius) || 120) * 0.72),
        weaken: Math.max(0.02, (Number(snapshot.weaken) || 0.1) * scale),
        duration: Math.max(0.5, (Number(snapshot.duration) || 1.2) * scale),
        replay: true,
        primary: false
      });
      if (window.ShotSkill) ShotSkill.burst(state, state.player.x, state.player.y, palette.pink || '#ff6fa8', 12);
      return true;
    }
    if (snapshot.id === 'freeze' && window.FreezeSkill && typeof FreezeSkill.applyField === 'function') {
      FreezeSkill.applyField(state, Math.max(40, (Number(snapshot.radius) || 120) * 0.8), Math.max(0.5, (Number(snapshot.duration) || 1.5) * scale), { replay: true });
      return true;
    }
    if (snapshot.id === 'scan') {
      var radius = Number(snapshot.radius) || 220;
      entities(state).forEach(function (target) {
        if (Utils.dist(target, state.player) > radius) return;
        target.revealed = Math.max(target.revealed || 0, Math.max(0.6, (Number(snapshot.revealTime) || 2) * scale));
        target.revealScale = Math.max(target.revealScale || 0, 0.5);
      });
      return true;
    }
    if (snapshot.id === 'corrode' && snapshot.target && window.CorrodeSkill && typeof CorrodeSkill.applyCorrosion === 'function') {
      var corrodeTarget = snapshot.target;
      var liveTarget = !corrodeTarget.consumed && (
        (state.enemies || []).indexOf(corrodeTarget) !== -1 ||
        !!(state.boss && state.boss.active === corrodeTarget)
      );
      if (!liveTarget) return false;
      CorrodeSkill.applyCorrosion(
        state,
        corrodeTarget,
        Math.max(0.02, (Number(snapshot.weaken) || 0.1) * scale),
        Math.max(0.5, (Number(snapshot.duration) || 1.5) * scale)
      );
      return true;
    }
    if (snapshot.id === 'dash' && state.skills && state.skills.dash) {
      var dash = state.skills.dash;
      var direction = snapshot.direction || dash.direction || { x: 0, y: 1 };
      dash.active = true;
      dash.age = 0;
      dash.direction = { x: direction.x, y: direction.y };
      dash.redirectsLeft = 0;
      dash.duration = Math.max(0.18, (Number(snapshot.duration) || 0.46) * scale);
      dash.maxBoost = 1 + Math.max(0, (Number(snapshot.maxBoost) || 1.5) - 1) * scale;
      dash.speed = Math.max(120, (Number(snapshot.speed) || 360) * (0.7 + scale * 0.3));
      cue(state, state.player, label('REPRISE', '复唱'), palette.pink || '#ff6fa8');
      return true;
    }
    if (snapshot.id === 'guard' && state.skills && state.skills.guard && state.skills.guard.active) {
      state.skills.guard.duration += Math.max(0.12, state.skills.guard.duration * scale * 0.35);
      return true;
    }
    if (snapshot.id === 'growth' && state.skills && state.skills.growth) {
      state.skills.growth.active = true;
      state.skills.growth.charges = Math.max(1, (state.skills.growth.charges || 0) + 1);
      return true;
    }
    if (snapshot.id === 'splice' && snapshot.letter && window.GenomeSystem && typeof GenomeSystem.addLetter === 'function') {
      GenomeSystem.addLetter(state, snapshot.letter, 'echo-replay');
      return true;
    }
    return false;
  }

  function attackForecast(state, enemy) {
    if (!SkillEffects.has(state, 'scan.threat-forecast') || !enemy || enemy.revealed <= 0 || enemy.attackState === 'idle') return null;
    var duration = enemy.attackState === 'pulse' ? 0.78 : enemy.kind === 'disruptor' ? 1.15 : enemy.kind === 'spitter' ? 0.82 : enemy.attackState === 'charge' ? 0.56 : 0.62;
    var progress = Math.max(0, Math.min(1, (Number(enemy.attackAge) || 0) / duration));
    var target = enemy.kind === 'disruptor'
      ? enemy
      : enemy.attackTarget && (enemy.attackTarget.x || enemy.attackTarget.y) ? enemy.attackTarget : state.player;
    var radius = enemy.attackState === 'pulse' ? 26 + progress * 270 : enemy.kind === 'hunter' ? 22 + (enemy.radius || 12) : 13;
    return { target: target, radius: radius, timeRemaining: Math.max(0, duration - (Number(enemy.attackAge) || 0)), progress: progress };
  }

  SkillEffects.replaySkill = replaySkill;
  SkillEffects.attackForecast = attackForecast;
  if (window.SkillSystem) {
    SkillSystem.replaySkill = replaySkill;
    SkillSystem.attackForecast = attackForecast;
  }

  SkillEffects.registerEffects([
    {
      id: 'dash.undertow', family: 'dash', traits: ['base', 'surge'],
      name: 'Undertow', nameZh: '捕食回流',
      description: 'Dash creates an undertow that draws prey into its feeding line.',
      descriptionZh: '冲刺形成捕食回流，把航线附近的基础鱼牵入自身。',
      hooks: {
        'dash:update': function (event, effect) {
          var state = event.state;
          var skill = event.skill;
          if (!skill || !skill.active) return;
          var direction = skill.direction || { x: 0, y: 1 };
          var strength = 1 + Math.min(0.7, Math.max(0, effect.traitPotency - 2) * 0.12);
          (state.enemies || []).forEach(function (target) {
            if (target.kind !== 'growth' && target.kind !== 'letter') return;
            var dx = target.x - state.player.x;
            var dy = target.y - state.player.y;
            var behind = -(dx * direction.x + dy * direction.y);
            var side = Math.abs(dx * (-direction.y) + dy * direction.x);
            if (behind < -24 || behind > 155 || side > 72 + (target.radius || 0)) return;
            var pull = Utils.normalize(state.player.x - target.x, state.player.y - target.y);
            target.vx += pull.x * 520 * strength * state.dt;
            target.vy += pull.y * 520 * strength * state.dt;
          });
        }
      }
    },
    {
      id: 'dash.vector-bend', family: 'dash', traits: ['burst'],
      name: 'Vector Bend', nameZh: '折流',
      description: 'Redirect an active Dash once by spending part of its remaining duration.',
      descriptionZh: '冲刺中可折转一次当前航线，并支付部分剩余持续时间。',
      hooks: {
        'dash:redirected': function (event) { cue(event.state, event.state.player, label('BEND', '折流'), palette.gold || '#ffd36f'); }
      }
    },
    {
      id: 'shot.piercing-gene', family: 'shot', traits: ['bolt'],
      name: 'Piercing Gene', nameZh: '穿序弹',
      description: 'Gene bolts pierce additional targets, losing speed and weakening strength each time.',
      descriptionZh: '基因弹可贯穿额外目标，但每次贯穿都会衰减速度与削弱强度。',
      hooks: {
        [E.PROJECTILE_PREPARE]: function (event, effect) {
          if (event.id !== 'shot' || !event.bullet) return;
          event.bullet.piercesLeft = effect.traitPotency >= 3 ? 2 : 1;
        },
        [E.PROJECTILE_HIT]: function (event, effect) {
          var bullet = event.bullet;
          if (!bullet || (bullet.piercesLeft || 0) <= 0) return;
          bullet.piercesLeft -= 1;
          bullet.vx *= 0.88;
          bullet.vy *= 0.88;
          bullet.weaken = Math.max(0.02, (Number(bullet.weaken) || 0.1) * 0.78);
          event.consume = false;
          cue(event.state, event.target, label('PIERCE', '贯穿'), palette.mint || '#64f0b6');
        }
      }
    },
    {
      id: 'shot.interruptor', family: 'shot', traits: ['base', 'bite'],
      name: 'Interruptor', nameZh: '截断弹',
      description: 'Hits interrupt an enemy attack in progress and open a short punish window.',
      descriptionZh: '命中蓄力中的敌人时截断动作，制造短暂进攻窗口。',
      hooks: {
        [E.PROJECTILE_HIT]: function (event) {
          var target = event.target;
          if (!target || !target.attackState || target.attackState === 'idle') return;
          event.weaken = Math.min(0.82, (Number(event.weaken) || 0) + 0.1);
          resetAttack(target, 1.4);
          cue(event.state, target, label('INTERRUPT', '截断'), palette.orange || '#ff8a38');
        }
      }
    },
    {
      id: 'nova.implosion-heart', family: 'nova', traits: ['base', 'wave'],
      name: 'Implosion Heart', nameZh: '内爆核',
      description: 'Nova pulls nearby targets inward before releasing its outward pulse.',
      descriptionZh: '脉冲释放前先把范围内敌人拉向核心，再向外爆发。',
      hooks: {
        [E.AREA_PREPARE]: function (event) {
          if (event.id !== 'nova' || event.replay) return;
          entities(event.state).forEach(function (target) {
            var distance = Utils.dist(target, event.origin || event.state.player);
            if (distance > event.radius) return;
            var pull = Utils.normalize((event.origin || event.state.player).x - target.x, (event.origin || event.state.player).y - target.y);
            var amount = target.boss ? 35 : 70;
            target.x += pull.x * amount;
            target.y += pull.y * amount;
          });
        }
      }
    },
    {
      id: 'nova.double-beat', family: 'nova', traits: ['pulse', 'nova'],
      name: 'Double Beat', nameZh: '双重心跳',
      description: 'Nova follows its first pulse with a smaller delayed afterbeat.',
      descriptionZh: '首轮脉冲后延迟释放一轮较小的回拍。',
      hooks: {
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova' || !event.primary || event.replay) return;
          var radius = Number(event.radius) || 100;
          var weaken = Number(event.weaken) || 0.1;
          effect.schedule(0.58, function (state) {
            if (!window.NovaSkill || typeof NovaSkill.resolvePulse !== 'function') return;
            NovaSkill.resolvePulse(state, {
              origin: state.player,
              radius: radius * 0.72,
              weaken: weaken * 0.55,
              duration: Math.max(0.5, (Number(event.duration) || 1.4) * 0.55),
              primary: false,
              replay: true
            });
            if (window.ShotSkill) ShotSkill.burst(state, state.player.x, state.player.y, palette.pink || '#ff6fa8', 12);
          }, { cancelWhenInactive: false });
        }
      }
    },
    {
      id: 'guard.perfect-parry', family: 'guard', traits: ['base', 'guard'],
      name: 'Perfect Parry', nameZh: '完美格挡',
      description: 'Blocking during Guard\'s opening instant punishes the attacker and refunds cooldown.',
      descriptionZh: '护膜刚展开时挡住攻击会反制攻击者并返还冷却。',
      hooks: {
        [E.GUARD_ABSORBED]: function (event) {
          var guard = event.guard;
          var source = event.source;
          if (!guard || guard.age > 0.28 || !source) return;
          resetAttack(source, 1.8);
          if (window.SkillSystem && typeof SkillSystem.weakenTarget === 'function') SkillSystem.weakenTarget(event.state, 'parry', source, 0.15, 2);
          guard.cooldown = Math.max(0, (guard.cooldown || 0) - 2.4);
          cue(event.state, source, label('PARRY', '完美格挡'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'guard.unspent-ward', family: 'guard', traits: ['shield', 'shell', 'armor'],
      name: 'Unspent Ward', nameZh: '未耗护膜',
      description: 'An unused Guard recycles much of its remaining cooldown when it expires naturally.',
      descriptionZh: '护膜自然消散且未受击时，回收大部分未使用的防护能量。',
      hooks: {
        [E.SKILL_ENDED]: function (event) {
          if (event.id !== 'guard' || !event.natural || event.absorbed || !event.skill) return;
          event.skill.cooldown *= 0.45;
          cue(event.state, event.state.player, label('WARD RECYCLED', '护膜回收'), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'freeze.snap-freeze', family: 'freeze', traits: ['freeze'],
      name: 'Snap Freeze', nameZh: '瞬凝',
      description: 'The inner Freeze field instantly stops attacks already winding up.',
      descriptionZh: '冻结内圈会立刻截断敌人的蓄力、冲刺或脉冲。',
      hooks: {
        [E.STATUS_APPLIED]: function (event) {
          if (event.status !== 'frozen' || !event.target || event.distance > event.radius * 0.55) return;
          if (event.target.attackState && event.target.attackState !== 'idle') resetAttack(event.target, 1.6);
        }
      }
    },
    {
      id: 'freeze.cryostasis', family: 'freeze', traits: ['base', 'slow'],
      name: 'Cryostasis', nameZh: '冷藏',
      description: 'Frozen targets stop losing weakening and corrosion duration.',
      descriptionZh: '冻结期间暂停目标身上的削弱与侵蚀计时。',
      hooks: {
        'status:tick': function (event) {
          if (!event.target || !(event.target.frozen > 0)) return;
          event.pauseWeakness = true;
          event.pauseCorrode = true;
          event.pauseRecovery = true;
        }
      }
    },
    {
      id: 'scan.threat-forecast', family: 'scan', traits: ['scan'],
      name: 'Threat Forecast', nameZh: '威胁预测',
      description: 'Scan reveals attack destinations, true hit areas and time to impact.',
      descriptionZh: '扫描显示敌人攻击落点、实际命中范围与剩余时间。'
    },
    {
      id: 'scan.weakpoint-matrix', family: 'scan', traits: ['base'],
      name: 'Weakpoint Matrix', nameZh: '弱点矩阵',
      description: 'Scan primes a one-use weakpoint that amplifies the next weakening hit.',
      descriptionZh: '扫描建立一次性弱点矩阵，强化下一次有效削弱。',
      hooks: {
        [E.TARGET_REVEALED]: function (event) {
          if (event.target) event.target.weakpointReady = true;
        },
        [E.TARGET_WEAKEN]: function (event) {
          if (!event.target || !event.target.weakpointReady) return;
          if (event.sourceId !== 'shot' && event.sourceId !== 'nova' && event.sourceId !== 'corrode') return;
          event.amount = Math.min(0.82, (Number(event.amount) || 0) * 1.16);
          event.target.weakpointReady = false;
          cue(event.state, event.target, label('WEAKPOINT', '弱点'), palette.cyan || '#35d8ff');
        }
      }
    },
    {
      id: 'growth.feast-chain', family: 'growth', traits: ['feed', 'surge'],
      name: 'Feast Chain', nameZh: '连续捕食',
      description: 'Rapid empowered catches build a feeding chain with escalating growth gain.',
      descriptionZh: '成长强化期间连续吞噬会建立捕食连段，越连贯收益越高。',
      defaults: { stacks: 0, expiresAt: 0 },
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'before' || !event.empowered) return;
          var now = Number(event.state.time) || 0;
          if (now > (effect.state.expiresAt || 0)) effect.state.stacks = 0;
          var stacks = Math.min(4, Math.max(0, Number(effect.state.stacks) || 0));
          event.amount *= 1 + stacks * 0.1;
          effect.state.stacks = Math.min(4, stacks + 1);
          effect.state.expiresAt = now + 2.2;
        },
        [E.PLAYER_DAMAGED]: function (_event, effect) {
          effect.state.stacks = 0;
          effect.state.expiresAt = 0;
        },
        [E.UPDATE]: function (event, effect) {
          if ((Number(event.state.time) || 0) > (effect.state.expiresAt || 0)) effect.state.stacks = 0;
        }
      }
    },
    {
      id: 'growth.metabolic-cycle', family: 'growth', traits: ['base', 'vitality'],
      name: 'Metabolic Cycle', nameZh: '代谢循环',
      description: 'Each empowered catch advances the powered skill with the longest cooldown.',
      descriptionZh: '每次消耗成长强化都会加速另一个仍由当前基因供能、且冷却最滞后的技能。',
      hooks: {
        [E.GROWTH_GAIN]: function (event, effect) {
          if (event.phase !== 'after' || !event.consumedCharge) return;
          var slots = event.state.player.activeSlots || [];
          var best = null;
          slots.forEach(function (id) {
            if (!id || id === 'growth' || !event.state.skills[id] || !SkillEffects.isPowered(event.state, id)) return;
            var skill = event.state.skills[id];
            if (!best || (skill.cooldown || 0) > (best.cooldown || 0)) best = skill;
          });
          if (!best) return;
          var refund = effect.traitPotency >= 3 ? 0.65 : 0.45;
          best.cooldown = Math.max(0, (best.cooldown || 0) - refund);
        }
      }
    },
    {
      id: 'splice.template-copy', family: 'splice', traits: ['base', 'splice', 'copy'],
      name: 'Template Copy', nameZh: '模板复制',
      description: 'After splicing, duplicate the last moved letter through normal queue pressure.',
      descriptionZh: '剪接完成后复制最后移动的字母，并让副本照常承受队列压力。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.wave1Handled || event.phase !== 'splice:moved' || event.templateCopied || !event.moved || !event.moved.length) return;
          var letter = event.moved[event.moved.length - 1];
          if (event.copyLetter && event.copyLetter(letter)) event.templateCopied = true;
        }
      }
    },
    {
      id: 'splice.clean-cut', family: 'splice', traits: ['cut'],
      name: 'Clean Cut', nameZh: '精准剪除',
      description: 'Remove the first unlocked factor before Splice and refund cooldown when the build improves.',
      descriptionZh: '先剪除最前未锁定字母，再执行剪接；若倍率提高则返还冷却。',
      defaults: { cutPerformed: false },
      hooks: {
        [E.GENOME_CHANGED]: function (event, effect) {
          if (event.wave1Handled) return;
          if (event.phase === 'splice:prepare') {
            effect.state.cutPerformed = false;
            var genome = event.genome;
            var unlocked = 0;
            if (genome && genome.letters) genome.letters.forEach(function (_letter, index) {
              if (!GenomeSystem.isLockedIndex(genome, index)) unlocked += 1;
            });
            if (unlocked > 1 && event.removeFirstUnlocked) {
              var removed = event.removeFirstUnlocked();
              effect.state.cutPerformed = !!(removed && removed.length);
              event.cutResult = { removed: removed || [] };
            }
          } else if (event.phase === 'splice:moved' && effect.state.cutPerformed && event.afterLog > event.beforeLog + 0.000001) {
            event.cooldownFactor = Math.min(Number(event.cooldownFactor) || 1, 0.7);
          }
        }
      }
    },
    {
      id: 'echo.skill-refrain', family: 'echo', traits: ['repeat', 'echo'],
      name: 'Skill Refrain', nameZh: '技能复唱',
      description: 'Echo records the next skill and replays it once at reduced potency after a short delay.',
      descriptionZh: '回响记录下一次其他技能，并在短暂延迟后以较低效力免费复放。',
      defaults: { ready: false },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'echo') {
            effect.state.ready = true;
            return;
          }
          if (!effect.state.ready || !event.id || event.id === 'echo' || event.redirected || event.replay || !event.skill) return;
          effect.state.ready = false;
          var snapshot = replaySnapshot(event.state, event);
          effect.schedule(0.75, function (state) {
            replaySkill(state, snapshot);
          }, { cancelWhenInactive: false });
          cue(event.state, event.state.player, label('REFRAIN ARMED', '复唱就绪'), palette.pink || '#ff6fa8');
        },
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id === 'echo') effect.state.ready = false;
        }
      }
    },
    {
      id: 'echo.harvest-echo', family: 'echo', traits: ['base', 'word'],
      name: 'Harvest Echo', nameZh: '捕食回声',
      description: 'Echo records the first catch and replays part of its reward moments later.',
      descriptionZh: '回响记录本轮首次吞噬，并在片刻后重放一部分奖励。',
      defaults: { ready: false },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'echo') effect.state.ready = true;
        },
        [E.ENEMY_CONSUMED]: function (event, effect) {
          if (!effect.state.ready || !event.state.skills.echo || !event.state.skills.echo.active || event.isBoss || !event.enemy) return;
          effect.state.ready = false;
          var letter = event.letter;
          var gain = Number(event.gain) || 0;
          effect.schedule(0.8, function (state) {
            if (event.dropType === 'growth' && gain > 0) {
              state.growthPower += gain * 0.4;
              cue(state, state.player, label('HARVEST ECHO +', '捕食回声 +') + (gain * 0.4).toFixed(1), palette.gold || '#ffd36f');
            } else if (letter && window.GenomeSystem && typeof GenomeSystem.addLetter === 'function') {
              GenomeSystem.addLetter(state, letter, 'echo-replay');
            }
          }, { cancelWhenInactive: false });
        },
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id === 'echo') effect.state.ready = false;
        }
      }
    },
    {
      id: 'corrode.power-drain', family: 'corrode', traits: ['corrode', 'drain'],
      name: 'Power Drain', nameZh: '能量虹吸',
      description: 'Convert a capped portion of stripped target power into growth reserve.',
      descriptionZh: '把本次剥离战力的一小部分转成成长储备，并按层级封顶。',
      hooks: {
        [E.TARGET_WEAKENED]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target || !(event.powerRemoved > 0)) return;
          var cap = layerGrowthValue(event.state) * 3;
          var gain = Math.min((Number(event.powerRemoved) || 0) * 0.08, cap);
          if (gain <= 0) return;
          event.state.growthPower += gain;
          cue(event.state, event.state.player, label('DRAIN +', '虹吸 +') + gain.toFixed(1), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'corrode.contagion', family: 'corrode', traits: ['base', 'poison', 'decay'],
      name: 'Contagion', nameZh: '侵蚀传染',
      description: 'Consuming a corroded target transfers part of its remaining corrosion nearby.',
      descriptionZh: '被侵蚀目标遭吞噬时，把剩余侵蚀传播给最近的新目标。',
      hooks: {
        [E.ENEMY_CONSUMED]: function (event) {
          var source = event.enemy;
          if (!source || event.isBoss || !(source.corrodeTimer > 0) || !(source.corrodeFactor > 0)) return;
          var factor = source.corrodeFactor * 0.55;
          var timer = source.corrodeTimer * 0.65;
          var nearest = null;
          var nearestDistance = 180;
          (event.state.enemies || []).forEach(function (target) {
            if (!target || target === source || target.consumed || target.corrodeFactor >= factor) return;
            var distance = Utils.dist(source, target);
            if (distance > nearestDistance) return;
            nearest = target;
            nearestDistance = distance;
          });
          if (!nearest) return;
          var previous = nearest.corrodeFactor || 0;
          var delta = Math.max(0, factor - previous);
          nearest.corrodeFactor = Math.max(previous, factor);
          nearest.corrodeTimer = Math.max(nearest.corrodeTimer || 0, timer);
          if (delta > 0) nearest.power = Math.max(0.1, nearest.power * (1 - delta));
          nearest.hurt = Math.max(nearest.hurt || 0, 0.45);
          cue(event.state, nearest, label('CONTAGION', '侵蚀传染'), palette.pink || '#ff6fa8');
        }
      }
    }
  ]);
})();
