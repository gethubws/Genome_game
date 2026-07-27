(function () {
  if (!window.SkillEffects) return;

  var E = SkillEffects.EVENTS;
  var palette = (window.GameConfig && GameConfig.palette) || {};

  function label(en, zh) {
    return window.I18n && I18n.locale && I18n.locale() === 'zh-CN' ? zh : en;
  }

  function cue(state, target, text, color) {
    if (!state || !state.floatingTexts || !target) return;
    state.floatingTexts.push({
      x: target.x,
      y: target.y - (target.radius || 12) - 18,
      text: text,
      color: color || palette.cyan || '#65e5ff',
      life: 0.85,
      maxLife: 0.85
    });
  }

  function targets(state) {
    var list = (state.enemies || []).filter(function (target) { return target && !target.consumed; });
    if (state.boss && state.boss.active && !state.boss.active.consumed && list.indexOf(state.boss.active) === -1) list.push(state.boss.active);
    return list;
  }

  function alive(state, target) {
    if (!target || target.consumed) return false;
    if (state.boss && state.boss.active === target) return true;
    return (state.enemies || []).indexOf(target) !== -1;
  }

  function preview(state) {
    if (window.WordSystem && typeof WordSystem.preview === 'function') WordSystem.preview(state);
  }

  function occurrenceKey(entry) {
    return entry && entry.word ? entry.word.text + '@' + entry.index : '';
  }

  function occurrenceSignature(state) {
    return ((state.words && state.words.potentialOccurrences) || []).map(occurrenceKey).join('|');
  }

  function occurrenceCounts(occurrences) {
    var counts = Object.create(null);
    (occurrences || []).forEach(function (entry) {
      var text = entry && entry.word && entry.word.text;
      if (!text) return;
      counts[text] = (counts[text] || 0) + 1;
    });
    return counts;
  }

  function newOccurrenceCount(beforeCounts, occurrences) {
    var afterCounts = occurrenceCounts(occurrences);
    return Object.keys(afterCounts).reduce(function (total, text) {
      return total + Math.max(0, afterCounts[text] - (beforeCounts[text] || 0));
    }, 0);
  }

  function expressedOccurrences(state) {
    var words = state.words || {};
    return words.occurrences && words.occurrences.length ? words.occurrences : (words.potentialOccurrences || []);
  }

  function overlapPairs(occurrences) {
    var intervals = (occurrences || []).map(function (entry) {
      var start = Number(entry && entry.index);
      var end = Number(entry && entry.end);
      if (!isFinite(start)) return null;
      if (!isFinite(end) && entry && entry.word) end = start + entry.word.text.length;
      return isFinite(end) && end > start ? { start: start, end: end } : null;
    }).filter(Boolean).sort(function (a, b) {
      return a.start === b.start ? a.end - b.end : a.start - b.start;
    });
    var ends = [];
    var count = 0;
    function pushEnd(value) {
      var index = ends.length;
      ends.push(value);
      while (index > 0) {
        var parent = Math.floor((index - 1) / 2);
        if (ends[parent] <= ends[index]) break;
        var temp = ends[parent];
        ends[parent] = ends[index];
        ends[index] = temp;
        index = parent;
      }
    }
    function popEnd() {
      var last = ends.pop();
      if (!ends.length) return;
      ends[0] = last;
      var index = 0;
      while (true) {
        var left = index * 2 + 1;
        var right = left + 1;
        var smallest = index;
        if (left < ends.length && ends[left] < ends[smallest]) smallest = left;
        if (right < ends.length && ends[right] < ends[smallest]) smallest = right;
        if (smallest === index) break;
        var temp = ends[index];
        ends[index] = ends[smallest];
        ends[smallest] = temp;
        index = smallest;
      }
    }
    intervals.forEach(function (interval) {
      while (ends.length && ends[0] <= interval.start) popEnd();
      count += ends.length;
      pushEnd(interval.end);
    });
    return count;
  }

  function strongestWord(occurrences) {
    var best = null;
    (occurrences || []).forEach(function (entry) {
      var word = entry && entry.word;
      if (!word) return;
      if (!best || (word.mult || 1) > (best.mult || 1) ||
          ((word.mult || 1) === (best.mult || 1) && word.text.length > best.text.length)) best = word;
    });
    return best;
  }

  function unlockedIndices(genome) {
    var result = [];
    if (!genome || !genome.letters) return result;
    genome.letters.forEach(function (_letter, index) {
      if (!window.GenomeSystem || !GenomeSystem.isLockedIndex || !GenomeSystem.isLockedIndex(genome, index)) result.push(index);
    });
    return result;
  }

  function swapLetters(genome, a, b) {
    if (!genome || a === b || a < 0 || b < 0 || a >= genome.letters.length || b >= genome.letters.length) return false;
    var temp = genome.letters[a];
    genome.letters[a] = genome.letters[b];
    genome.letters[b] = temp;
    return true;
  }

  function bestUnlockedSwap(state) {
    var genome = state.genome;
    var indices = unlockedIndices(genome);
    if (indices.length < 2) return null;
    var original = genome.letters.slice();
    var bestLetters = original.slice();
    var originalLog = Number(state.words && state.words.potentialLogMultiplier) || 0;
    var bestLog = originalLog;
    for (var i = 0; i < indices.length - 1; i += 1) {
      for (var j = i + 1; j < Math.min(indices.length, i + 5); j += 1) {
        genome.letters = original.slice();
        swapLetters(genome, indices[i], indices[j]);
        preview(state);
        var candidate = Number(state.words.potentialLogMultiplier) || 0;
        if (candidate > bestLog + 0.000001) {
          bestLog = candidate;
          bestLetters = genome.letters.slice();
        }
      }
    }
    genome.letters = bestLetters;
    preview(state);
    return { log: bestLog, changed: bestLog > originalLog + 0.000001 && bestLetters.join('') !== original.join('') };
  }

  function nearestOther(state, source, radius, test) {
    var best = null;
    var bestDistance = radius;
    targets(state).forEach(function (target) {
      if (target === source || (test && !test(target))) return;
      var distance = Utils.dist(source, target);
      if (distance > bestDistance) return;
      best = target;
      bestDistance = distance;
    });
    return best;
  }

  function resetAttack(target, cooldown) {
    if (!target) return;
    target.attackState = 'idle';
    target.attackAge = 0;
    target.attackCooldown = Math.max(Number(target.attackCooldown) || 0, cooldown || 0);
    target.pulseHit = false;
    target.chargeBoost = 1;
    target.chargeScale = 1;
  }

  SkillEffects.registerEffects([
    {
      id: 'splice.join-lock', family: 'splice', traits: ['join-lock', 'join'],
      priority: 50,
      name: 'Join Lock', nameZh: '接合锁',
      description: 'A productive Splice locks the longest newly stabilized word block. You still obey the normal lock limit.',
      descriptionZh: '有效剪接会锁定当前最长的稳定单词区块，但仍受正常锁定数量上限约束。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.phase !== 'splice:moved' || event.afterLog <= event.beforeLog || !window.GenomeSystem || !GenomeSystem.lockCurrentWordBlock) return;
          var block = GenomeSystem.lockCurrentWordBlock(event.state);
          if (block) cue(event.state, event.state.player, label('JOIN LOCK ' + block.word.toUpperCase(), '接合锁 ' + block.word.toUpperCase()), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'splice.reverse-transcript', family: 'splice', trait: 'reverse-transcript',
      priority: 10,
      name: 'Reverse Transcript', nameZh: '逆向转录',
      description: 'The factors moved by Splice are written to the tail in reverse order, opening different overlap patterns.',
      descriptionZh: '剪接搬运的因子会以逆序写入队尾，从而形成不同的重叠组合。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.phase !== 'splice:moved' || !event.moved || event.moved.length < 2) return;
          var genome = event.genome;
          var start = Math.max(0, genome.letters.length - event.moved.length);
          var suffix = genome.letters.slice(start).reverse();
          genome.letters.splice.apply(genome.letters, [start, suffix.length].concat(suffix));
          preview(event.state);
          event.afterLog = Number(event.state.words.potentialLogMultiplier) || event.afterLog;
          cue(event.state, event.state.player, label('REVERSE', '逆向转录'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'splice.site-swap', family: 'splice', trait: 'site-swap',
      priority: 20,
      name: 'Site Swap', nameZh: '位点交换',
      description: 'After Splice, swap the outermost unlocked factors when that creates a different live expression.',
      descriptionZh: '剪接后交换最外侧的两个未锁定位点，让当前表达获得一次新的排列机会。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.phase !== 'splice:moved') return;
          var indices = unlockedIndices(event.genome);
          if (indices.length < 2) return;
          var beforeLetters = event.genome.letters.slice();
          var beforeSignature = occurrenceSignature(event.state);
          if (!swapLetters(event.genome, indices[0], indices[indices.length - 1])) return;
          preview(event.state);
          if (occurrenceSignature(event.state) === beforeSignature) {
            event.genome.letters = beforeLetters;
            preview(event.state);
            return;
          }
          event.afterLog = Number(event.state.words.potentialLogMultiplier) || event.afterLog;
          cue(event.state, event.state.player, label('SITE SWAP', '位点交换'), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'splice.directed-mutation', family: 'splice', trait: 'directed-mutation',
      priority: 40,
      name: 'Directed Mutation', nameZh: '定向突变',
      description: 'If the first rearrangement fails to improve expression, test a small set of unlocked swaps and keep the best one.',
      descriptionZh: '若首次重排没有改善表达，则尝试少量未锁定位点交换，并保留其中最优结果。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.phase !== 'splice:moved' || event.afterLog > event.beforeLog + 0.000001) return;
          var before = event.genome.letters.join('');
          var result = bestUnlockedSwap(event.state);
          var after = event.genome.letters.join('');
          event.afterLog = Number(event.state.words.potentialLogMultiplier) || event.afterLog;
          if (result && result.changed && after !== before) cue(event.state, event.state.player, label('DIRECTED', '定向突变'), palette.mint || '#64f0b6');
        }
      }
    },
    {
      id: 'splice.salvage-buffer', family: 'splice', trait: 'salvage-buffer',
      name: 'Salvage Buffer', nameZh: '抢救缓冲',
      description: 'When a hit would tear genome factors away, limit the rupture and restore one displaced factor. Has an internal cooldown.',
      descriptionZh: '受击即将撕裂基因因子时限制损失，并抢救回一个被挤出的因子；该效果有独立冷却。',
      defaults: { readyAt: 0, armed: false },
      hooks: {
        [E.PLAYER_DAMAGE]: function (event, effect) {
          effect.state.armed = false;
          if (event.cancelled) return;
          var now = Number(event.state.time) || 0;
          if (now < (effect.state.readyAt || 0) || event.state.growthPower > 0 || !event.state.genome.letters.length) return;
          event.amount = Math.min(Number(event.amount) || 0, 1.05);
          effect.state.armed = true;
        },
        [E.PLAYER_DAMAGED]: function (event, effect) {
          if (!effect.state.armed) return;
          effect.state.armed = false;
          var removed = event.removedLetters || [];
          if (!removed.length || !window.GenomeSystem || !GenomeSystem.addLetter) return;
          GenomeSystem.addLetter(event.state, removed[removed.length - 1], 'salvage-buffer');
          effect.state.readyAt = (Number(event.state.time) || 0) + Math.max(8, 13 - effect.traitPotency);
          cue(event.state, event.state.player, label('SALVAGED ' + removed[removed.length - 1].toUpperCase(), '抢救 ' + removed[removed.length - 1].toUpperCase()), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'splice.overlap-catalyst', family: 'splice', trait: 'overlap-catalyst',
      priority: 60,
      name: 'Overlap Catalyst', nameZh: '重叠催化',
      description: 'Creating additional overlapping occurrences grants a short combat-power surge proportional to the new overlaps.',
      descriptionZh: '剪接若制造出更多重叠单词，会按新增重叠数量获得短暂战斗力增幅。',
      defaults: { beforeOverlaps: 0, bonusLog: 0, until: 0 },
      hooks: {
        [E.GENOME_CHANGED]: function (event, effect) {
          if (event.phase === 'splice:prepare') {
            effect.state.beforeOverlaps = overlapPairs(event.state.words.potentialOccurrences || []);
            return;
          }
          if (event.phase !== 'splice:moved') return;
          var currentOverlaps = overlapPairs(event.state.words.potentialOccurrences || []);
          var added = Math.max(0, currentOverlaps - (effect.state.beforeOverlaps || 0));
          if (!added) return;
          effect.state.bonusLog = Math.log(1 + Math.min(0.55, added * 0.08));
          effect.state.until = (Number(event.state.time) || 0) + 5;
          cue(event.state, event.state.player, label('OVERLAP +' + added, '重叠 +' + added), palette.pink || '#ff6fa8');
        },
        [E.POWER_LOG_MULTIPLIER]: function (event, effect) {
          if ((Number(event.state.time) || 0) < (effect.state.until || 0)) event.log += Number(effect.state.bonusLog) || 0;
        }
      }
    },
    {
      id: 'splice.tail-graft', family: 'splice', trait: 'tail-graft',
      priority: 30,
      name: 'Tail Graft', nameZh: '尾端嫁接',
      description: 'Graft the first moved factor onto the tail once more; forming a new word partially refunds Splice.',
      descriptionZh: '把本次最先搬运的因子再次嫁接到队尾；若因此形成新词，则返还部分剪接冷却。',
      hooks: {
        [E.GENOME_CHANGED]: function (event) {
          if (event.phase !== 'splice:moved' || !event.moved || !event.moved.length || !event.copyLetter) return;
          var before = occurrenceCounts(event.state.words.potentialOccurrences || []);
          if (!event.copyLetter(event.moved[0])) return;
          preview(event.state);
          var added = newOccurrenceCount(before, event.state.words.potentialOccurrences || []);
          if (added > 0) event.cooldownFactor = Math.min(Number(event.cooldownFactor) || 1, 0.82);
          event.afterLog = Number(event.state.words.potentialLogMultiplier) || event.afterLog;
          cue(event.state, event.state.player, label('TAIL GRAFT', '尾端嫁接'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'splice.cross-over', family: 'splice', trait: 'cross-over',
      priority: 70,
      name: 'Cross-over', nameZh: '交叉互换',
      description: 'A multi-factor Splice primes the next different skill, advancing its cooldown when the crossover is expressed.',
      descriptionZh: '一次搬运多个因子的剪接会为下一个不同技能蓄能，在其释放后推进冷却。',
      defaults: { primed: false },
      hooks: {
        [E.GENOME_CHANGED]: function (event, effect) {
          if (event.phase !== 'splice:moved' || !event.moved || event.moved.length < 2) return;
          effect.state.primed = true;
          cue(event.state, event.state.player, label('CROSS-OVER', '交叉互换'), palette.mint || '#64f0b6');
        },
        [E.SKILL_STARTED]: function (event, effect) {
          if (!effect.state.primed || !event.id || event.id === 'splice' || !event.skill || event.redirected || event.replay) return;
          effect.state.primed = false;
          event.skill.cooldown = Math.max(0, (Number(event.skill.cooldown) || 0) - 1.25);
          cue(event.state, event.state.player, label('CROSS-OVER REFUND', '互换返还'), palette.mint || '#64f0b6');
        }
      }
    },
    {
      id: 'echo.lost-word-memory', family: 'echo', trait: 'lost-word-memory',
      priority: 100,
      name: 'Lost Word Memory', nameZh: '失词记忆',
      description: 'Remember the strongest word lost during a genome change. The next Echo borrows part of that vanished expression.',
      descriptionZh: '记住基因变化中消失的最强单词；下一次回响会借用这段已经消失的表达。',
      defaults: { beforeWords: [], memory: null },
      hooks: {
        [E.GENOME_CHANGED]: function (event, effect) {
          if (event.phase === 'splice:prepare') {
            effect.state.beforeWords = (event.state.words.potentialOccurrences || []).map(function (entry) { return entry.word; });
            return;
          }
          if (event.phase !== 'splice:moved') return;
          var current = Object.create(null);
          (event.state.words.potentialOccurrences || []).forEach(function (entry) { current[entry.word.text] = true; });
          var lost = strongestWord((effect.state.beforeWords || []).filter(function (word) { return word && !current[word.text]; }).map(function (word) { return { word: word }; }));
          if (lost) effect.state.memory = { text: lost.text, mult: lost.mult || 1 };
        },
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'echo' || !event.skill || !effect.state.memory) return;
          var memory = effect.state.memory;
          var borrow = 1 + Math.min(0.32, Math.max(0.08, ((Number(memory.mult) || 1) - 1) * 0.35));
          event.skill.multiplier *= borrow;
          event.skill.boost = event.skill.multiplier;
          event.skill.duration += 0.9;
          effect.state.memory = null;
          cue(event.state, event.state.player, label('MEMORY ' + memory.text.toUpperCase(), '失词记忆 ' + memory.text.toUpperCase()), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'echo.duplicate-chorus', family: 'echo', trait: 'duplicate-chorus',
      name: 'Duplicate Chorus', nameZh: '复词合唱',
      description: 'Repeated occurrences of the echoed word sing together, strengthening Echo without suppressing duplicate words.',
      descriptionZh: '被回响单词的重复出现会共同合唱，在不限制重复词的前提下进一步增强回响。',
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id !== 'echo' || !event.skill || !event.skill.word) return;
          var count = 0;
          expressedOccurrences(event.state).forEach(function (entry) {
            if (entry.word && entry.word.text === event.skill.word) count += 1;
          });
          var duplicates = Math.max(0, count - 1);
          if (!duplicates) return;
          var bonus = 1 + Math.min(0.5, duplicates * (0.1 + Math.min(0.04, effect.traitPotency * 0.008)));
          event.skill.multiplier *= bonus;
          event.skill.boost = event.skill.multiplier;
          cue(event.state, event.state.player, label('CHORUS x' + count, '合唱 x' + count), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'echo.overlap-harmony', family: 'echo', trait: 'overlap-harmony',
      name: 'Overlap Harmony', nameZh: '重叠和声',
      description: 'Every pair of overlapping words lengthens Echo, rewarding dense strings such as WAREAR.',
      descriptionZh: '每一对互相重叠的单词都会延长回响，专门奖励 WAREAR 这类高密度序列。',
      hooks: {
        [E.SKILL_STARTED]: function (event) {
          if (event.id !== 'echo' || !event.skill) return;
          var overlaps = overlapPairs(expressedOccurrences(event.state));
          if (!overlaps) return;
          event.skill.duration += Math.min(3.2, overlaps * 0.22);
          cue(event.state, event.state.player, label('HARMONY +' + overlaps, '和声 +' + overlaps), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'echo.call-response', family: 'echo', trait: 'call-response',
      name: 'Call and Response', nameZh: '呼应句',
      description: 'While Echo is active, alternating between different skill families extends it and refunds the responding skill.',
      descriptionZh: '回响期间交替释放不同技能家族，会延长回响并返还作为回应的技能冷却。',
      defaults: { lastId: null },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (event.id === 'echo') {
            effect.state.lastId = null;
            return;
          }
          var echo = event.state.skills && event.state.skills.echo;
          if (!echo || !echo.active || !event.id) return;
          if (effect.state.lastId && effect.state.lastId !== event.id) {
            echo.duration += 0.45;
            if (event.skill) event.skill.cooldown = Math.max(0, (Number(event.skill.cooldown) || 0) - 0.45);
            cue(event.state, event.state.player, label('RESPONSE', '技能呼应'), palette.pink || '#ff6fa8');
          }
          effect.state.lastId = event.id;
        },
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id === 'echo') effect.state.lastId = null;
        }
      }
    },
    {
      id: 'echo.delayed-refrain', family: 'echo', trait: 'delayed-refrain',
      name: 'Delayed Refrain', nameZh: '延迟副歌',
      description: 'When Echo ends naturally, a quieter afterglow preserves part of its combat multiplier for a few seconds.',
      descriptionZh: '回响自然结束后，较弱的副歌会在数秒内保留一部分战斗力倍率。',
      defaults: { logBonus: 0, until: 0 },
      hooks: {
        [E.SKILL_ENDED]: function (event, effect) {
          if (event.id !== 'echo' || !event.natural || !event.skill) return;
          var source = Math.max(1, Number(event.skill.multiplier) || 1);
          effect.state.logBonus = Math.log(1 + (source - 1) * 0.24);
          effect.state.until = (Number(event.state.time) || 0) + 3.2;
          cue(event.state, event.state.player, label('AFTER-REFRAIN', '延迟副歌'), palette.pink || '#ff6fa8');
        },
        [E.POWER_LOG_MULTIPLIER]: function (event, effect) {
          if ((Number(event.state.time) || 0) < (effect.state.until || 0)) event.log += Number(effect.state.logBonus) || 0;
        }
      }
    },
    {
      id: 'echo.rebound-echo', family: 'echo', trait: 'rebound-echo',
      name: 'Rebound Echo', nameZh: '回弹回响',
      description: 'Replayed projectiles rebound toward a second target, while replayed area skills gain a wider final ring.',
      descriptionZh: '被复放的投射物会回弹到第二目标；被复放的范围技能则获得更宽的收尾波。',
      defaults: { novaAt: -1, freezeAt: -1, resolvingNova: false, resolvingFreeze: false },
      hooks: {
        [E.PROJECTILE_HIT]: function (event) {
          var bullet = event.bullet;
          if (!bullet || !bullet.replay || bullet.rebounded) return;
          var target = nearestOther(event.state, event.target, 260, function (candidate) {
            return !bullet.hitIds || !bullet.hitIds[candidate.id];
          });
          if (!target) return;
          var direction = Utils.normalize(target.x - bullet.x, target.y - bullet.y);
          var speed = Math.max(180, Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy));
          bullet.vx = direction.x * speed;
          bullet.vy = direction.y * speed;
          bullet.rebounded = true;
          event.consume = false;
          cue(event.state, target, label('REBOUND', '回弹'), palette.pink || '#ff6fa8');
        },
        [E.AREA_RESOLVED]: function (event, effect) {
          if (event.id !== 'nova' || !event.replay || effect.state.resolvingNova || !(Number(event.radius) > 0)) return;
          var stamp = Number(event.state.time) || 0;
          if (effect.state.novaAt === stamp || !window.NovaSkill || typeof NovaSkill.resolvePulse !== 'function') return;
          effect.state.novaAt = stamp;
          var origin = event.origin || event.state.player;
          var radius = Number(event.radius) * 1.28;
          var weaken = Math.max(0.01, (Number(event.weaken) || 0.08) * 0.42);
          var duration = Math.max(0.35, (Number(event.duration) || 1) * 0.62);
          effect.state.resolvingNova = true;
          try {
            NovaSkill.resolvePulse(event.state, {
              sourceId: 'nova',
              origin: origin,
              radius: radius,
              weaken: weaken,
              duration: duration,
              replay: true,
              primary: false
            });
          } finally {
            effect.state.resolvingNova = false;
          }
          if (event.state.shockwaves) event.state.shockwaves.push({ x: origin.x, y: origin.y, age: 0, life: 0.62, radius: radius, color: palette.pink || '#ff6fa8' });
          cue(event.state, origin, label('FINAL REBOUND', '回弹收尾'), palette.pink || '#ff6fa8');
        },
        [E.STATUS_APPLIED]: function (event, effect) {
          if (event.status !== 'frozen' || !event.replay || effect.state.resolvingFreeze || !(Number(event.radius) > 0)) return;
          var stamp = Number(event.state.time) || 0;
          if (effect.state.freezeAt === stamp || !window.FreezeSkill || typeof FreezeSkill.applyField !== 'function') return;
          effect.state.freezeAt = stamp;
          var radius = Number(event.radius) * 1.24;
          var duration = Math.max(0.3, (Number(event.duration) || 1) * 0.46);
          effect.state.resolvingFreeze = true;
          try {
            FreezeSkill.applyField(event.state, radius, duration, { replay: true });
          } finally {
            effect.state.resolvingFreeze = false;
          }
          if (event.state.shockwaves) event.state.shockwaves.push({
            x: event.state.player.x,
            y: event.state.player.y,
            age: 0,
            life: 0.58,
            radius: radius,
            color: palette.cyan || '#65e5ff'
          });
          cue(event.state, event.state.player, label('FROST REBOUND', '霜冻回弹'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'echo.memory-sequence', family: 'echo', trait: 'memory-sequence',
      name: 'Memory Sequence', nameZh: '序列记忆',
      description: 'Alternating the other two equipped skills through a three-cast A-B-A sequence advances Echo cooldown and extends an active Echo.',
      descriptionZh: '让另外两个已装备技能完成一次三段交替（A-B-A），会推进回响冷却，并延长正在持续的回响。',
      defaults: { sequence: [] },
      hooks: {
        [E.SKILL_STARTED]: function (event, effect) {
          if (!event.id || event.id === 'echo' || event.redirected || event.replay) return;
          var sequence = effect.state.sequence || (effect.state.sequence = []);
          if (sequence[sequence.length - 1] === event.id) return;
          sequence.push(event.id);
          if (sequence.length > 3) sequence.shift();
          if (sequence.length < 3 || new Set(sequence).size !== 2 || sequence[0] !== sequence[2]) return;
          sequence.length = 0;
          var echo = event.state.skills && event.state.skills.echo;
          if (!echo) return;
          echo.cooldown = Math.max(0, (Number(echo.cooldown) || 0) - 2.2);
          if (echo.active) echo.duration += 0.8;
          cue(event.state, event.state.player, label('SEQUENCE RECALLED', '序列回想'), palette.cyan || '#65e5ff');
        }
      }
    },
    {
      id: 'echo.spoken-command', family: 'echo', trait: 'spoken-command',
      name: 'Spoken Command', nameZh: '口述指令',
      description: 'If the genome tail ends in a word belonging to another powered skill, Echo immediately readies that commanded skill.',
      descriptionZh: '若基因尾部以另一个仍由当前基因供能的技能单词收尾，回响会立刻准备好该“指令技能”。',
      hooks: {
        [E.SKILL_STARTED]: function (event) {
          if (event.id !== 'echo') return;
          var length = event.state.genome.letters.length;
          var ending = (event.state.words.potentialOccurrences || []).filter(function (entry) {
            return entry.end === length && entry.word && entry.word.family && entry.word.family !== 'echo' && SkillEffects.isPowered(event.state, entry.word.family);
          }).sort(function (a, b) { return b.word.text.length - a.word.text.length; })[0];
          if (!ending) return;
          var skill = event.state.skills[ending.word.family];
          if (!skill) return;
          skill.cooldown = 0;
          cue(event.state, event.state.player, label('COMMAND ' + ending.word.text.toUpperCase(), '指令 ' + ending.word.text.toUpperCase()), palette.gold || '#ffd36f');
        }
      }
    },
    {
      id: 'corrode.decay-clock', family: 'corrode', traits: ['decay-clock', 'decay'],
      name: 'Decay Clock', nameZh: '衰变时钟',
      description: 'Corrode starts four measured decay ticks that shave a small fraction of remaining power over time.',
      descriptionZh: '侵蚀会启动四次有节奏的衰变刻度，持续削去目标少量剩余战斗力。',
      cleanup: function (state) {
        targets(state).forEach(function (target) {
          target.decayClockTicks = 0;
          target.decayClockNext = 0;
        });
      },
      hooks: {
        [E.TARGET_WEAKENED]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target) return;
          event.target.decayClockTicks = Math.max(event.target.decayClockTicks || 0, 4);
          event.target.decayClockNext = (Number(event.state.time) || 0) + 0.72;
        },
        [E.UPDATE]: function (event) {
          var now = Number(event.state.time) || 0;
          targets(event.state).forEach(function (target) {
            if (!(target.decayClockTicks > 0) || now < (target.decayClockNext || 0)) return;
            var fraction = target.boss ? 0.012 : 0.025;
            var before = Math.max(0.1, Number(target.power) || 0.1);
            target.power = Math.max(0.1, before * (1 - fraction));
            target.hurt = Math.max(target.hurt || 0, 0.28);
            target.decayClockTicks -= 1;
            target.decayClockNext = now + 0.72;
            cue(event.state, target, label('DECAY', '衰变'), palette.pink || '#ff6fa8');
          });
        }
      }
    },
    {
      id: 'corrode.rust-accumulation', family: 'corrode', traits: ['rust-accumulation', 'rust'],
      name: 'Rust Accumulation', nameZh: '锈蚀累积',
      description: 'Repeated Corrode casts on the same target build rust stacks, increasing the next application before the stacks fade.',
      descriptionZh: '反复侵蚀同一目标会累积锈层，在锈层消退前逐次强化下一次侵蚀。',
      hooks: {
        [E.TARGET_WEAKEN]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target) return;
          var now = Number(event.state.time) || 0;
          if (now > (event.target.rustUntil || 0)) event.target.rustStacks = 0;
          var stacks = Math.min(4, Number(event.target.rustStacks) || 0);
          event.amount = (Number(event.amount) || 0) + stacks * (event.target.boss ? 0.018 : 0.03);
          event.target.rustStacks = Math.min(4, stacks + 1);
          event.target.rustUntil = now + 7;
          if (stacks) cue(event.state, event.target, label('RUST x' + (stacks + 1), '锈层 x' + (stacks + 1)), '#c9a06c');
        }
      }
    },
    {
      id: 'corrode.nerve-rot', family: 'corrode', trait: 'nerve-rot',
      name: 'Nerve Rot', nameZh: '神经腐坏',
      description: 'Corrode interrupts the current attack, and corroded enemies wind up more slowly while the status remains.',
      descriptionZh: '侵蚀会打断当前攻击；状态持续期间，敌人的攻击蓄力也会明显变慢。',
      hooks: {
        [E.TARGET_WEAKENED]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target) return;
          resetAttack(event.target, 1.15);
        },
        [E.UPDATE]: function (event) {
          targets(event.state).forEach(function (target) {
            if (!(target.corrodeTimer > 0) || !target.attackState || target.attackState === 'idle') return;
            target.attackAge = Math.max(0, (Number(target.attackAge) || 0) - event.dt * 0.42);
          });
        }
      }
    },
    {
      id: 'corrode.core-fracture', family: 'corrode', traits: ['core-fracture', 'weaken'],
      name: 'Core Fracture', nameZh: '核心断裂',
      description: 'Corrode bites deeper into dense-core targets and enemies already below half of their original power.',
      descriptionZh: '侵蚀会对高密度核心目标以及已跌至半数战斗力以下的敌人造成更深断裂。',
      hooks: {
        [E.TARGET_WEAKEN]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target) return;
          var ratio = (Number(event.target.power) || 0) / Math.max(0.1, Number(event.target.originalPower) || 0.1);
          if (!event.target.denseCore && ratio > 0.5) return;
          event.amount += event.target.boss ? 0.055 : 0.1;
          cue(event.state, event.target, label('CORE FRACTURE', '核心断裂'), palette.orange || '#ff8a38');
        }
      }
    },
    {
      id: 'corrode.recovery-lock', family: 'corrode', trait: 'recovery-lock',
      name: 'Recovery Lock', nameZh: '恢复封锁',
      description: 'While corrosion remains, the target cannot recover its other weakening timers or attack composure.',
      descriptionZh: '侵蚀仍在持续时，目标无法恢复其他削弱计时，也更难重新组织攻击。',
      hooks: {
        'status:tick': function (event) {
          if (!event.target || !(event.target.corrodeTimer > 0)) return;
          event.pauseWeakness = true;
          event.pauseRecovery = true;
          event.target.attackCooldown = Math.max(Number(event.target.attackCooldown) || 0, 0.16);
        }
      }
    },
    {
      id: 'corrode.solvent-halo', family: 'corrode', trait: 'solvent-halo',
      name: 'Solvent Halo', nameZh: '溶剂光环',
      description: 'A Corrode hit splashes two nearby targets with a weaker solvent, spreading setup without copying the full cast.',
      descriptionZh: '侵蚀命中时会把较弱的溶剂溅射给附近两个目标，用于铺设状态而不会复制完整施法。',
      hooks: {
        [E.TARGET_WEAKENED]: function (event) {
          if (event.sourceId !== 'corrode' || !event.target || event.solventHalo) return;
          var nearby = targets(event.state).filter(function (target) {
            return target !== event.target && Utils.dist(target, event.target) <= 170;
          }).sort(function (a, b) { return Utils.dist(a, event.target) - Utils.dist(b, event.target); }).slice(0, 2);
          nearby.forEach(function (target) {
            if (window.SkillSystem && SkillSystem.weakenTarget) SkillSystem.weakenTarget(event.state, 'solvent-halo', target, target.boss ? 0.025 : 0.055, 1.3);
            target.corrodeTimer = Math.max(target.corrodeTimer || 0, 1.3);
            target.corrodeFactor = Math.max(target.corrodeFactor || 0, target.boss ? 0.025 : 0.055);
            cue(event.state, target, label('SOLVENT', '溶剂'), palette.pink || '#ff6fa8');
          });
        }
      }
    },
    {
      id: 'corrode.entropy-counter', family: 'corrode', trait: 'entropy-counter',
      name: 'Entropy Counter', nameZh: '熵增计数器',
      description: 'Hit a corroded target with three different weakening sources to trigger a controlled entropy collapse.',
      descriptionZh: '用三种不同削弱来源命中同一侵蚀目标，即可触发一次受控的熵崩塌。',
      hooks: {
        [E.TARGET_WEAKENED]: function (event) {
          var target = event.target;
          if (!target || !(target.corrodeTimer > 0) || !event.sourceId || event.sourceId === 'entropy') return;
          var now = Number(event.state.time) || 0;
          if (now > (target.entropyUntil || 0)) target.entropySources = Object.create(null);
          target.entropySources = target.entropySources || Object.create(null);
          target.entropySources[event.sourceId] = true;
          target.entropyUntil = now + 4.5;
          if (Object.keys(target.entropySources).length < 3) return;
          target.entropySources = Object.create(null);
          if (window.SkillSystem && SkillSystem.weakenTarget) SkillSystem.weakenTarget(event.state, 'entropy', target, target.boss ? 0.045 : 0.1, 1.6);
          resetAttack(target, 1.25);
          if (event.state.shockwaves) event.state.shockwaves.push({ x: target.x, y: target.y, age: 0, life: 0.48, radius: 125, color: palette.pink || '#ff6fa8' });
          cue(event.state, target, label('ENTROPY COLLAPSE', '熵崩塌'), palette.pink || '#ff6fa8');
        }
      }
    },
    {
      id: 'corrode.acid-trail', family: 'corrode', trait: 'acid-trail',
      name: 'Acid Trail', nameZh: '酸蚀轨迹',
      description: 'Moving corroded targets leave short-lived solvent pools that weaken other enemies crossing their path.',
      descriptionZh: '移动中的侵蚀目标会留下短暂溶剂池，削弱穿过轨迹的其他敌人。',
      defaults: { zones: [] },
      hooks: {
        [E.UPDATE]: function (event, effect) {
          var now = Number(event.state.time) || 0;
          var zones = effect.state.zones || (effect.state.zones = []);
          targets(event.state).forEach(function (target) {
            var speed2 = (target.vx || 0) * (target.vx || 0) + (target.vy || 0) * (target.vy || 0);
            if (!(target.corrodeTimer > 0) || speed2 < 900 || now < (target.acidTrailAt || 0)) return;
            target.acidTrailAt = now + 0.75;
            zones.push({ x: target.x, y: target.y, expiresAt: now + 2.4, source: target, hitTargets: [] });
            if (zones.length > 14) zones.shift();
            if (event.state.shockwaves) event.state.shockwaves.push({ x: target.x, y: target.y, age: 0, life: 0.42, radius: 58, color: palette.pink || '#ff6fa8' });
          });
          effect.state.zones = zones.filter(function (zone) {
            if (zone.expiresAt <= now) return false;
            targets(event.state).forEach(function (target) {
              if (target === zone.source || zone.hitTargets.indexOf(target) !== -1 || Utils.dist(target, zone) > 58) return;
              zone.hitTargets.push(target);
              if (window.SkillSystem && SkillSystem.weakenTarget) SkillSystem.weakenTarget(event.state, 'acid-trail', target, target.boss ? 0.012 : 0.04, 1.1);
              target.corrodeTimer = Math.max(target.corrodeTimer || 0, 1.1);
            });
            return true;
          });
        }
      }
    }
  ]);
})();
