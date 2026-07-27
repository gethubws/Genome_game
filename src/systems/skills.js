(function () {
  var definitions = [
    { id: 'dash', family: 'movement', name: 'Dash', nameZh: '冲刺', icon: '>>', color: '#ffc84a', words: ['dash', 'rush', 'sprint', 'speed'], description: 'Burst forward with temporary combat power.', descriptionZh: '向前爆发移动，并在冲刺期间临时提高战斗力。', api: function () { return DashSkill; } },
    { id: 'shot', family: 'hunt', name: 'Shot', nameZh: '射击', icon: '*', color: '#ff3e8d', words: ['shot', 'shoot', 'spit', 'bolt', 'bite'], description: 'Fire a weakening gene bolt.', descriptionZh: '发射一枚削弱敌人战斗力的基因弹。', api: function () { return ShotSkill; } },
    { id: 'nova', family: 'pulse', name: 'Nova', nameZh: '脉冲', icon: 'N', color: '#d86cff', words: ['nova', 'pulse', 'wave', 'blast'], description: 'Weaken every nearby enemy.', descriptionZh: '释放范围脉冲，削弱附近所有敌人。', api: function () { return NovaSkill; } },
    { id: 'guard', family: 'guard', name: 'Guard', nameZh: '守护', icon: 'G', color: '#ffd36f', words: ['guard', 'shield', 'shell', 'armor'], description: 'Block the next genome-breaking hit.', descriptionZh: '抵挡下一次会损伤成长战力或基因组的攻击。', api: function () { return GuardSkill; } },
    { id: 'freeze', family: 'control', name: 'Freeze', nameZh: '冻结', icon: 'F', color: '#8fe8ff', words: ['freeze', 'cold', 'ice', 'slow'], description: 'Slow enemies in a wide field.', descriptionZh: '大范围减速敌人并干扰其行动。', api: function () { return FreezeSkill; } },
    { id: 'scan', family: 'sense', name: 'Scan', nameZh: '扫描', icon: 'O', color: '#35d8ff', words: ['scan', 'see', 'eye', 'look', 'view'], description: 'Reveal enemy power, letters and drops.', descriptionZh: '揭示附近敌人的战斗力、字母与掉落。', api: function () { return ScanSkill; } },
    { id: 'growth', family: 'growth', name: 'Growth', nameZh: '生长', icon: '+', color: '#7cf29a', words: ['growth', 'grow', 'life', 'feed'], description: 'Empower the next growth catches.', descriptionZh: '强化接下来数次吞噬成长鱼获得的战斗力。', api: function () { return GrowthSkill; } },
    { id: 'splice', family: 'genome', name: 'Splice', nameZh: '剪接', icon: 'S', color: '#65e5ff', words: ['splice', 'gene', 'genome', 'join'], description: 'Move unlocked leading factors to the genome tail.', descriptionZh: '将前方未锁定的基因因子移到队尾。', api: function () { return SpliceSkill; } },
    { id: 'echo', family: 'expression', name: 'Echo', nameZh: '回响', icon: 'E', color: '#ff6fa8', words: ['echo', 'repeat', 'word', 'voice'], description: 'Temporarily repeat the strongest expressed word.', descriptionZh: '暂时再次放大当前最强单词的倍率。', api: function () { return EchoSkill; } },
    { id: 'corrode', family: 'corrosion', name: 'Corrode', nameZh: '侵蚀', icon: 'C', color: '#b989ff', words: ['corrode', 'decay', 'rust', 'poison', 'weaken', 'drain'], description: 'Strip a percentage of a strong target power.', descriptionZh: '按比例削减一个强敌或 Boss 的战斗力。', api: function () { return CorrodeSkill; } }
  ];
  var synergies = [
    { id: 'lockOn', skills: ['scan', 'shot'], name: 'Lock-On', nameZh: '锁定射击', description: 'Gene bolts weaken revealed targets more strongly.', descriptionZh: '基因弹对已扫描目标造成更强削弱。' },
    { id: 'deepAnalysis', skills: ['scan', 'corrode'], name: 'Deep Analysis', nameZh: '深层解析', description: 'Corrode strips more power from revealed targets.', descriptionZh: '侵蚀对已扫描目标削减更多战斗力。' },
    { id: 'shatter', skills: ['freeze', 'shot'], name: 'Shatter', nameZh: '碎裂弹', description: 'Gene bolts consume Freeze to break extra target power.', descriptionZh: '基因弹消耗冻结状态，额外击碎目标战斗力。' },
    { id: 'icebreak', skills: ['freeze', 'nova'], name: 'Icebreak', nameZh: '破冰脉冲', description: 'Nova detonates frozen targets for stronger area weakening.', descriptionZh: '脉冲引爆冻结目标，造成更强范围削弱。' },
    { id: 'counterwave', skills: ['guard', 'nova'], name: 'Counterwave', nameZh: '反击波', description: 'A successful Guard releases a weakening counter pulse.', descriptionZh: '守护成功抵挡攻击时释放削弱反击波。' },
    { id: 'feedingRush', skills: ['growth', 'dash'], name: 'Feeding Rush', nameZh: '觅食冲刺', description: 'Growth catches during Dash grant more power and refund Dash cooldown.', descriptionZh: '冲刺中吞噬成长鱼获得更多战力，并返还冲刺冷却。' },
    { id: 'recodeResonance', skills: ['splice', 'echo'], name: 'Recode Resonance', nameZh: '重编码共鸣', description: 'A productive Splice primes the new strongest word for Echo.', descriptionZh: '有效剪接会为新形成的最强单词蓄积一次强化回响。' }
  ];
  var byId = {};
  var synergyById = {};
  definitions.forEach(function (definition) { byId[definition.id] = definition; });
  synergies.forEach(function (synergy) { synergyById[synergy.id] = synergy; });

  function wordFor(text) { return window.WordSystem && WordSystem.byText ? WordSystem.byText[text] : null; }

  function matchesFamily(text, id) {
    var word = wordFor(text);
    return !!(word && (word.family === id || word.skill === id));
  }

  function usesChinese() {
    return !!(window.I18n && I18n.locale && I18n.locale() === 'zh-CN');
  }

  function localizedName(definition) {
    return usesChinese() ? (definition.nameZh || definition.name) : definition.name;
  }

  function localizedDescription(definition) {
    return usesChinese() ? (definition.descriptionZh || definition.description) : definition.description;
  }

  function localizedSynergyName(synergy) {
    return usesChinese() ? (synergy.nameZh || synergy.name) : synergy.name;
  }

  function localizedSynergyDescription(synergy) {
    return usesChinese() ? (synergy.descriptionZh || synergy.description) : synergy.description;
  }

  function refreshUnlocks(state) {
    var previous = new Set(state.skillInventory.unlocked);
    definitions.forEach(function (definition) {
      var unlocked = Array.from(state.words.unlocked).some(function (word) { return matchesFamily(word, definition.id); });
      if (!unlocked) return;
      state.skillInventory.unlocked.add(definition.id);
      if (!previous.has(definition.id)) {
        state.skillInventory.newlyUnlocked.push(definition.id);
        GameUI.toast(
          state,
          usesChinese() ? '技能家族已解锁：' + localizedName(definition) : 'Skill family unlocked: ' + definition.name,
          usesChinese() ? '击败 Boss 后可在技能背包中装备' : 'Equip it after defeating a Boss'
        );
      }
    });
    state.uiDirty = true;
  }

  function activeOccurrences(state, source) {
    var words = state.words || {};
    if (source === 'settled' || source === 'expressed') return words.occurrences || [];
    // Skill strength follows the live genome, just like combat power. The
    // settled expression is an explicit compatibility/debug source only.
    if (Array.isArray(words.potentialOccurrences)) return words.potentialOccurrences;
    return words.occurrences || [];
  }

  // Equipment is persistent, but a skill only has power while its family
  // appears in the live genome preview. Keep this separate from the historic
  // `skillInventory.unlocked` record so pushing a word out of the queue does
  // not make the player lose the backpack slot forever.
  function supportOccurrences(state) {
    var words = state && state.words ? state.words : {};
    if (Array.isArray(words.potentialOccurrences)) return words.potentialOccurrences;
    return Array.isArray(words.occurrences) ? words.occurrences : [];
  }

  function isSupported(state, id) {
    if (!id || !byId[id]) return false;
    return supportOccurrences(state).some(function (entry) {
      var word = entry && entry.word ? entry.word : entry;
      return !!(word && (word.family === id || word.skill === id));
    });
  }

  function supportCache(state) {
    if (!state) return {};
    if (!state.skillInventory) state.skillInventory = { unlocked: new Set(), newlyUnlocked: [] };
    if (!state.skillInventory._supportStatus) state.skillInventory._supportStatus = Object.create(null);
    return state.skillInventory._supportStatus;
  }

  function rawPotency(state, id, source) {
    var total = 0;
    var occurrences = activeOccurrences(state, source);
    occurrences.forEach(function (entry) {
      var word = entry && entry.word;
      if (!word || (word.family !== id && word.skill !== id)) return;
      total += Math.max(0.5, Number(word.affinity) || 1);
    });
    return total;
  }

  function rawVariantPotency(state, id, variant, source) {
    var total = 0;
    activeOccurrences(state, source).forEach(function (entry) {
      var word = entry && entry.word;
      var traits = word && word.traits;
      var matchesTrait = word && (word.variant === variant || (Array.isArray(traits) && traits.indexOf(variant) !== -1));
      if (!word || (word.family !== id && word.skill !== id) || !matchesTrait) return;
      total += Math.max(0.5, Number(word.affinity) || 1);
    });
    return total;
  }

  function potency(state, id, source) {
    var raw = rawPotency(state, id, source);
    return raw > 0 ? Math.log2(1 + raw) * 2 : 0;
  }

  function variantPotency(state, id, variant, source) {
    var raw = rawVariantPotency(state, id, variant, source);
    return raw > 0 ? Math.log2(1 + raw) * 2 : 0;
  }

  function level(state, id) { return potency(state, id); }

  function isEquipped(state, id) { return state.player.activeSlots.indexOf(id) !== -1; }

  function syncSupport(state, id) {
    var supported = isSupported(state, id);
    var cache = supportCache(state);
    var previous = cache[id];
    cache[id] = supported;
    if (previous === supported) return supported;
    // A skill may remain in its slot while temporarily unpowered. End any
    // transient state exactly once when that transition happens, so delayed
    // effects cannot keep running after their source word is gone.
    if (previous !== false && !supported && isEquipped(state, id)) clearTransient(state, id);
    if (window.SkillEffects && typeof SkillEffects.invalidate === 'function') SkillEffects.invalidate(state);
    state.uiDirty = true;
    return supported;
  }

  function hasSynergy(state, id) {
    var synergy = synergyById[id];
    return !!(synergy && synergy.skills.every(function (skillId) {
      return isEquipped(state, skillId) && isSupported(state, skillId);
    }));
  }

  function activeSynergies(state) {
    return synergies.filter(function (synergy) { return hasSynergy(state, synergy.id); });
  }

  function clearTransient(state, id) {
    var skill = state.skills && state.skills[id];
    if (!skill) return;
    skill.active = false;
    if (Object.prototype.hasOwnProperty.call(skill, 'boost')) skill.boost = 1;
    if (Object.prototype.hasOwnProperty.call(skill, 'multiplier')) skill.multiplier = 1;
    if (Object.prototype.hasOwnProperty.call(skill, 'charges')) skill.charges = 0;
    if (Object.prototype.hasOwnProperty.call(skill, 'target')) skill.target = null;
    if (Object.prototype.hasOwnProperty.call(skill, 'word')) skill.word = '';
    if (Object.prototype.hasOwnProperty.call(skill, 'sourceMultiplier')) skill.sourceMultiplier = 1;
    if (Object.prototype.hasOwnProperty.call(skill, 'moltPending')) skill.moltPending = false;
    if ((id === 'splice' || id === 'echo') && state.skills.echo) state.skills.echo.splicePrime = null;
    if (window.SkillEffects) {
      if (typeof SkillEffects.cancelScheduled === 'function') SkillEffects.cancelScheduled(state, id);
      if (typeof SkillEffects.resetFamilyState === 'function') SkillEffects.resetFamilyState(state, id);
    }
  }

  function unequipAt(state, slot) {
    if (slot < 0 || slot >= state.player.activeSlots.length) return null;
    var id = state.player.activeSlots[slot];
    if (!id) return null;
    clearTransient(state, id);
    state.player.activeSlots[slot] = null;
    if (window.SkillEffects && typeof SkillEffects.invalidate === 'function') SkillEffects.invalidate(state);
    state.uiDirty = true;
    return id;
  }

  function equipAt(state, id, slot) {
    if (!byId[id] || !state.skillInventory.unlocked.has(id) || !isSupported(state, id)) return false;
    if (slot < 0 || slot >= state.player.activeSlots.length) return false;
    var currentSlot = state.player.activeSlots.indexOf(id);
    if (currentSlot !== -1 && currentSlot !== slot) unequipAt(state, currentSlot);
    if (state.player.activeSlots[slot] && state.player.activeSlots[slot] !== id) unequipAt(state, slot);
    state.player.activeSlots[slot] = id;
    supportCache(state)[id] = true;
    if (window.SkillEffects && typeof SkillEffects.invalidate === 'function') SkillEffects.invalidate(state);
    state.uiDirty = true;
    return true;
  }

  function updateAll(state) {
    ['dash', 'scan', 'shot', 'nova', 'guard', 'freeze', 'growth', 'splice', 'echo', 'corrode'].forEach(function (id) {
      // Support controls starting and sustaining the skill itself, while the
      // base update also owns housekeeping for already-created world state
      // such as projectiles, frozen timers and cooldowns. Clear transient
      // skill state first, then always let that housekeeping advance.
      syncSupport(state, id);
      var definition = byId[id];
      var api = definition && definition.api();
      if (api && typeof api.update === 'function') api.update(state);
    });
    if (window.SkillEffects && typeof SkillEffects.update === 'function') SkillEffects.update(state, state.dt);
  }

  function logPowerMultiplier(state) {
    var log = 0;
    definitions.forEach(function (definition) {
      if (!isEquipped(state, definition.id) || !isSupported(state, definition.id)) return;
      var api = definition.api();
      if (!api) return;
      if (typeof api.getLogPowerMultiplier === 'function') {
        var extraLog = Number(api.getLogPowerMultiplier(state));
        if (extraLog === Infinity) log = Infinity;
        else if (isFinite(extraLog) && log !== Infinity) log += extraLog;
        return;
      }
      if (typeof api.getPowerMultiplier !== 'function') return;
      var multiplier = Number(api.getPowerMultiplier(state));
      if (multiplier === Infinity) log = Infinity;
      else if (multiplier > 0 && isFinite(multiplier) && log !== Infinity) log += Math.log(multiplier);
    });
    if (window.SkillEffects && typeof SkillEffects.emit === 'function') {
      var event = SkillEffects.emit(state, SkillEffects.EVENTS.POWER_LOG_MULTIPLIER, {
        log: log,
        baseLog: log
      });
      var effectLog = Number(event.log);
      if (effectLog === Infinity) return Infinity;
      if (isFinite(effectLog)) log = effectLog;
    }
    return log;
  }

  function showSynergyCue(state, target, ids) {
    if (!ids || !ids.length || !state.floatingTexts) return;
    var labels = ids.map(function (id) { return localizedSynergyName(synergyById[id]); });
    state.floatingTexts.push({
      x: target.x,
      y: target.y - (target.radius || 12) - 18,
      text: labels.join(' + '),
      color: '#f7fbff',
      life: 0.85,
      maxLife: 0.85
    });
  }

  function weakenTarget(state, sourceId, target, baseWeaken, duration) {
    var weaken = Math.max(0, Number(baseWeaken) || 0);
    var powerBefore = Math.max(0.1, Number(target && target.power) || 0.1);
    var cues = [];
    if (sourceId === 'shot' && target.revealed > 0 && hasSynergy(state, 'lockOn')) {
      weaken *= 1.28;
      cues.push('lockOn');
    }
    if (sourceId === 'corrode' && target.revealed > 0 && hasSynergy(state, 'deepAnalysis')) {
      weaken *= 1.2;
      cues.push('deepAnalysis');
    }
    if (sourceId === 'shot' && target.frozen > 0 && hasSynergy(state, 'shatter')) {
      weaken *= 1.35;
      target.frozen *= 0.3;
      cues.push('shatter');
    }
    if (sourceId === 'nova' && target.frozen > 0 && hasSynergy(state, 'icebreak')) {
      weaken *= 1.24;
      target.frozen *= 0.45;
      cues.push('icebreak');
    }
    if (window.SkillEffects && typeof SkillEffects.emit === 'function') {
      var weakenEvent = SkillEffects.emit(state, SkillEffects.EVENTS.TARGET_WEAKEN, {
        sourceId: sourceId,
        target: target,
        amount: weaken,
        duration: Number(duration) || 0,
        synergyIds: cues
      });
      weaken = Math.max(0, Number(weakenEvent.amount) || 0);
      duration = Math.max(0, Number(weakenEvent.duration) || 0);
    }
    weaken = Utils.clamp(weaken, 0, 0.82);
    target.power = Math.max(0.1, target.power * (1 - weaken));
    target.weaknessTimer = Math.max(target.weaknessTimer || 0, Number(duration) || 0);
    target.hurt = Math.max(target.hurt || 0, 0.45);
    showSynergyCue(state, target, cues);
    if (window.SkillEffects && typeof SkillEffects.emit === 'function') {
      SkillEffects.emit(state, SkillEffects.EVENTS.TARGET_WEAKENED, {
        sourceId: sourceId,
        target: target,
        amount: weaken,
        duration: Number(duration) || 0,
        powerBefore: powerBefore,
        powerAfter: target.power,
        powerRemoved: Math.max(0, powerBefore - target.power),
        synergyIds: cues
      });
    }
    return { weaken: weaken, synergies: cues };
  }

  function onGuardAbsorbed(state, source, details) {
    if (state.skills && state.skills.guard) state.skills.guard.absorbed = true;
    if (window.SkillEffects && typeof SkillEffects.emit === 'function') {
      SkillEffects.emit(state, SkillEffects.EVENTS.GUARD_ABSORBED, {
        source: source || null,
        details: details || {},
        guard: state.skills && state.skills.guard
      });
    }
    if (!hasSynergy(state, 'counterwave')) return 0;
    var targets = (state.enemies || []).slice();
    if (state.boss && state.boss.active) targets.push(state.boss.active);
    var count = 0;
    targets.forEach(function (target) {
      if (Utils.dist(target, state.player) > 260) return;
      weakenTarget(state, 'counterwave', target, target.boss ? 0.08 : 0.16, 2.1);
      if (!target.boss && target.attackState) {
        target.attackState = 'idle';
        target.attackAge = 0;
        target.attackCooldown = Math.max(target.attackCooldown || 0, 1.25);
      }
      count += 1;
    });
    if (count && state.shockwaves) {
      state.shockwaves.push({ x: state.player.x, y: state.player.y, age: 0, life: 0.48, radius: 260, color: '#d86cff' });
      showSynergyCue(state, state.player, ['counterwave']);
    }
    return count;
  }

  function modifyGrowthGain(state, amount, enemy) {
    var result = { amount: amount, triggered: false };
    var dash = state.skills && state.skills.dash;
    if (enemy && enemy.dropType !== 'growth') return result;
    if (!hasSynergy(state, 'feedingRush') || !dash || !dash.active) return result;
    result.amount *= 1.35;
    result.triggered = true;
    dash.cooldown = Math.max(0, (dash.cooldown || 0) - 0.35);
    return result;
  }

  function strongestWord(occurrences) {
    var best = null;
    (occurrences || []).forEach(function (entry) {
      var word = entry && entry.word;
      if (!word) return;
      if (!best || (word.mult || 1) > (best.mult || 1) || ((word.mult || 1) === (best.mult || 1) && word.text.length > best.text.length)) best = word;
    });
    return best;
  }

  function primeEchoFromSplice(state, beforeLog, beforeSignature) {
    if (!hasSynergy(state, 'recodeResonance')) return null;
    var occurrences = (state.words && state.words.potentialOccurrences) || [];
    var afterLog = Number(state.words && state.words.potentialLogMultiplier) || 0;
    var afterSignature = occurrences.map(function (entry) { return entry.word.text + '@' + entry.index; }).join('|');
    if (afterLog <= beforeLog + 0.000001 || afterSignature === beforeSignature) return null;
    var word = strongestWord(occurrences);
    if (!word) return null;
    state.skills.echo.splicePrime = {
      word: word,
      expiresAt: (state.time || 0) + 8,
      repeatBonus: 0.26,
      durationBonus: 1.1
    };
    showSynergyCue(state, state.player, ['recodeResonance']);
    return state.skills.echo.splicePrime;
  }

  function echoPrime(state) {
    var prime = state.skills && state.skills.echo && state.skills.echo.splicePrime;
    if (!prime) return null;
    if (prime.expiresAt < (state.time || 0) || !hasSynergy(state, 'recodeResonance')) {
      state.skills.echo.splicePrime = null;
      return null;
    }
    return prime;
  }

  function consumeEchoPrime(state) {
    var prime = echoPrime(state);
    if (state.skills && state.skills.echo) state.skills.echo.splicePrime = null;
    return prime;
  }

  function activate(state, id) {
    if (!id || !state.skillInventory.unlocked.has(id) || !isEquipped(state, id) || !isSupported(state, id)) return false;
    var definition = byId[id];
    if (!definition || typeof definition.api !== 'function') return false;
    var api = definition.api();
    if (!api) return false;
    // Keep the dispatcher tolerant of legacy action names while every skill
    // migrates to the shared tryStart contract.
    var starter = typeof api.tryStart === 'function' ? api.tryStart : api.tryFire;
    if (typeof starter !== 'function') return false;
    var wasActive = !!(state.skills && state.skills[id] && state.skills[id].active);
    var started = starter.call(api, state);
    if (started && window.SkillEffects && typeof SkillEffects.emit === 'function') {
      SkillEffects.emit(state, SkillEffects.EVENTS.SKILL_STARTED, {
        id: id,
        definition: definition,
        api: api,
        skill: state.skills && state.skills[id],
        wasActive: wasActive,
        redirected: id === 'dash' && wasActive
      });
    }
    if (started && window.AudioSystem) AudioSystem.play('skill');
    return started;
  }

  function activateSlot(state, slot) { return activate(state, state.player.activeSlots[slot]); }

  function charge(state, id) {
    if (!id || !byId[id]) return 0;
    if (!isSupported(state, id)) return 0;
    return byId[id].api().charge(state);
  }

  function cooldown(state, id) { return id && state.skills[id] ? state.skills[id].cooldown : 0; }

  function rewardWord(state) {
    var locked = definitions.filter(function (definition) { return !state.skillInventory.unlocked.has(definition.id); });
    var definition = Utils.pick(locked.length ? locked : definitions);
    var candidates = definition.words.map(wordFor).filter(Boolean);
    if (!candidates.length) {
      candidates = WordSystem.all.filter(function (word) { return word.family === definition.id; });
    }
    return Utils.pick(candidates);
  }

  function activeEffects(state) {
    return window.SkillEffects && typeof SkillEffects.active === 'function' ? SkillEffects.active(state) : [];
  }

  function hasEffect(state, id) {
    return !!(window.SkillEffects && typeof SkillEffects.has === 'function' && SkillEffects.has(state, id));
  }

  function effectPotency(state, id) {
    return window.SkillEffects && typeof SkillEffects.potency === 'function' ? SkillEffects.potency(state, id) : 0;
  }

  function emitEffect(state, eventName, context) {
    if (!window.SkillEffects || typeof SkillEffects.emit !== 'function') return context || {};
    return SkillEffects.emit(state, eventName, context);
  }

  function tickTargetStatuses(state, target) {
    if (!state || !target) return { target: target || null };
    var tick = emitEffect(state, 'status:tick', {
      target: target,
      pauseWeakness: false,
      pauseCorrode: false,
      pauseRecovery: false
    });
    var dt = Math.max(0, Number(state.dt) || 0);
    if (!tick.pauseWeakness) target.weaknessTimer = Math.max(0, (target.weaknessTimer || 0) - dt);
    if (!tick.pauseCorrode) target.corrodeTimer = Math.max(0, (target.corrodeTimer || 0) - dt);
    if (target.corrodeTimer <= 0) target.corrodeFactor = 0;
    return tick;
  }

  window.SkillSystem = {
    definitions: definitions, byId: byId, synergies: synergies, synergyById: synergyById, refreshUnlocks: refreshUnlocks,
    level: level, potency: potency, rawPotency: rawPotency, variantPotency: variantPotency, rawVariantPotency: rawVariantPotency, activeOccurrences: activeOccurrences,
    localizedName: localizedName, localizedDescription: localizedDescription, localizedSynergyName: localizedSynergyName, localizedSynergyDescription: localizedSynergyDescription,
    isEquipped: isEquipped, isSupported: isSupported, hasSynergy: hasSynergy, activeSynergies: activeSynergies,
    equipAt: equipAt, unequipAt: unequipAt, clearTransient: clearTransient,
    updateAll: updateAll, logPowerMultiplier: logPowerMultiplier,
    weakenTarget: weakenTarget, onGuardAbsorbed: onGuardAbsorbed, modifyGrowthGain: modifyGrowthGain,
    primeEchoFromSplice: primeEchoFromSplice, echoPrime: echoPrime, consumeEchoPrime: consumeEchoPrime,
    activate: activate, activateSlot: activateSlot, charge: charge,
    cooldown: cooldown, rewardWord: rewardWord,
    activeEffects: activeEffects, hasEffect: hasEffect, effectPotency: effectPotency, emitEffect: emitEffect,
    tickTargetStatuses: tickTargetStatuses
  };
})();
