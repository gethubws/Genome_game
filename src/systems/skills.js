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
  var byId = {};
  definitions.forEach(function (definition) { byId[definition.id] = definition; });

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
    if (source === 'potential') return words.potentialOccurrences || [];
    // Skills use the last expressed genome by default. Before the first
    // settlement, fall back to the live preview so the opening genome works.
    return words.occurrences && words.occurrences.length ? words.occurrences : (words.potentialOccurrences || []);
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

  function potency(state, id, source) {
    var raw = rawPotency(state, id, source);
    return raw > 0 ? Math.log2(1 + raw) * 2 : 0;
  }

  function level(state, id) { return potency(state, id); }

  function isEquipped(state, id) { return state.player.activeSlots.indexOf(id) !== -1; }

  function activate(state, id) {
    if (!id || !state.skillInventory.unlocked.has(id) || !isEquipped(state, id)) return false;
    var definition = byId[id];
    if (!definition || typeof definition.api !== 'function') return false;
    var api = definition.api();
    if (!api) return false;
    // Keep the dispatcher tolerant of legacy action names while every skill
    // migrates to the shared tryStart contract.
    var starter = typeof api.tryStart === 'function' ? api.tryStart : api.tryFire;
    if (typeof starter !== 'function') return false;
    var started = starter.call(api, state);
    if (started && window.AudioSystem) AudioSystem.play('skill');
    return started;
  }

  function activateSlot(state, slot) { return activate(state, state.player.activeSlots[slot]); }

  function charge(state, id) {
    if (!id || !byId[id]) return 0;
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

  window.SkillSystem = {
    definitions: definitions, byId: byId, refreshUnlocks: refreshUnlocks,
    level: level, potency: potency, rawPotency: rawPotency, activeOccurrences: activeOccurrences,
    localizedName: localizedName, localizedDescription: localizedDescription,
    activate: activate, activateSlot: activateSlot, charge: charge,
    cooldown: cooldown, rewardWord: rewardWord
  };
})();
