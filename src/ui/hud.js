(function () {
  var els = {};
  var settingsWasPaused = true;

  function init(state) {
    els.depth = document.getElementById('depthValue');
    els.stage = document.getElementById('stageValue');
    els.combat = document.getElementById('combatValue');
    els.capacity = document.getElementById('capacityValue');
    els.multiplier = document.getElementById('multiplierValue');
    els.genomeSlots = document.getElementById('genomeSlots');
    els.genomePanel = document.querySelector('.genome-panel');
    els.letterHint = document.getElementById('letterHint');
    els.growthValue = document.getElementById('growthValue');
    els.growthMeter = document.getElementById('growthMeter');
    els.powerSurge = document.getElementById('powerSurge');
    els.powerSurgeDelta = document.getElementById('powerSurgeDelta');
    els.powerSurgeTotal = document.getElementById('powerSurgeTotal');
    els.wordList = document.getElementById('wordList');
    els.wordSummary = document.getElementById('wordSummary');
    els.settledMultiplier = document.getElementById('settledMultiplier');
    els.recommendationSummary = document.getElementById('recommendationSummary');
    els.targetWord = document.getElementById('targetWord');
    els.missingLetters = document.getElementById('missingLetters');
    els.bestRegion = document.getElementById('bestRegion');
    els.tailSuggestions = document.getElementById('tailSuggestions');
    els.outgoingRow = document.getElementById('outgoingRow');
    els.outgoingLetters = document.getElementById('outgoingLetters');
    els.outgoingHint = document.getElementById('outgoingHint');
    els.skillSlots = [document.getElementById('skillSlot1'), document.getElementById('skillSlot2'), document.getElementById('skillSlot3')];
    els.bossStatus = document.getElementById('bossStatus');
    els.bossRequirement = document.getElementById('bossRequirement');
    els.toastStack = document.getElementById('toastStack');
    els.menuButton = document.querySelector('.menu-button');
    els.settingsButton = document.querySelector('.settings-button');
    els.settingsModal = document.getElementById('settingsModal');
    els.closeSettingsButton = document.getElementById('closeSettingsButton');
    els.startScreen = document.getElementById('startScreen');
    els.enterGameButton = document.getElementById('enterGameButton');
    els.openGalleryButton = document.getElementById('openGalleryButton');
    els.galleryCount = document.getElementById('galleryCount');
    els.imageKeyInput = document.getElementById('imageKeyInput');
    els.saveImageKeyButton = document.getElementById('saveImageKeyButton');
    els.clearImageKeyButton = document.getElementById('clearImageKeyButton');
    els.imageKeyStatus = document.getElementById('imageKeyStatus');
    els.galleryModal = document.getElementById('galleryModal');
    els.closeGalleryButton = document.getElementById('closeGalleryButton');
    els.galleryGrid = document.getElementById('galleryGrid');
    els.evolutionModal = document.getElementById('evolutionModal');
    els.evolutionTitle = document.getElementById('evolutionTitle');
    els.evolutionBody = document.getElementById('evolutionBody');
    els.rewardRow = document.getElementById('rewardRow');
    els.skillBackpack = document.getElementById('skillBackpack');
    els.equippedSlots = document.getElementById('equippedSlots');
    els.skillInventory = document.getElementById('skillInventory');
    els.clearImagePanel = document.getElementById('clearImagePanel');
    els.clearImagePreview = document.getElementById('clearImagePreview');
    els.clearImageStatus = document.getElementById('clearImageStatus');
    els.clearImageDetail = document.getElementById('clearImageDetail');
    els.continueButton = document.getElementById('continueButton');

    els.continueButton.addEventListener('click', function () {
      if (state.runOver) {
        if (state.clearImage && state.clearImage.status === 'loading') {
          toast(state, I18n.t('finalImageStillRendering', 'Final image still rendering'), I18n.t('waitGallerySave', 'Wait for the Gallery save before starting a new run'));
          return;
        }
        window.location.reload();
        return;
      }
      state.paused = false;
      state.reward = null;
      state.skillInventory.newlyUnlocked = [];
      els.evolutionModal.classList.remove('show');
      els.evolutionModal.setAttribute('aria-hidden', 'true');
      if (els.skillBackpack) els.skillBackpack.classList.remove('show');
    });

    if (els.enterGameButton) {
      els.enterGameButton.addEventListener('click', function () { enterGame(state); });
    }
    if (els.openGalleryButton) {
      els.openGalleryButton.addEventListener('click', function () { openGallery(state); });
    }
    if (els.closeGalleryButton) {
      els.closeGalleryButton.addEventListener('click', function () { closeGallery(); });
    }
    if (els.menuButton) {
      els.menuButton.addEventListener('click', function () { showStartMenu(state); });
    }
    bindSettings(state);
    if (els.saveImageKeyButton) {
      els.saveImageKeyButton.addEventListener('click', saveImageKey);
    }
    if (els.clearImageKeyButton) {
      els.clearImageKeyButton.addEventListener('click', clearImageKey);
    }

    refreshGalleryCount();
    refreshImageKeyStatus();
    SettingsSystem.apply();
    I18n.apply();

    renderGenome(state);
    update(state, true);
  }

  function renderLiveMetrics(state) {
    var depth = Utils.depthAtY(state.player.y);
    if (els.stage) {
      var layerCount = GameConfig.map && GameConfig.map.layerCount ? GameConfig.map.layerCount : 4;
      var currentLayer = Utils.clamp(state.map.currentLayer || 1, 1, layerCount);
      els.stage.textContent = String(currentLayer).padStart(2, '0');
    }
    if (els.depth) els.depth.textContent = depth + 'm';
    var effectivePower = CombatSystem.effectivePower(state);
    var effectiveLogPower = CombatSystem.effectiveLogPower ? CombatSystem.effectiveLogPower(state) : null;
    if (els.combat) els.combat.textContent = CombatSystem.formatPower
      ? CombatSystem.formatPower(effectivePower, effectiveLogPower)
      : String(effectivePower);
    if (els.capacity) els.capacity.textContent = state.genome.letters.length + ' / ' + state.genome.capacity;
    if (els.multiplier) els.multiplier.textContent = state.words.potentialMultiplierDisplay || state.words.multiplierDisplay || formatMultiplier(state.words.potentialMultiplier || state.words.multiplier);
    if (els.growthValue) els.growthValue.textContent = '+' + state.growthPower.toFixed(1);
    if (els.growthMeter) els.growthMeter.style.width = Math.min(100, Math.round(state.growthPower / Math.max(1, effectivePower) * 100)) + '%';
    if (els.genomePanel) els.genomePanel.classList.toggle('danger', state.damageTaken && (state.growthPower <= 1.5 || state.genome.letters.length <= 2));
    if (els.bossStatus) els.bossStatus.textContent = state.boss.active ? I18n.t('active', 'active') : state.boss.depth + 'm';
    renderBossRequirement(state);
    if (els.letterHint) els.letterHint.textContent = (I18n.locale() === 'zh-CN' ? '字母战力 ' : 'letter score ') + GenomeSystem.letterScore(state).toFixed(1);
  }

  function update(state, force) {
    // Temporary skill windows change power and size without rebuilding the
    // heavier genome and word panels.
    renderLiveMetrics(state);
    if (!force && !state.uiDirty) {
      renderAbilitySlots(state);
      return;
    }

    renderGenome(state);
    renderOutgoing(state);
    renderWords(state);
    renderRecommendation(state);
    renderAbilitySlots(state);

    state.uiDirty = false;
  }

  function enterGame(state) {
    state.started = true;
    state.paused = false;
    AudioSystem.startMusic();
    if (els.startScreen) els.startScreen.classList.remove('show');
    if (els.enterGameButton) els.enterGameButton.textContent = I18n.t('resume', 'Resume');
  }

  function showStartMenu(state) {
    if (state.runOver || !els.startScreen) return;
    state.paused = true;
    els.startScreen.classList.add('show');
    if (els.enterGameButton) els.enterGameButton.textContent = state.started ? I18n.t('resume', 'Resume') : I18n.t('enterGame', 'Enter Game');
    refreshGalleryCount();
    refreshImageKeyStatus();
  }

  function bindSettings(state) {
    if (!els.settingsModal) return;
    var controls = {
      language: document.getElementById('languageSetting'), master: document.getElementById('masterVolume'), music: document.getElementById('musicVolume'), sfx: document.getElementById('sfxVolume'),
      muted: document.getElementById('muteSetting'), muteBackground: document.getElementById('backgroundMuteSetting'), shake: document.getElementById('shakeSetting'), flash: document.getElementById('flashSetting'), combatText: document.getElementById('combatTextSetting'), quality: document.getElementById('qualitySetting')
    };
    function refreshLocale() {
      I18n.apply();
      state.uiDirty = true;
      update(state, true);
      refreshGalleryCount();
      refreshImageKeyStatus();
      if (els.galleryModal && els.galleryModal.classList.contains('show')) renderGallery();
      if (els.evolutionModal && els.evolutionModal.classList.contains('show') && state.reward) showEvolution(state);
      else renderClearImage(state);
    }
    function refresh() {
      var values = SettingsSystem.get();
      Object.keys(controls).forEach(function (name) {
        var control = controls[name]; if (!control) return;
        if (control.type === 'checkbox') control.checked = !!values[name]; else control.value = values[name];
        if (control.type === 'range' && control.nextElementSibling) control.nextElementSibling.value = Math.round(values[name] * 100) + '%';
      });
      var fullscreen = document.getElementById('fullscreenButton');
      if (fullscreen) fullscreen.textContent = document.fullscreenElement ? I18n.t('exitFullscreen', 'Exit fullscreen') : I18n.t('enterFullscreen', 'Enter fullscreen');
    }
    function open() {
      if (state.runOver) return;
      settingsWasPaused = state.paused;
      state.paused = true;
      els.settingsModal.classList.add('show'); els.settingsModal.setAttribute('aria-hidden', 'false'); refresh();
    }
    function close() {
      els.settingsModal.classList.remove('show'); els.settingsModal.setAttribute('aria-hidden', 'true');
      if (!state.runOver) state.paused = settingsWasPaused;
    }
    Object.keys(controls).forEach(function (name) {
      var control = controls[name]; if (!control) return;
      control.addEventListener(control.type === 'range' ? 'input' : 'change', function () {
        var value = control.type === 'checkbox' ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
        SettingsSystem.set(name, value);
        if (name === 'language') refreshLocale();
        refresh();
      });
    });
    els.settingsButton.addEventListener('click', open);
    els.closeSettingsButton.addEventListener('click', close);
    els.settingsModal.addEventListener('click', function (event) { if (event.target === els.settingsModal) close(); });
    document.getElementById('resetSettingsButton').addEventListener('click', function () { SettingsSystem.reset(); refreshLocale(); refresh(); });
    document.getElementById('fullscreenButton').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {});
    });
    document.addEventListener('fullscreenchange', refresh);
    window.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (els.settingsModal.classList.contains('show')) close(); else open();
    });
    document.addEventListener('game-settings-changed', refresh);
    refresh();
  }

  function openGallery(state) {
    if (!els.galleryModal) return;
    if (state.started && !state.runOver) state.paused = true;
    renderGallery();
    els.galleryModal.classList.add('show');
    els.galleryModal.setAttribute('aria-hidden', 'false');
  }

  function closeGallery() {
    if (!els.galleryModal) return;
    els.galleryModal.classList.remove('show');
    els.galleryModal.setAttribute('aria-hidden', 'true');
  }

  function refreshGalleryCount() {
    if (!els.galleryCount) return;
    ImageSystem.loadGalleryRecords().then(function (records) {
    els.galleryCount.textContent = I18n.locale() === 'zh-CN' ? records.length + ' ' + I18n.t('records', '条记录') : records.length + (records.length === 1 ? ' Record' : ' Records');
    }).catch(function () {
      els.galleryCount.textContent = I18n.locale() === 'zh-CN' ? '0 ' + I18n.t('records', '条记录') : '0 Records';
    });
  }

  function saveImageKey() {
    if (!els.imageKeyInput) return;
    var ok = ImageSystem.setApiKey(els.imageKeyInput.value);
    els.imageKeyInput.value = '';
    refreshImageKeyStatus(ok ? I18n.t('savedLocally', 'saved locally') : I18n.t('saveFailed', 'save failed'));
  }

  function clearImageKey() {
    ImageSystem.clearApiKey();
    if (els.imageKeyInput) els.imageKeyInput.value = '';
    refreshImageKeyStatus(I18n.t('notSaved', 'not saved'));
  }

  function refreshImageKeyStatus(message) {
    if (!els.imageKeyStatus || !window.ImageSystem) return;
    var saved = ImageSystem.hasApiKey();
    els.imageKeyStatus.textContent = message || (saved ? ImageSystem.maskedKey() : I18n.t('notSaved', 'not saved'));
    if (els.imageKeyInput) els.imageKeyInput.placeholder = saved ? I18n.t('keySavedLocally', 'Key saved locally') : I18n.t('pasteKeyLocally', 'Paste key locally');
  }

  function renderGallery() {
    if (!els.galleryGrid) return;
    els.galleryGrid.innerHTML = '<div class="gallery-empty"><strong>' + I18n.t('galleryLoading', 'Loading gallery') + '</strong><span>' + I18n.t('galleryReading', 'Reading local run records.') + '</span></div>';
    ImageSystem.loadGalleryRecords().then(function (records) {
      els.galleryGrid.innerHTML = '';
      if (!records.length) {
        var empty = document.createElement('div');
        empty.className = 'gallery-empty';
        empty.innerHTML = '<strong>' + I18n.t('galleryEmptyTitle', 'No cleared runs yet') + '</strong><span>' + I18n.t('galleryEmptyBody', 'Final images will appear here after the fourth boss falls.') + '</span>';
        els.galleryGrid.appendChild(empty);
        return;
      }

      records.forEach(function (record) {
        var card = document.createElement('article');
        card.className = 'gallery-item';
        var image = record.thumbnail || record.image;
        if (image) {
          var img = document.createElement('img');
          img.src = image;
          img.alt = record.title || I18n.t('generatedGenomeAvatar', 'Generated genome avatar');
          card.appendChild(img);
        } else {
          var placeholder = document.createElement('div');
          placeholder.className = 'gallery-placeholder';
          placeholder.textContent = 'GENE';
          card.appendChild(placeholder);
        }
        var title = document.createElement('strong');
        title.textContent = record.title || I18n.t('clearedGenome', 'Cleared Genome');
        var meta = document.createElement('span');
        var wordCount = record.words && record.words.length
          ? record.words.length + ' ' + I18n.t('wordsCount', 'words')
          : I18n.t('savedRun', 'saved run');
        meta.textContent = (record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'saved run') + ' / ' + wordCount;
        card.appendChild(title);
        card.appendChild(meta);
        els.galleryGrid.appendChild(card);
      });
    }).catch(function () {
      els.galleryGrid.innerHTML = '<div class="gallery-empty"><strong>' + I18n.t('galleryUnavailableTitle', 'Gallery unavailable') + '</strong><span>' + I18n.t('galleryUnavailableBody', 'Local storage could not be read.') + '</span></div>';
    });
  }

  function renderGenome(state) {
    var slots = els.genomeSlots;
    slots.style.setProperty('--capacity', state.genome.capacity);
    slots.innerHTML = '';
    for (var i = 0; i < state.genome.capacity; i += 1) {
      var letter = state.genome.letters[i] || '';
      var cell = document.createElement('span');
      cell.className = 'gene-slot' + (letter ? ' filled' : '');
      if (letter && GenomeSystem.isLockedIndex(state.genome, i)) {
        cell.className += ' locked';
      }
      if (letter && i === state.genome.letters.length - 1 && state.time - state.genome.lastAddedAt < 0.4) {
        cell.className += ' new';
      }
      cell.textContent = letter.toUpperCase();
      slots.appendChild(cell);
    }
  }

  function formatMultiplier(value) {
    if (window.WordSystem && WordSystem.formatMultiplier) return WordSystem.formatMultiplier(value);
    var multiplier = Number(value);
    return isFinite(multiplier) && multiplier > 0 ? 'x' + multiplier.toFixed(2) : 'x1.00';
  }

  function renderOutgoing(state) {
    if (!els.outgoingRow || !els.outgoingLetters) return;
    var genome = state.genome;
    var isFull = genome.capacity > 0 && genome.letters.length >= genome.capacity;
    els.outgoingRow.hidden = !isFull;
    if (!isFull) return;

    var outgoing = [];
    for (var i = 0; i < genome.letters.length; i += 1) {
      if (!GenomeSystem.isLockedIndex(genome, i)) outgoing.push(genome.letters[i].toUpperCase());
    }

    els.outgoingLetters.textContent = outgoing.length
      ? outgoing.slice(0, 5).join(' · ') + (outgoing.length > 5 ? ' …' : '')
      : '—';
    if (els.outgoingHint) {
      els.outgoingHint.textContent = outgoing.length
        ? I18n.t('outgoingHint', 'The next letter starts removing unlocked factors from the left.')
        : I18n.t('allGenomeLocked', 'All current factors are locked.');
    }
  }

  function renderWords(state) {
    var expressed = state.words.found || [];
    var expressedOccurrences = state.words.occurrences || [];
    var currentWords = Array.isArray(state.words.potentialFound) ? state.words.potentialFound : expressed;
    var currentOccurrences = Array.isArray(state.words.potentialOccurrences) ? state.words.potentialOccurrences : expressedOccurrences;
    var occurrenceCount = typeof state.words.potentialOccurrenceCount === 'number' ? state.words.potentialOccurrenceCount : currentOccurrences.length;
    var currentCounts = state.words.potentialOccurrenceCounts || (window.WordSystem && WordSystem.occurrenceCounts ? WordSystem.occurrenceCounts(currentOccurrences) : {});
    var expressedCounts = state.words.occurrenceCounts || (window.WordSystem && WordSystem.occurrenceCounts ? WordSystem.occurrenceCounts(expressedOccurrences) : {});
    els.wordList.innerHTML = '';
    if (els.settledMultiplier) {
      els.settledMultiplier.textContent = state.words.multiplierDisplay || formatMultiplier(state.words.multiplier);
    }
    if (!currentWords.length) {
      els.wordSummary.textContent = I18n.t('noneYet', 'none yet');
      return;
    }

    var changedContributions = 0;
    var countKeys = new Set(Object.keys(currentCounts).concat(Object.keys(expressedCounts)));
    countKeys.forEach(function (text) {
      changedContributions += Math.abs((currentCounts[text] || 0) - (expressedCounts[text] || 0));
    });
    var pendingLabel = changedContributions ? (I18n.locale() === 'zh-CN' ? ' · ' + changedContributions + ' 次' + I18n.t('pendingConfirmation', 'pending') : ' · ' + changedContributions + ' skill pending') : '';
    els.wordSummary.textContent = I18n.locale() === 'zh-CN'
      ? occurrenceCount + ' 次出现 / ' + currentWords.length + ' 个单词' + pendingLabel
      : occurrenceCount + ' occurrences / ' + currentWords.length + ' words' + pendingLabel;
    currentWords.forEach(function (word) {
      var count = currentCounts[word.text] || 1;
      var contributionDelta = count - (expressedCounts[word.text] || 0);
      var chip = document.createElement('span');
      chip.className = 'word-chip ' + word.type + (contributionDelta === 0 ? '' : ' pending');
      chip.setAttribute('title', word.text.toUpperCase() + ' ×' + count + ' · ' + formatMultiplier(word.mult) + ' ' + I18n.t('eachOccurrence', 'each'));

      var name = document.createElement('span');
      name.textContent = word.text.toUpperCase();
      if (count > 1) {
        var repeat = document.createElement('small');
        repeat.className = 'count';
        repeat.textContent = '×' + count;
        name.appendChild(repeat);
      }
      if (contributionDelta !== 0) {
        var pending = document.createElement('small');
        pending.className = 'pending-count';
        pending.textContent = (contributionDelta > 0 ? '+' : '') + contributionDelta + (I18n.locale() === 'zh-CN' ? ' ' + I18n.t('pendingConfirmation', 'pending') : ' pending');
        name.appendChild(pending);
      }

      var multiplier = document.createElement('span');
      multiplier.className = 'mult';
      multiplier.textContent = formatMultiplier(word.mult) + ' / ' + I18n.t('eachOccurrence', 'each');
      chip.appendChild(name);
      chip.appendChild(multiplier);
      els.wordList.appendChild(chip);
    });
  }

  function renderRecommendation(state) {
    var recommendation = state.recommendation || {};
    var target = recommendation.target;
    var missing = recommendation.missing || [];
    els.recommendationSummary.textContent = target ? formatMultiplier(target.mult) : I18n.t('routeHint', 'route hint');
    els.targetWord.textContent = target ? target.text.toUpperCase() : I18n.t('noneYet', 'none');
    els.missingLetters.textContent = missing.length ? missing.map(function (letter) { return letter.toUpperCase(); }).join(' ') : I18n.t('ready', 'ready');
    els.bestRegion.textContent = MapSystem.describeRegion(recommendation.bestRegion);
    renderTailSuggestions(recommendation.tailSuggestions || []);
  }

  function renderTailSuggestions(suggestions) {
    if (!els.tailSuggestions) return;
    els.tailSuggestions.innerHTML = '';
    if (!suggestions.length) {
      var empty = document.createElement('li');
      empty.className = 'tail-empty';
      empty.textContent = I18n.t('noTailWords', 'No tail completions');
      els.tailSuggestions.appendChild(empty);
      return;
    }

    suggestions.slice(0, 3).forEach(function (suggestion) {
      var primary = suggestion.words && suggestion.words[0];
      var wordText = primary && (primary.text || primary);
      if (!wordText) return;
      var item = document.createElement('li');
      item.className = 'tail-suggestion';
      var route = document.createElement('strong');
      route.textContent = wordText.slice(0, -1).toUpperCase() + ' + ' + suggestion.letter.toUpperCase() + ' → ' + wordText.toUpperCase();
      var detail = document.createElement('small');
      detail.textContent = (suggestion.count > 1 ? suggestion.count + (I18n.locale() === 'zh-CN' ? ' 个词 · ' : ' words · ') : '') + (suggestion.multiplierDisplay || formatMultiplier(suggestion.multiplier));
      item.title = (suggestion.words || []).map(function (word) { return (word.text || word).toUpperCase(); }).join(' / ');
      item.appendChild(route);
      item.appendChild(detail);
      els.tailSuggestions.appendChild(item);
    });
  }

  function renderBossRequirement(state) {
    if (!els.bossRequirement) return;
    var config = GameConfig.boss || {};
    var multipliers = config.powerMultipliers || [2, 4, 8, 16];
    var nextGate = state.map && MapSystem.nextBossGate ? MapSystem.nextBossGate(state) : null;
    var activeLayer = state.boss.active && (state.boss.active.layerIndex || state.boss.active.gateLayer);
    var layer = activeLayer || (nextGate && nextGate.layerIndex) || state.map.currentLayer || state.boss.defeated + 1;
    layer = Utils.clamp(layer, 1, multipliers.length);
    var targetPower = state.boss.active && state.boss.active.originalPower
      ? state.boss.active.originalPower
      : (window.EnemySystem && EnemySystem.bossPowerForLayer ? EnemySystem.bossPowerForLayer(layer) : (config.referencePower || 21) * (multipliers[layer - 1] || 1));
    var multiplier = state.boss.active && config.referencePower
      ? targetPower / config.referencePower
      : (multipliers[layer - 1] || multipliers[multipliers.length - 1] || 1);
    var gateLabel = I18n.locale() === 'zh-CN' ? '第 ' + layer + ' 关' : 'Gate ' + layer;
    els.bossRequirement.textContent = gateLabel + ' · ×' + multiplier + ' · ' + (CombatSystem.formatPower ? CombatSystem.formatPower(targetPower) : targetPower.toFixed(1));
  }

  function updateAbility(button, charge, ready) {
    button.style.setProperty('--charge', Math.round(charge * 100) + '%');
    button.classList.toggle('ready', ready);
  }

  function renderAbilitySlots(state) {
    els.skillSlots.forEach(function (button, index) {
      var id = state.player.activeSlots[index];
      var definition = SkillSystem.byId[id];
      var icon = button.querySelector('.icon');
      var label = button.querySelector('.label');
      var cooldown = button.querySelector('.cooldown');
      button.className = 'ability' + (definition ? ' ' + definition.id + '-ability' : ' empty');
      button.disabled = !definition;
      if (!definition) {
        icon.textContent = '+';
        label.textContent = I18n.t('empty', 'Empty');
        cooldown.textContent = I18n.t('locked', 'locked');
        updateAbility(button, 0, false);
        return;
      }
      button.style.setProperty('--skill-color', definition.color);
      icon.textContent = definition.icon;
      label.textContent = localizedSkillName(definition);
      var value = SkillSystem.cooldown(state, id);
      cooldown.textContent = value <= 0 ? I18n.t('ready', 'ready') : value.toFixed(1) + 's';
      updateAbility(button, SkillSystem.charge(state, id), value <= 0);
    });
  }

  function toast(state, title, body) {
    if (!els.toastStack) return;
    var node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = '<strong>' + title + '</strong><span>' + body + '</span>';
    els.toastStack.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 3200);
  }

  function showPowerSurge(state, delta, boss) {
    if (!els.powerSurge || !delta || Math.abs(delta) < 0.01) return;
    els.powerSurge.className = 'power-surge show' + (delta < 0 ? ' loss' : '') + (boss ? ' boss' : '');
    var deltaText = CombatSystem.formatPower ? CombatSystem.formatPower(Math.abs(delta)) : Math.abs(delta).toFixed(1);
    els.powerSurgeDelta.textContent = I18n.t('powerLabel', 'POWER') + (delta > 0 ? ' +' : ' -') + deltaText;
    var settled = CombatSystem.settledPower(state);
    var settledLog = CombatSystem.settledLogPower ? CombatSystem.settledLogPower(state) : null;
    els.powerSurgeTotal.textContent = I18n.t('totalLabel', 'total') + ' ' + (CombatSystem.formatPower ? CombatSystem.formatPower(settled, settledLog) : settled.toFixed(1));
    if (els.combat && els.combat.parentNode) {
      els.combat.parentNode.classList.remove('power-bump');
      void els.combat.parentNode.offsetWidth;
      els.combat.parentNode.classList.add('power-bump');
      window.setTimeout(function () { els.combat.parentNode.classList.remove('power-bump'); }, 620);
    }
    window.clearTimeout(els.powerSurgeTimer);
    els.powerSurgeTimer = window.setTimeout(function () { els.powerSurge.classList.remove('show'); }, boss ? 2300 : 850);
  }

  function localizedReward(reward) {
    if (!reward) return { title: '', body: '', pills: [], continueLabel: I18n.t('diveOn', 'Dive On') };
    var data = reward.data || {};
    if (reward.kind === 'failure') {
      return {
        title: I18n.t('genomeCollapse', 'Genome Collapse'),
        body: I18n.t('genomeCollapseBody', 'The current lost its last reserve and the genome could not hold its shape.'),
        pills: [
          I18n.t('causeLabel', 'cause') + ': ' + (data.cause || ''),
          I18n.t('depthLabel', 'depth') + ': ' + (data.depth == null ? '' : data.depth) + 'm',
          I18n.t('wordsLabel', 'words') + ': ' + (data.words == null ? 0 : data.words),
          I18n.t('bossesLabel', 'bosses') + ': ' + (data.bosses == null ? 0 : data.bosses)
        ],
        continueLabel: I18n.t('newRun', 'New Run')
      };
    }
    if (reward.kind === 'clear') {
      return {
        title: I18n.t('runCleared', 'Run Cleared'),
        body: I18n.t('runClearedBody', 'The fourth gate collapsed. This genome survived the full descent.'),
        pills: [
          I18n.t('finalPowerLabel', 'final power') + ': ' + (data.finalPower || ''),
          I18n.t('expressedLabel', 'expressed') + ': ' + (data.expressed == null ? 0 : data.expressed),
          I18n.t('genomeLabel', 'genome') + ': ' + (data.genome || '')
        ],
        continueLabel: I18n.t('newRun', 'New Run')
      };
    }
    if (reward.kind === 'boss') {
      return {
        title: I18n.t('genomeExpandedResult', 'Genome Expanded'),
        body: I18n.t('genomeExpandedBody', 'Boss current collapsed. A word entered the queue, capacity grew, and the avatar re-formed from unlocked words.'),
        pills: [
          I18n.t('wordLabel', 'word') + ': ' + (data.wordAccepted === false ? I18n.t('rewardBlocked', 'reward could not fit') : String(data.word || '').toUpperCase()),
          I18n.t('slotsLabel', 'slots') + ': ' + (data.slotsBefore == null ? '' : data.slotsBefore) + ' -> ' + (data.slotsAfter == null ? '' : data.slotsAfter),
          I18n.t('nextGateLabel', 'next gate') + ': ' + (data.nextDepth == null ? '' : data.nextDepth) + 'm'
        ],
        continueLabel: I18n.t('diveOn', 'Dive On')
      };
    }
    return {
      title: reward.title || I18n.t('genomeExpandedDefault', 'Genome Expanded'),
      body: reward.body || I18n.t('newLettersEntered', 'New letters entered the current genome.'),
      pills: reward.pills || [],
      continueLabel: reward.continueLabel || I18n.t('diveOn', 'Dive On')
    };
  }

  function showEvolution(state) {
    if (!state.reward) return;
    var presentation = localizedReward(state.reward);
    els.continueButton.textContent = presentation.continueLabel;
    els.evolutionTitle.textContent = presentation.title;
    els.evolutionBody.textContent = presentation.body;
    els.rewardRow.innerHTML = '';
    presentation.pills.forEach(function (text) {
      var pill = document.createElement('span');
      pill.className = 'reward-pill';
      pill.textContent = text;
      els.rewardRow.appendChild(pill);
    });
    renderSkillBackpack(state);
    renderClearImage(state);
    els.evolutionModal.classList.toggle('failure', !!state.reward.failure);
    els.evolutionModal.classList.add('show');
    els.evolutionModal.setAttribute('aria-hidden', 'false');
  }

  function renderSkillBackpack(state) {
    var show = !state.runOver && state.boss.defeated > 0;
    els.skillBackpack.classList.toggle('show', show);
    els.skillBackpack.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) return;

    els.equippedSlots.innerHTML = '';
    state.player.activeSlots.forEach(function (id, index) {
      var definition = SkillSystem.byId[id];
      var slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'backpack-slot' + (definition ? ' filled' : '');
      slot.innerHTML = '<span>' + (index + 1) + '</span><strong>' + (definition ? localizedSkillName(definition) : I18n.t('emptySlot', 'Empty slot')) + '</strong>';
      slot.addEventListener('click', function () {
        state.player.activeSlots[index] = null;
        renderSkillBackpack(state);
        state.uiDirty = true;
      });
      els.equippedSlots.appendChild(slot);
    });

    els.skillInventory.innerHTML = '';
    SkillSystem.definitions.forEach(function (definition) {
      var unlocked = state.skillInventory.unlocked.has(definition.id);
      var equipped = state.player.activeSlots.indexOf(definition.id) !== -1;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'inventory-skill' + (unlocked ? ' unlocked' : ' locked') + (equipped ? ' equipped' : '');
      card.disabled = !unlocked;
      card.style.setProperty('--skill-color', definition.color);
      card.innerHTML = '<span class="inventory-icon">' + definition.icon + '</span><span class="inventory-copy"><strong>' + localizedSkillName(definition) + '</strong><small>' + (unlocked ? localizedSkillDescription(definition) : definition.words.join(' / ')) + '</small></span><span class="inventory-state">' + (equipped ? I18n.t('equipped', 'Equipped') : unlocked ? I18n.t('equip', 'Equip') : I18n.t('locked', 'Locked')) + '</span>';
      card.addEventListener('click', function () {
        if (equipped) {
          state.player.activeSlots[state.player.activeSlots.indexOf(definition.id)] = null;
        } else {
          var empty = state.player.activeSlots.indexOf(null);
          if (empty === -1) {
            toast(state, I18n.t('allSlotsFull', 'All three slots are full'), I18n.t('removeSkillFirst', 'Remove one equipped skill first'));
            return;
          }
          state.player.activeSlots[empty] = definition.id;
        }
        renderSkillBackpack(state);
        state.uiDirty = true;
      });
      els.skillInventory.appendChild(card);
    });
  }

  function localizedSkillName(definition) {
    if (SkillSystem.localizedName) return SkillSystem.localizedName(definition);
    return I18n.t(definition.id, definition.name);
  }

  function localizedSkillDescription(definition) {
    if (SkillSystem.localizedDescription) return SkillSystem.localizedDescription(definition);
    return I18n.t('skill_' + definition.id, definition.description);
  }

  function renderClearImage(state) {
    if (!els.clearImagePanel || !state.clearImage) return;
    var shouldShow = state.reward && state.reward.clearImage;
    els.clearImagePanel.classList.toggle('show', !!shouldShow);
    if (!shouldShow) return;

    var status = state.clearImage.status;
    els.clearImagePanel.className = 'clear-image-panel show ' + status;
    els.clearImagePreview.innerHTML = '';

    if (status === 'ready' && state.clearImage.image) {
      var img = document.createElement('img');
      img.src = state.clearImage.image;
      img.alt = I18n.t('generatedGenomeAvatar', 'Generated cleared genome avatar');
      els.clearImagePreview.appendChild(img);
      els.clearImageStatus.textContent = I18n.t('finalImageReady', 'Final image ready');
      els.clearImageDetail.textContent = state.clearImage.record && state.clearImage.record.saved
        ? I18n.t('savedToGallery', 'Saved to Gallery.')
        : I18n.t('generatedFromClearedGenome', 'Generated from the cleared genome.');
      return;
    }

    var marker = document.createElement('span');
    marker.textContent = status === 'loading' ? '...' : 'GENE';
    els.clearImagePreview.appendChild(marker);

    if (status === 'loading') {
      els.clearImageStatus.textContent = I18n.t('generatingFinalImage', 'Generating final image');
      els.clearImageDetail.textContent = I18n.t('clearedGenomeRendering', 'The cleared genome is being rendered.');
    } else if (status === 'missing-key') {
      els.clearImageStatus.textContent = I18n.t('imageKeyNotSaved', 'Image key not saved');
      els.clearImageDetail.textContent = I18n.t('openStartMenuToSave', 'Open the start menu to save a local key, then clear again.');
    } else if (status === 'error') {
      els.clearImageStatus.textContent = I18n.t('imageGenerationFailed', 'Image generation failed');
      els.clearImageDetail.textContent = state.clearImage.error || I18n.t('imageRequestDidNotComplete', 'The image request did not complete.');
    } else {
      els.clearImageStatus.textContent = I18n.t('finalImageQueued', 'Final image queued');
      els.clearImageDetail.textContent = I18n.t('preparingClearedGenome', 'Preparing the cleared genome.');
    }
  }

  window.GameUI = {
    init: init,
    update: update,
    toast: toast,
    showEvolution: showEvolution,
    renderClearImage: renderClearImage,
    showPowerSurge: showPowerSurge,
    refreshGalleryCount: refreshGalleryCount
  };
})();
